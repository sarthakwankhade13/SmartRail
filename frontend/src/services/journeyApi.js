/**
 * Journey Planner API service.
 * All API calls to the Journey Planner Flask backend.
 * Data comes from the real JSON files (station.json, trains.json, schedules.json).
 */
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const journeyApi = axios.create({
  baseURL: `${API_BASE}/journey`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Fetch all trains.
 * GET /api/journey/trains
 */
export const fetchAllTrains = async (limit = 50) => {
  const response = await journeyApi.get('/trains', { params: { limit } });
  return response.data;
};

/**
 * Fetch a single train by train number (includes stops).
 * GET /api/journey/trains/:trainNumber
 */
export const fetchTrainByNumber = async (trainNumber) => {
  const response = await journeyApi.get(`/trains/${trainNumber}`);
  return response.data;
};

/**
 * Search trains by source and destination.
 * POST /api/journey/search
 */
export const searchTrains = async (source, destination, date) => {
  const response = await journeyApi.post('/search', { source, destination, date });
  return response.data;
};

export default journeyApi;
