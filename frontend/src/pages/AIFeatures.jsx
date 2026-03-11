import React, { useState } from 'react';
import axios from 'axios';
import './AIFeatures.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function AIFeatures() {
  const [activeFeature, setActiveFeature] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const [waitlistForm, setWaitlistForm] = useState({
    trainNumber: '',
    travelDate: '',
    waitlistPosition: ''
  });

  const [seatForm, setSeatForm] = useState({
    trainNumber: '',
    preferences: []
  });

  const [priceForm, setPriceForm] = useState({
    trainNumber: '',
    travelDate: '',
    classType: 'SL'
  });

  const [swapForm, setSwapForm] = useState({
    passengerName: '',
    currentSeat: '',
    desiredSeatType: '',
    trainNumber: '',
    travelDate: ''
  });

  const [journeyForm, setJourneyForm] = useState({
    sourceCode: '',
    destinationCode: '',
    travelDate: ''
  });

  const handleWaitlistPredict = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/ai/waitlist-predict`, waitlistForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResult(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeatRecommend = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/ai/seat-recommend`, seatForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResult(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceAnalysis = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/ai/price-analysis`, priceForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResult(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSeatSwap = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/ai/seat-swap`, swapForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResult(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleJourneyPlan = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/ai/journey-plan`, journeyForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResult(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>AI-Powered Features</h2>
        <div className="ai-features-grid">
          <button className="feature-btn" onClick={() => { setActiveFeature('waitlist'); setResult(null); }}>
            🎯 Waitlist Prediction
          </button>
          <button className="feature-btn" onClick={() => { setActiveFeature('seat'); setResult(null); }}>
            💺 Seat Recommendation
          </button>
          <button className="feature-btn" onClick={() => { setActiveFeature('price'); setResult(null); }}>
            📊 Price Analysis
          </button>
          <button className="feature-btn" onClick={() => { setActiveFeature('swap'); setResult(null); }}>
            🔄 Seat Swap
          </button>
          <button className="feature-btn" onClick={() => { setActiveFeature('journey'); setResult(null); }}>
            🗺️ Journey Planner
          </button>
        </div>

        {activeFeature === 'waitlist' && (
          <div className="feature-form">
            <h3>Waitlist Prediction</h3>
            <form onSubmit={handleWaitlistPredict}>
              <div className="form-group">
                <label>Train Number</label>
                <input type="text" value={waitlistForm.trainNumber} 
                  onChange={(e) => setWaitlistForm({...waitlistForm, trainNumber: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Travel Date</label>
                <input type="date" value={waitlistForm.travelDate}
                  onChange={(e) => setWaitlistForm({...waitlistForm, travelDate: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Waitlist Position</label>
                <input type="number" value={waitlistForm.waitlistPosition}
                  onChange={(e) => setWaitlistForm({...waitlistForm, waitlistPosition: e.target.value})} required />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Predicting...' : 'Predict'}
              </button>
            </form>
          </div>
        )}

        {activeFeature === 'seat' && (
          <div className="feature-form">
            <h3>Smart Seat Recommendation</h3>
            <form onSubmit={handleSeatRecommend}>
              <div className="form-group">
                <label>Train Number</label>
                <input type="text" value={seatForm.trainNumber}
                  onChange={(e) => setSeatForm({...seatForm, trainNumber: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Preferences</label>
                <div className="checkbox-group">
                  <label><input type="checkbox" value="window" 
                    onChange={(e) => {
                      const prefs = e.target.checked 
                        ? [...seatForm.preferences, 'window']
                        : seatForm.preferences.filter(p => p !== 'window');
                      setSeatForm({...seatForm, preferences: prefs});
                    }} /> Window Seat</label>
                  <label><input type="checkbox" value="lower"
                    onChange={(e) => {
                      const prefs = e.target.checked 
                        ? [...seatForm.preferences, 'lower']
                        : seatForm.preferences.filter(p => p !== 'lower');
                      setSeatForm({...seatForm, preferences: prefs});
                    }} /> Lower Berth</label>
                  <label><input type="checkbox" value="family"
                    onChange={(e) => {
                      const prefs = e.target.checked 
                        ? [...seatForm.preferences, 'family']
                        : seatForm.preferences.filter(p => p !== 'family');
                      setSeatForm({...seatForm, preferences: prefs});
                    }} /> Family Seating</label>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Analyzing...' : 'Get Recommendations'}
              </button>
            </form>
          </div>
        )}

        {activeFeature === 'price' && (
          <div className="feature-form">
            <h3>Dynamic Price Analysis</h3>
            <form onSubmit={handlePriceAnalysis}>
              <div className="form-group">
                <label>Train Number</label>
                <input type="text" value={priceForm.trainNumber}
                  onChange={(e) => setPriceForm({...priceForm, trainNumber: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Travel Date</label>
                <input type="date" value={priceForm.travelDate}
                  onChange={(e) => setPriceForm({...priceForm, travelDate: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Class</label>
                <select value={priceForm.classType}
                  onChange={(e) => setPriceForm({...priceForm, classType: e.target.value})}>
                  <option value="SL">Sleeper</option>
                  <option value="3A">AC 3 Tier</option>
                  <option value="2A">AC 2 Tier</option>
                  <option value="1A">AC First Class</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Analyzing...' : 'Analyze Price'}
              </button>
            </form>
          </div>
        )}

        {result && (
          <div className="result-card">
            <h3>Results</h3>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default AIFeatures;
