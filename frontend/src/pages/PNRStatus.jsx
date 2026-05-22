import React, { useState } from 'react';
import axios from 'axios';
import './PNRStatus.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const STATUS_CONFIG = {
  CONFIRMED:  { label: 'Confirmed',  color: '#15803d', bg: '#f0fdf4', border: '#22c55e', icon: '✅' },
  CNF:        { label: 'Confirmed',  color: '#15803d', bg: '#f0fdf4', border: '#22c55e', icon: '✅' },
  RAC:        { label: 'RAC',        color: '#b45309', bg: '#fffbeb', border: '#f59e0b', icon: '⚠️' },
  WAITLISTED: { label: 'Waitlisted', color: '#be123c', bg: '#fff1f2', border: '#ef4444', icon: '🔴' },
  WL:         { label: 'Waitlisted', color: '#be123c', bg: '#fff1f2', border: '#ef4444', icon: '🔴' },
  UNKNOWN:    { label: 'Unknown',    color: '#64748b', bg: '#f8fafc', border: '#cbd5e1', icon: '❓' },
};

function getStatusConfig(status) {
  const key = (status || '').toUpperCase().split('/')[0];
  return STATUS_CONFIG[key] || STATUS_CONFIG.UNKNOWN;
}

export default function PNRStatus() {
  const [pnr,     setPnr]     = useState('');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [source,  setSource]  = useState('');   // 'live' | 'local'

  const handleSearch = async (e) => {
    e.preventDefault();
    if (pnr.length !== 10 || !/^\d{10}$/.test(pnr)) {
      setError('PNR must be exactly 10 digits');
      return;
    }
    setLoading(true); setError(''); setBooking(null); setSource('');

    // 1. Try live RapidAPI — suppress all console errors silently
    try {
      const res = await axios.get(`${API_URL}/pnr/live/${pnr}`, {
        validateStatus: () => true,
      });
      if (res.status === 200 && res.data?.success) {
        setBooking(res.data);
        setSource('live');
        setLoading(false);
        return;
      }
    } catch (_e) {
      // network error — fall through silently
    }

    // 2. Fall back to local DB
    try {
      const res = await axios.get(`${API_URL}/pnr/${pnr}`, {
        validateStatus: () => true,
      });
      if (res.status === 200) {
        setBooking(res.data);
        setSource('local');
      } else if (res.status === 404) {
        setError('PNR not found. Please check the number and try again.');
      } else {
        setError(res.data?.error || 'Could not fetch PNR status. Please try again.');
      }
    } catch (_e) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const cfg = booking ? getStatusConfig(booking.bookingStatus) : null;

  return (
    <div className="pnr-page">
      {/* ── Hero ── */}
      <div className="pnr-hero">
        <div className="pnr-hero-glow pnr-hero-glow--l" />
        <div className="pnr-hero-glow pnr-hero-glow--r" />
        <div className="pnr-hero-inner">
          <span className="pnr-hero-badge">🎫 PNR STATUS</span>
          <h1 className="pnr-hero-title">Check Your PNR Status</h1>
          <p className="pnr-hero-sub">
            Real-time IRCTC PNR enquiry — live passenger status, seat details, and train info
          </p>
        </div>
      </div>

      <div className="pnr-container">

        {/* ── Search Card ── */}
        <div className="pnr-search-card">
          <form onSubmit={handleSearch} className="pnr-form">
            <div className="pnr-input-group">
              <span className="pnr-input-icon">🎫</span>
              <input
                type="text"
                value={pnr}
                onChange={e => setPnr(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Enter 10-digit PNR number"
                maxLength="10"
                className="pnr-input"
                required
              />
              <span className="pnr-input-count">{pnr.length}/10</span>
            </div>
            <button type="submit" className="pnr-btn" disabled={loading || pnr.length !== 10}>
              {loading
                ? <><span className="pnr-spin" /> Checking...</>
                : '🔍 Check Status'
              }
            </button>
          </form>

          {error && (
            <div className="pnr-error">
              ⚠️ {error}
              {error.includes('not found') && (
                <p className="pnr-error-hint">
                  Only PNRs booked through SmartRail are available locally.
                  For IRCTC PNRs, a valid RapidAPI key is required.
                </p>
              )}
            </div>
          )}

          <div className="pnr-info-row">
            <span>🔴 Live IRCTC data via RapidAPI</span>
            <span>📦 Falls back to local booking records</span>
          </div>
        </div>

        {/* ── Result ── */}
        {booking && cfg && (
          <div className="pnr-result">

            {/* Source badge */}
            <div className="pnr-source-badge">
              {source === 'live'
                ? <span className="pnr-live-badge">🔴 LIVE — Real-time IRCTC data</span>
                : <span className="pnr-local-badge">📦 LOCAL — SmartRail booking record</span>
              }
            </div>

            {/* Status banner */}
            <div className="pnr-status-banner" style={{ background: cfg.bg, borderColor: cfg.border }}>
              <span className="pnr-status-icon">{cfg.icon}</span>
              <div>
                <div className="pnr-status-label" style={{ color: cfg.color }}>
                  {cfg.label}
                </div>
                <div className="pnr-status-raw">{booking.bookingStatus}</div>
              </div>
              {booking.chartPrepared !== undefined && (
                <div className="pnr-chart-badge">
                  {booking.chartPrepared ? '📋 Chart Prepared' : '📋 Chart Not Prepared'}
                </div>
              )}
            </div>

            {/* Journey details grid */}
            <div className="pnr-details-grid">
              <div className="pnr-detail-card">
                <span className="pnr-detail-label">PNR Number</span>
                <span className="pnr-detail-value pnr-mono">{booking.pnrNumber}</span>
              </div>
              <div className="pnr-detail-card">
                <span className="pnr-detail-label">Train</span>
                <span className="pnr-detail-value">
                  {booking.trainNumber}
                  {booking.trainName && <span className="pnr-train-name"> — {booking.trainName}</span>}
                </span>
              </div>
              <div className="pnr-detail-card">
                <span className="pnr-detail-label">From</span>
                <span className="pnr-detail-value">{booking.sourceStation || booking.boardingPoint}</span>
              </div>
              <div className="pnr-detail-card">
                <span className="pnr-detail-label">To</span>
                <span className="pnr-detail-value">{booking.destinationStation}</span>
              </div>
              <div className="pnr-detail-card">
                <span className="pnr-detail-label">Travel Date</span>
                <span className="pnr-detail-value">{booking.travelDate}</span>
              </div>
              <div className="pnr-detail-card">
                <span className="pnr-detail-label">Class</span>
                <span className="pnr-detail-value">{booking.classType}</span>
              </div>
              {booking.totalFare && (
                <div className="pnr-detail-card">
                  <span className="pnr-detail-label">Total Fare</span>
                  <span className="pnr-detail-value">₹{booking.totalFare}</span>
                </div>
              )}
              {booking.passengerCount && (
                <div className="pnr-detail-card">
                  <span className="pnr-detail-label">Passengers</span>
                  <span className="pnr-detail-value">{booking.passengerCount}</span>
                </div>
              )}
            </div>

            {/* Passengers table */}
            {booking.passengers?.length > 0 && (
              <div className="pnr-passengers">
                <h3 className="pnr-section-title">👥 Passenger Status</h3>
                <div className="pnr-table-wrap">
                  <table className="pnr-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        {booking.source !== 'live' && <><th>Name</th><th>Age</th><th>Gender</th></>}
                        <th>Booking Status</th>
                        <th>Current Status</th>
                        <th>Coach / Berth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {booking.passengers.map((p, i) => {
                        const pCfg = getStatusConfig(p.currentStatus || p.bookingStatus);
                        return (
                          <tr key={i}>
                            <td className="pnr-td-num">{p.number || i + 1}</td>
                            {booking.source !== 'live' && (
                              <>
                                <td>{p.name}</td>
                                <td>{p.age}</td>
                                <td>{p.gender}</td>
                              </>
                            )}
                            <td>
                              <span className="pnr-status-pill"
                                style={{ background: pCfg.bg, color: pCfg.color, borderColor: pCfg.border }}>
                                {p.bookingStatus || '—'}
                              </span>
                            </td>
                            <td>
                              <span className="pnr-status-pill"
                                style={{ background: pCfg.bg, color: pCfg.color, borderColor: pCfg.border }}>
                                {pCfg.icon} {p.currentStatus || p.seatNumber || '—'}
                              </span>
                            </td>
                            <td className="pnr-mono">
                              {p.currentCoach && p.currentBerth
                                ? `${p.currentCoach} / ${p.currentBerth}`
                                : p.seatNumber || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* Empty state */}
        {!booking && !loading && !error && (
          <div className="pnr-empty">
            <div className="pnr-empty-icon">🎫</div>
            <h3>Enter Your PNR Number</h3>
            <p>We'll check live IRCTC status first, then fall back to your SmartRail booking records</p>
          </div>
        )}

      </div>
    </div>
  );
}
