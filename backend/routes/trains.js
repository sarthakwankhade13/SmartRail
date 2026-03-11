const express = require('express');
const dataService = require('../services/dataService');

const router = express.Router();

// Get all stations
router.get('/stations', async (req, res) => {
  try {
    const stations = dataService.getStations();
    // Transform to match expected format
    const formattedStations = stations.map(s => ({
      station_code: s.stnCode,
      station_name: s.stnName,
      station_city: s.stnCity
    }));
    res.json(formattedStations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all trains
router.get('/trains', async (req, res) => {
  try {
    const trains = dataService.getTrains();
    // Transform to match expected format
    const formattedTrains = trains.map(t => ({
      train_number: t.properties.number,
      train_name: t.properties.name,
      train_type: t.properties.type,
      from_station_code: t.properties.from_station_code,
      from_station_name: t.properties.from_station_name,
      to_station_code: t.properties.to_station_code,
      to_station_name: t.properties.to_station_name,
      departure_time: t.properties.departure,
      arrival_time: t.properties.arrival,
      duration_h: t.properties.duration_h,
      duration_m: t.properties.duration_m,
      distance: t.properties.distance,
      zone: t.properties.zone
    }));
    res.json(formattedTrains);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search trains
router.get('/trains/search', async (req, res) => {
  const { source, destination, date, class: classType } = req.query;

  try {
    const trains = dataService.searchTrains(source, destination);
    
    // Transform to match expected format
    const formattedTrains = trains.map(t => ({
      train_number: t.properties.number,
      train_name: t.properties.name,
      train_type: t.properties.type,
      source_station: t.properties.from_station_name,
      destination_station: t.properties.to_station_name,
      departure_time: t.properties.departure,
      arrival_time: t.properties.arrival,
      available_seats: 100, // Default value
      fare: 500, // Default value
      duration_h: t.properties.duration_h,
      duration_m: t.properties.duration_m,
      distance: t.properties.distance,
      classes: t.properties.classes || ''
    }));

    res.json(formattedTrains);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get train schedule
router.get('/train/:trainNumber/schedule', async (req, res) => {
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

    res.json(schedule);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
