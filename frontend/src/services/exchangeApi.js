import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const exchangeApi = axios.create({
  baseURL: `${API_BASE}/exchange`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const requestExchange = async (data) => {
  const response = await exchangeApi.post('/request', data);
  return response.data;
};

export const getMatches = async (requestId) => {
  const response = await exchangeApi.get(`/matches/${requestId}`);
  return response.data;
};

export const acceptExchange = async (myRequestId, targetRequestId) => {
  const response = await exchangeApi.post('/accept', {
    my_request_id: myRequestId,
    target_request_id: targetRequestId
  });
  return response.data;
};

export const getExchangeHistory = async (pnrNumber) => {
  const response = await exchangeApi.get(`/history/${pnrNumber}`);
  return response.data;
};

export default exchangeApi;
