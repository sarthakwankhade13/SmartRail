const express = require('express');
const db = require('../config/database');
const dataService = require('../services/dataService');

const router = express.Router();

// Fetch real-time station data
router.get('/stations/live', async (req, res) => {
  try {
    const stations = dataService.getStations();
    const formattedStations = stations.map(s => ({
      station_code: s.stnCode,
      station_name: s.stnName,
      city: s.stnCity,
      state: s.stnCity // Using city as state since state is not in JSON
    }));
    
    res.json({
      success: true,
      count: formattedStations.length,
      data: formattedStations
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch stations' });
  }
});

// Fetch real-time train data
router.get('/trains/live', async (req, res) => {
  try {
    const trains = dataService.getTrains();
    const formattedTrains = trains.map(t => ({
      train_number: t.properties.number,
      train_name: t.properties.name,
      train_type: t.properties.type
    }));
    
    res.json({
      success: true,
      count: formattedTrains.length,
      data: formattedTrains
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch trains' });
  }
});

// Fetch real-time train schedule
router.get('/trains/:trainNumber/live-schedule', async (req, res) => {
  const { trainNumber } = req.params;
  
  try {
    const train = dataService.findTrainByNumber(trainNumber);
    
    if (!train) {
      return res.status(404).json({ error: 'Train not found' });
    }

    // Extract coordinates and create schedule
    const coordinates = train.geometry.coordinates;
    const schedule = coordinates.map((coord, index) => ({
      stop_number: index + 1,
      station_code: index === 0 ? train.properties.from_station_code : 
                    index === coordinates.length - 1 ? train.properties.to_station_code : 
                    `STN${index}`,
      station_name: index === 0 ? train.properties.from_station_name : 
                    index === coordinates.length - 1 ? train.properties.to_station_name : 
                    `Station ${index}`,
      arrival_time: index === 0 ? null : train.properties.departure,
      departure_time: index === coordinates.length - 1 ? null : train.properties.arrival,
      distance_km: Math.round((train.properties.distance / coordinates.length) * index),
      day_offset: 0
    }));
    
    res.json({
      success: true,
      trainNumber,
      stops: schedule.length,
      data: schedule
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch schedule' });
  }
});

// Real-time seat availability
router.get('/trains/:trainNumber/availability', async (req, res) => {
  const { trainNumber } = req.params;
  const { date, class: classType } = req.query;
  
  try {
    const train = dataService.findTrainByNumber(trainNumber);
    
    if (!train) {
      return res.status(404).json({ error: 'Train not found' });
    }

    // Generate mock availability data based on train classes
    const classes = ['SL', '3A', '2A', '1A'];
    const availability = classes.map(cls => ({
      class_type: cls,
      available_seats: Math.floor(Math.random() * 50) + 10,
      total_seats: cls === 'SL' ? 72 : cls === '3A' ? 64 : cls === '2A' ? 48 : 24,
      base_fare: cls === 'SL' ? 300 : cls === '3A' ? 800 : cls === '2A' ? 1500 : 2500,
      train_name: train.properties.name
    }));

    const filteredAvailability = classType 
      ? availability.filter(a => a.class_type === classType)
      : availability;
    
    res.json({
      success: true,
      trainNumber,
      date,
      data: filteredAvailability
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

module.exports = router;
