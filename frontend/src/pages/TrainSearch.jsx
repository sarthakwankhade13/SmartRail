import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './TrainSearch.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function TrainSearch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const source = searchParams.get('source');
    const destination = searchParams.get('destination');
    const date = searchParams.get('date');
    const classType = searchParams.get('class');

    if (source && destination && date) {
      searchTrains(source, destination, date, classType);
    }
  }, [searchParams]);

  const searchTrains = async (source, destination, date, classType) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/trains/search`, {
        params: { source, destination, date, class: classType }
      });
      setTrains(response.data);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = (trainId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    navigate(`/book/${trainId}?${searchParams.toString()}`);
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Available Trains</h2>
        {loading && <p>Searching trains...</p>}
        {!loading && trains.length === 0 && <p>No trains found for this route.</p>}
        {!loading && trains.length > 0 && (
          <div className="trains-list">
            {trains.map((train) => (
              <div key={train.train_id} className="train-card">
                <div className="train-info">
                  <h3>{train.train_number} - {train.train_name}</h3>
                  <p className="train-type">{train.train_type}</p>
                </div>
                <div className="train-details">
                  <div className="time-info">
                    <div>
                      <strong>{train.source_station}</strong>
                      <p>{train.departure_time}</p>
                    </div>
                    <div className="arrow">→</div>
                    <div>
                      <strong>{train.destination_station}</strong>
                      <p>{train.arrival_time}</p>
                    </div>
                  </div>
                  <div className="availability">
                    <p>Available: <strong>{train.available_seats}</strong> seats</p>
                    <p>Fare: <strong>₹{train.fare}</strong></p>
                  </div>
                </div>
                <button 
                  className="btn btn-primary"
                  onClick={() => handleBook(train.train_id)}
                  disabled={train.available_seats === 0}
                >
                  {train.available_seats > 0 ? 'Book Now' : 'Sold Out'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TrainSearch;
