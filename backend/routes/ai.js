const express = require('express');
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');
const dataService = require('../services/dataService');

const router = express.Router();

// AI Waitlist Prediction
router.post('/waitlist-predict', authMiddleware, async (req, res) => {
  const { trainNumber, travelDate, waitlistPosition } = req.body;

  try {
    // Verify train exists in JSON data
    const train = dataService.findTrainByNumber(trainNumber);
    
    if (!train) {
      return res.status(404).json({ error: 'Train not found' });
    }

    // Simplified AI prediction logic
    const confirmationChance = Math.max(0, 100 - (waitlistPosition * 5));
    const prediction = {
      trainNumber,
      trainName: train.properties.name,
      travelDate,
      waitlistPosition,
      confirmationProbability: confirmationChance,
      status: confirmationChance > 70 ? 'High Chance' : confirmationChance > 40 ? 'Moderate Chance' : 'Low Chance',
      estimatedConfirmationDate: confirmationChance > 50 ? 'Within 2 days' : 'Unlikely'
    };

    res.json(prediction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Prediction failed' });
  }
});

// Smart Seat Recommendation
router.post('/seat-recommend', authMiddleware, async (req, res) => {
  const { trainNumber, preferences } = req.body;

  try {
    const recommendations = [];

    if (preferences.includes('window')) {
      recommendations.push({ coach: 'S1', seatType: 'Window', seatNumbers: ['1', '4', '6', '9'] });
    }
    if (preferences.includes('lower')) {
      recommendations.push({ coach: 'S2', seatType: 'Lower Berth', seatNumbers: ['1', '8', '15', '22'] });
    }
    if (preferences.includes('family')) {
      recommendations.push({ coach: 'S3', seatType: 'Side Lower (Family)', seatNumbers: ['7', '14', '21', '28'] });
    }

    res.json({
      trainNumber,
      recommendations: recommendations.length > 0 ? recommendations : [
        { coach: 'S1', seatType: 'General', seatNumbers: ['10', '11', '12', '13'] }
      ]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Recommendation failed' });
  }
});

// Dynamic Pricing Analysis
router.post('/price-analysis', authMiddleware, async (req, res) => {
  const { trainNumber, travelDate, classType } = req.body;

  try {
    const currentPrice = 500 + Math.floor(Math.random() * 200);
    const predictedPrice = currentPrice + (Math.random() > 0.5 ? 50 : -50);

    const analysis = {
      trainNumber,
      travelDate,
      classType,
      currentPrice,
      predictedPrice,
      trend: predictedPrice > currentPrice ? 'Increasing' : 'Decreasing',
      bestTimeToBook: predictedPrice > currentPrice ? 'Book Now' : 'Wait 2-3 days',
      priceHistory: [
        { date: '2024-01-01', price: currentPrice - 100 },
        { date: '2024-01-15', price: currentPrice - 50 },
        { date: '2024-02-01', price: currentPrice }
      ]
    };

    res.json(analysis);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

// Seat Swap Platform
router.post('/seat-swap', authMiddleware, async (req, res) => {
  const { passengerName, currentSeat, desiredSeatType, trainNumber, travelDate } = req.body;

  try {
    // Verify train exists in JSON data
    const train = dataService.findTrainByNumber(trainNumber);
    
    if (!train) {
      return res.status(404).json({ error: 'Train not found' });
    }

    const matches = [
      { passengerName: 'John Doe', currentSeat: '45', desiredSeat: currentSeat, matchScore: 95 },
      { passengerName: 'Jane Smith', currentSeat: '12', desiredSeat: currentSeat, matchScore: 80 }
    ];

    res.json({
      message: 'Swap request created',
      trainName: train.properties.name,
      matches: matches.filter(m => m.currentSeat.includes(desiredSeatType.toLowerCase()))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Swap request failed' });
  }
});

// Journey Planner
router.post('/journey-plan', authMiddleware, async (req, res) => {
  const { sourceCode, destinationCode, travelDate } = req.body;

  try {
    // Verify stations exist
    const sourceStation = dataService.findStationByCode(sourceCode);
    const destStation = dataService.findStationByCode(destinationCode);

    if (!sourceStation || !destStation) {
      return res.status(404).json({ error: 'Invalid station codes' });
    }

    // Search trains from JSON data
    const trains = dataService.searchTrains(sourceCode, destinationCode);

    const recommendations = trains.slice(0, 5).map((train, index) => ({
      train_number: train.properties.number,
      train_name: train.properties.name,
      train_type: train.properties.type,
      departure_time: train.properties.departure,
      arrival_time: train.properties.arrival,
      duration_hours: train.properties.duration_h,
      recommendation: index === 0 ? 'Fastest Route' : index === 1 ? 'Best Value' : 'Alternative',
      estimatedFare: 500 + (index * 100)
    }));

    res.json({ 
      routes: recommendations,
      sourceStation: sourceStation.stnName,
      destinationStation: destStation.stnName
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Journey planning failed' });
  }
});

module.exports = router;
