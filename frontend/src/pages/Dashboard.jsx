import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function Dashboard() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/user/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h2>My Bookings</h2>
        {loading && <p>Loading bookings...</p>}
        {!loading && bookings.length === 0 && <p>No bookings found.</p>}
        {!loading && bookings.length > 0 && (
          <div className="bookings-list">
            {bookings.map((booking) => (
              <div key={booking.booking_id} className="booking-card">
                <div className="booking-header">
                  <h3>{booking.train_number} - {booking.train_name}</h3>
                  <span className={`status ${booking.booking_status.toLowerCase()}`}>
                    {booking.booking_status}
                  </span>
                </div>
                <div className="booking-body">
                  <p><strong>PNR:</strong> {booking.pnr_number}</p>
                  <p><strong>From:</strong> {booking.source_station}</p>
                  <p><strong>To:</strong> {booking.destination_station}</p>
                  <p><strong>Date:</strong> {new Date(booking.travel_date).toLocaleDateString()}</p>
                  <p><strong>Class:</strong> {booking.class_type}</p>
                  <p><strong>Fare:</strong> ₹{booking.total_fare}</p>
                  <p><strong>Booked on:</strong> {new Date(booking.booking_date).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
