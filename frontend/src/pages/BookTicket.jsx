import React, { useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './BookTicket.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function BookTicket() {
  const { trainId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [passengers, setPassengers] = useState([
    { name: '', age: '', gender: 'Male', berthPreference: 'Lower' }
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addPassenger = () => {
    setPassengers([...passengers, { name: '', age: '', gender: 'Male', berthPreference: 'Lower' }]);
  };

  const updatePassenger = (index, field, value) => {
    const updated = [...passengers];
    updated[index][field] = value;
    setPassengers(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/book-ticket`,
        {
          trainId: parseInt(trainId),
          sourceStationCode: searchParams.get('source'),
          destinationStationCode: searchParams.get('destination'),
          travelDate: searchParams.get('date'),
          classType: searchParams.get('class'),
          passengers
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(`Booking successful! PNR: ${response.data.pnrNumber}`);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Book Ticket</h2>
        <div className="booking-info">
          <p>From: <strong>{searchParams.get('source')}</strong></p>
          <p>To: <strong>{searchParams.get('destination')}</strong></p>
          <p>Date: <strong>{searchParams.get('date')}</strong></p>
          <p>Class: <strong>{searchParams.get('class')}</strong></p>
        </div>

        <form onSubmit={handleSubmit}>
          <h3>Passenger Details</h3>
          {passengers.map((passenger, index) => (
            <div key={index} className="passenger-form">
              <h4>Passenger {index + 1}</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={passenger.name}
                    onChange={(e) => updatePassenger(index, 'name', e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Age</label>
                  <input
                    type="number"
                    value={passenger.age}
                    onChange={(e) => updatePassenger(index, 'age', e.target.value)}
                    min="1"
                    max="120"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <select
                    value={passenger.gender}
                    onChange={(e) => updatePassenger(index, 'gender', e.target.value)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Berth Preference</label>
                  <select
                    value={passenger.berthPreference}
                    onChange={(e) => updatePassenger(index, 'berthPreference', e.target.value)}
                  >
                    <option value="Lower">Lower</option>
                    <option value="Middle">Middle</option>
                    <option value="Upper">Upper</option>
                    <option value="Side Lower">Side Lower</option>
                    <option value="Side Upper">Side Upper</option>
                  </select>
                </div>
              </div>
            </div>
          ))}

          <button type="button" onClick={addPassenger} className="btn btn-secondary">
            Add Passenger
          </button>

          {error && <div className="error">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Booking...' : 'Confirm Booking'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default BookTicket;
