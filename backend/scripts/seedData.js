const db = require('../config/database');
const { stations, trains, schedules } = require('../../database/indian_railway_data');

async function seedData() {
  const connection = await db.getConnection();

  try {
    await connection.query('USE railai');
    await connection.beginTransaction();

    console.log('Seeding stations...');
    for (const station of stations) {
      await connection.query(
        'INSERT INTO Stations (station_code, station_name, city, state) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE station_name = VALUES(station_name)',
        [station.code, station.name, station.city, station.state]
      );
    }

    console.log('Seeding trains...');
    for (const train of trains) {
      await connection.query(
        'INSERT INTO Trains (train_number, train_name, train_type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE train_name = VALUES(train_name)',
        [train.number, train.name, train.type]
      );
    }

    console.log('Seeding train schedules...');
    for (const schedule of schedules) {
      const [train] = await connection.query('SELECT train_id FROM Trains WHERE train_number = ?', [schedule.trainNumber]);
      const [station] = await connection.query('SELECT station_id FROM Stations WHERE station_code = ?', [schedule.stationCode]);

      if (train.length > 0 && station.length > 0) {
        await connection.query(
          `INSERT INTO Train_Schedules (train_id, station_id, arrival_time, departure_time, stop_number, distance_km, day_offset) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [train[0].train_id, station[0].station_id, schedule.arrivalTime, schedule.departureTime, 
           schedule.stopNumber, schedule.distanceKm, schedule.dayOffset || 0]
        );
      }
    }

    console.log('Seeding seat availability...');
    const [allTrains] = await connection.query('SELECT train_id FROM Trains');
    const classes = ['SL', '3A', '2A', '1A'];
    const today = new Date();

    for (const train of allTrains) {
      for (let i = 0; i < 30; i++) {
        const travelDate = new Date(today);
        travelDate.setDate(today.getDate() + i);
        const dateStr = travelDate.toISOString().split('T')[0];

        for (const classType of classes) {
          const totalSeats = classType === 'SL' ? 72 : classType === '3A' ? 64 : classType === '2A' ? 48 : 24;
          const availableSeats = Math.floor(totalSeats * (0.5 + Math.random() * 0.5));
          const baseFare = classType === 'SL' ? 300 : classType === '3A' ? 800 : classType === '2A' ? 1500 : 2500;

          await connection.query(
            `INSERT INTO Seat_Availability (train_id, travel_date, class_type, available_seats, total_seats, base_fare) 
             VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE available_seats = VALUES(available_seats)`,
            [train.train_id, dateStr, classType, availableSeats, totalSeats, baseFare]
          );
        }
      }
    }

    await connection.commit();
    console.log('Database seeded successfully!');
  } catch (error) {
    await connection.rollback();
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    connection.release();
    await db.end();
  }
}

seedData();
