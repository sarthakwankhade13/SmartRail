import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './BookTicket.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const BERTH_OPTIONS = ['Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper', 'No Preference'];

function BookTicket() {
  const { trainId }      = useParams();
  const [searchParams]   = useSearchParams();
  const navigate         = useNavigate();

  const [passengers, setPassengers] = useState([
    { name: '', age: '', gender: 'Male', berthPreference: 'Lower' }
  ]);
  const [fareInfo, setFareInfo] = useState(null);
  const [loadingFare, setLoadingFare] = useState(false);
  const [error, setError]       = useState('');

  const classType   = searchParams.get('class')       || 'SL';
  const source      = searchParams.get('source')      || '';
  const destination = searchParams.get('destination') || '';
  const date        = searchParams.get('date')        || '';

  // Fetch fare on mount
  useEffect(() => {
    if (!trainId || !source || !destination) return;
    setLoadingFare(true);
    axios.get(`${API_URL}/fare`, {
      params: { train_number: trainId, source, destination, class: classType },
      validateStatus: () => true,
    }).then(res => {
      if (res.status === 200) setFareInfo(res.data);
    }).finally(() => setLoadingFare(false));
  }, [trainId, source, destination, classType]);

  const addPassenger = () => {
    if (passengers.length >= 6) return;
    setPassengers([...passengers, { name: '', age: '', gender: 'Male', berthPreference: 'Lower' }]);
  };

  const removePassenger = (i) => {
    if (passengers.length === 1) return;
    setPassengers(passengers.filter((_, idx) => idx !== i));
  };

  const update = (i, field, value) => {
    const updated = [...passengers];
    updated[i][field] = value;
    setPassengers(updated);
  };

  const totalFare = (fareInfo?.selectedFare?.totalFare || 0) * passengers.length;

  const handleProceedToPayment = (e) => {
    e.preventDefault();
    setError('');

    // Validate all passengers
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.name.trim()) { setError(`Passenger ${i + 1}: Name is required`); return; }
      if (!p.age || p.age < 1 || p.age > 120) { setError(`Passenger ${i + 1}: Valid age required`); return; }
    }

    // Store booking data in sessionStorage and go to payment
    sessionStorage.setItem('pendingBooking', JSON.stringify({
      trainId,
      trainName: fareInfo?.trainName || trainId,
      source,
      destination,
      date,
      classType,
      passengers,
      fareInfo,
      totalFare,
    }));
    navigate('/payment');
  };

  return (
    <div className="bt-page">
      {/* ── Header ── */}
      <div className="bt-hero">
        <div className="bt-hero-inner">
          <span className="bt-hero-badge">🎫 BOOK TICKET</span>
          <h1>Enter Passenger Details</h1>
          <p>Step 1 of 2 — Fill passenger info, then proceed to payment</p>
        </div>
      </div>

      <div className="bt-container">
        <div className="bt-layout">

          {/* ── LEFT: Passenger Form ── */}
          <div className="bt-main">
            {/* Journey summary */}
            <div className="bt-journey-card">
              <div className="bt-journey-row">
                <div className="bt-journey-station">
                  <span className="bt-station-label">FROM</span>
                  <span className="bt-station-code">{source}</span>
                </div>
                <div className="bt-journey-arrow">
                  <div className="bt-arrow-line" />
                  <span>🚆</span>
                  <div className="bt-arrow-line" />
                </div>
                <div className="bt-journey-station bt-journey-station--right">
                  <span className="bt-station-label">TO</span>
                  <span className="bt-station-code">{destination}</span>
                </div>
              </div>
              <div className="bt-journey-meta">
                <span>📅 {date}</span>
                <span>💺 {classType}</span>
                <span>🚆 {trainId}</span>
                {fareInfo?.trainName && <span>🏷️ {fareInfo.trainName}</span>}
              </div>
            </div>

            {/* Passenger forms */}
            <form onSubmit={handleProceedToPayment}>
              {passengers.map((p, i) => (
                <div key={i} className="bt-passenger-card">
                  <div className="bt-passenger-header">
                    <h3>👤 Passenger {i + 1}</h3>
                    {passengers.length > 1 && (
                      <button type="button" className="bt-remove-btn" onClick={() => removePassenger(i)}>
                        ✕ Remove
                      </button>
                    )}
                  </div>
                  <div className="bt-form-grid">
                    <div className="bt-field bt-field--wide">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        value={p.name}
                        placeholder="As on ID proof"
                        onChange={e => update(i, 'name', e.target.value)}
                        required
                      />
                    </div>
                    <div className="bt-field">
                      <label>Age *</label>
                      <input
                        type="number"
                        value={p.age}
                        placeholder="Age"
                        min="1" max="120"
                        onChange={e => update(i, 'age', e.target.value)}
                        required
                      />
                    </div>
                    <div className="bt-field">
                      <label>Gender *</label>
                      <select value={p.gender} onChange={e => update(i, 'gender', e.target.value)}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="bt-field">
                      <label>Berth Preference</label>
                      <select value={p.berthPreference} onChange={e => update(i, 'berthPreference', e.target.value)}>
                        {BERTH_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              {passengers.length < 6 && (
                <button type="button" className="bt-add-btn" onClick={addPassenger}>
                  + Add Passenger
                </button>
              )}

              {error && <div className="bt-error">⚠️ {error}</div>}

              <button type="submit" className="bt-proceed-btn">
                Proceed to Payment →
              </button>
            </form>
          </div>

          {/* ── RIGHT: Fare Summary ── */}
          <div className="bt-sidebar">
            <div className="bt-fare-card">
              <h3>💰 Fare Summary</h3>
              {loadingFare && <p className="bt-loading">Calculating fare...</p>}
              {fareInfo ? (
                <>
                  <div className="bt-fare-route">
                    <span>{fareInfo.source || source}</span>
                    <span className="bt-fare-arrow">→ {fareInfo.distanceKm} km →</span>
                    <span>{fareInfo.destination || destination}</span>
                  </div>
                  <div className="bt-fare-rows">
                    <div className="bt-fare-row">
                      <span>Base Fare ({fareInfo.selectedClass})</span>
                      <span>₹{fareInfo.selectedFare?.baseFare}</span>
                    </div>
                    <div className="bt-fare-row">
                      <span>Reservation</span>
                      <span>₹{fareInfo.selectedFare?.reservationCharge}</span>
                    </div>
                    {fareInfo.selectedFare?.superfastCharge > 0 && (
                      <div className="bt-fare-row">
                        <span>Superfast</span>
                        <span>₹{fareInfo.selectedFare?.superfastCharge}</span>
                      </div>
                    )}
                    {fareInfo.selectedFare?.trainSurcharge > 0 && (
                      <div className="bt-fare-row">
                        <span>Surcharge</span>
                        <span>₹{fareInfo.selectedFare?.trainSurcharge}</span>
                      </div>
                    )}
                    {fareInfo.selectedFare?.gst > 0 && (
                      <div className="bt-fare-row">
                        <span>GST (5%)</span>
                        <span>₹{fareInfo.selectedFare?.gst}</span>
                      </div>
                    )}
                    <div className="bt-fare-row bt-fare-per">
                      <span>Per Passenger</span>
                      <span>₹{fareInfo.selectedFare?.totalFare}</span>
                    </div>
                    <div className="bt-fare-row bt-fare-total">
                      <span>Total ({passengers.length} pax)</span>
                      <span>₹{totalFare}</span>
                    </div>
                  </div>
                </>
              ) : !loadingFare && (
                <p className="bt-fare-na">Fare details unavailable</p>
              )}
            </div>

            <div className="bt-info-card">
              <h4>📋 Booking Rules</h4>
              <ul>
                <li>Max 6 passengers per booking</li>
                <li>Name must match ID proof</li>
                <li>Age 5–11 charged at child fare</li>
                <li>Cancellation charges apply</li>
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default BookTicket;
