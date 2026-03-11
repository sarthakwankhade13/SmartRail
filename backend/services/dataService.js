const fs = require('fs');
const path = require('path');

// Load JSON data files
const loadStations = () => {
  try {
    const data = fs.readFileSync(path.join(__dirname, '../../station.json'), 'utf8');
    const parsed = JSON.parse(data);
    return parsed.stations || [];
  } catch (error) {
    console.error('Error loading stations:', error);
    return [];
  }
};

const loadTrains = () => {
  try {
    const data = fs.readFileSync(path.join(__dirname, '../../trains.json'), 'utf8');
    const parsed = JSON.parse(data);
    return parsed.features || [];
  } catch (error) {
    console.error('Error loading trains:', error);
    return [];
  }
};

const loadSchedules = () => {
  try {
    const data = fs.readFileSync(path.join(__dirname, '../../schedules.json'), 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading schedules:', error);
    return [];
  }
};

// Cache data in memory for better performance
let stationsCache = null;
let trainsCache = null;
let schedulesCache = null;

const getStations = () => {
  if (!stationsCache) {
    stationsCache = loadStations();
  }
  return stationsCache;
};

const getTrains = () => {
  if (!trainsCache) {
    trainsCache = loadTrains();
  }
  return trainsCache;
};

const getSchedules = () => {
  if (!schedulesCache) {
    schedulesCache = loadSchedules();
  }
  return schedulesCache;
};

// Find station by code
const findStationByCode = (code) => {
  const stations = getStations();
  return stations.find(s => s.stnCode === code);
};

// Find train by number
const findTrainByNumber = (trainNumber) => {
  const trains = getTrains();
  return trains.find(t => t.properties.number === trainNumber);
};

// Search trains between stations
const searchTrains = (sourceCode, destCode) => {
  const trains = getTrains();
  return trains.filter(train => {
    const props = train.properties;
    return props.from_station_code === sourceCode && props.to_station_code === destCode;
  });
};

module.exports = {
  getStations,
  getTrains,
  getSchedules,
  findStationByCode,
  findTrainByNumber,
  searchTrains
};
