const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const dataService = require('../services/dataService');

const router = express.Router();

// Generate PNR
function generatePNR() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

// Book ticket
router.post('/book-ticket', authMiddleware, async (req, res) => {
  const { trainNumber, sourceStationCode, destinationStationCode, travelDate, classType, passengers } = req.body;
  const userId = req.user.userId;

  const connection = await db.getConnection();
  
  try {
    await connection.beginTransaction();

    // Verify stations exist in JSON data
    const sourceStation = dataService.findStationByCode(sourceStationCode);
    const destStation = dataService.findStationByCode(destinationStationCode);
    const train = dataService.findTrainByNumber(trainNumber);

    if (!sourceStation || !destStation || !train) {
      throw new Error('Invalid station codes or train number');
    }

    const pnrNumber = generatePNR();
    const totalFare = passengers.length * 500; // Simplified fare calculation

    // Create booking (still using database for bookings)
    const [bookingResult] = await connection.query(
      `INSERT INTO Bookings (user_id, train_id, pnr_number, source_station_id, destination_station_id, 
       travel_date, class_type, total_fare, booking_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')`,
      [userId, trainNumber, pnrNumber, sourceStationCode, destinationStationCode, travelDate, classType, totalFare]
    );

    const bookingId = bookingResult.insertId;

    // Add passengers
    for (const passenger of passengers) {
      const seatNumber = `${Math.floor(Math.random() * 72) + 1}`;
      await connection.query(
        'INSERT INTO Passengers (booking_id, name, age, gender, seat_number, berth_preference) VALUES (?, ?, ?, ?, ?, ?)',
        [bookingId, passenger.name, passenger.age, passenger.gender, seatNumber, passenger.berthPreference]
      );
    }

    await connection.commit();

    res.status(201).json({
      message: 'Booking successful',
      pnrNumber,
      bookingId,
      totalFare,
      trainName: train.properties.name
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Booking failed: ' + error.message });
  } finally {
    connection.release();
  }
});

// Get PNR status
router.get('/pnr/:pnrNumber', async (req, res) => {
  const { pnrNumber } = req.params;

  try {
    const query = `
      SELECT 
        b.pnr_number, b.booking_status, b.travel_date, b.class_type, b.total_fare,
        t.train_number, t.train_name,
        src.station_name as source_station, dest.station_name as destination_station,
        p.name as passenger_name, p.age, p.gender, p.seat_number, p.berth_preference
      FROM Bookings b
      JOIN Trains t ON b.train_id = t.train_id
      JOIN Stations src ON b.source_station_id = src.station_id
      JOIN Stations dest ON b.destination_station_id = dest.station_id
      LEFT JOIN Passengers p ON b.booking_id = p.booking_id
      WHERE b.pnr_number = ?
    `;

    const [results] = await db.query(query, [pnrNumber]);

    if (results.length === 0) {
      return res.status(404).json({ error: 'PNR not found' });
    }

    const booking = {
      pnrNumber: results[0].pnr_number,
      bookingStatus: results[0].booking_status,
      travelDate: results[0].travel_date,
      classType: results[0].class_type,
      totalFare: results[0].total_fare,
      trainNumber: results[0].train_number,
      trainName: results[0].train_name,
      sourceStation: results[0].source_station,
      destinationStation: results[0].destination_station,
      passengers: results.map(r => ({
        name: r.passenger_name,
        age: r.age,
        gender: r.gender,
        seatNumber: r.seat_number,
        berthPreference: r.berth_preference
      }))
    };

    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user bookings
router.get('/user/bookings', authMiddleware, async (req, res) => {
  const userId = req.user.userId;

  try {
    const query = `
      SELECT 
        b.booking_id, b.pnr_number, b.booking_status, b.travel_date, b.class_type, b.total_fare, b.booking_date,
        t.train_number, t.train_name,
        src.station_name as source_station, dest.station_name as destination_station
      FROM Bookings b
      JOIN Trains t ON b.train_id = t.train_id
      JOIN Stations src ON b.source_station_id = src.station_id
      JOIN Stations dest ON b.destination_station_id = dest.station_id
      WHERE b.user_id = ?
      ORDER BY b.booking_date DESC
    `;

    const [bookings] = await db.query(query, [userId]);
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
