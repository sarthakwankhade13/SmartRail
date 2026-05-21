import React, { useState } from 'react';
import axios from 'axios';
import './PNRStatus.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function PNRStatus() {
  const [pnr, setPnr] = useState('');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setBooking(null);

    try {
      const response = await axios.get(`${API_URL}/pnr/${pnr}`);
      setBooking(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'PNR not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>Check PNR Status</h2>
        <form onSubmit={handleSearch} className="pnr-form">
          <div className="form-group">
            <label>Enter PNR Number</label>
            <input
              type="text"
              value={pnr}
              onChange={(e) => setPnr(e.target.value)}
              placeholder="10-digit PNR"
              maxLength="10"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Checking...' : 'Check Status'}
          </button>
        </form>

        {error && <div className="error">{error}</div>}

        {booking && (
          <div className="pnr-result">
            <h3>Booking Details</h3>
            <div className="booking-details">
              <p><strong>PNR:</strong> {booking.pnrNumber}</p>
              <p><strong>Status:</strong> <span className="status-confirmed">{booking.bookingStatus}</span></p>
              <p><strong>Train:</strong> {booking.trainNumber} - {booking.trainName}</p>
              <p><strong>From:</strong> {booking.sourceStation}</p>
              <p><strong>To:</strong> {booking.destinationStation}</p>
              <p><strong>Date:</strong> {new Date(booking.travelDate).toLocaleDateString()}</p>
              <p><strong>Class:</strong> {booking.classType}</p>
              <p><strong>Total Fare:</strong> ₹{booking.totalFare}</p>
            </div>

            <h4>Passengers</h4>
            <table className="passengers-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Seat</th>
                  <th>Berth</th>
                </tr>
              </thead>
              <tbody>
                {booking.passengers.map((passenger, index) => (
                  <tr key={index}>
                    <td>{passenger.name}</td>
                    <td>{passenger.age}</td>
                    <td>{passenger.gender}</td>
                    <td>{passenger.seatNumber}</td>
                    <td>{passenger.berthPreference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default PNRStatus;
