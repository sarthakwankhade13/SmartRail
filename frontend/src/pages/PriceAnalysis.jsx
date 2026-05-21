import React, { useState } from 'react';
import axios from 'axios';
import './PriceAnalysis.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const CLASS_OPTIONS = [
  { value: 'SL', label: 'Sleeper (SL)' },
  { value: '3A', label: 'AC 3 Tier (3A)' },
  { value: '2A', label: 'AC 2 Tier (2A)' },
  { value: '1A', label: 'AC First Class (1A)' },
  { value: 'CC', label: 'Chair Car (CC)' },
];

function PriceAnalysis() {
  const [form, setForm] = useState({ trainNumber: '', travelDate: '', classType: 'SL' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');

  const analyze = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await axios.post(`${API_URL}/ai/price-analysis`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container pa-page">
      <div className="pa-header">
        <h1>📊 Price Analysis</h1>
        <p>Track fare trends, get price forecasts, and find the best time to book</p>
      </div>

      <div className="pa-layout">
        {/* ── Input Form ── */}
        <div className="card pa-form-card">
          <h3>Enter Journey Details</h3>
          <form onSubmit={analyze}>
            <div className="form-group">
              <label>Train Number</label>
              <input
                type="text"
                value={form.trainNumber}
                placeholder="e.g. 12952"
                onChange={e => setForm({ ...form, trainNumber: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Travel Date</label>
              <input
                type="date"
                value={form.travelDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setForm({ ...form, travelDate: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Class</label>
              <select
                value={form.classType}
                onChange={e => setForm({ ...form, classType: e.target.value })}
              >
                {CLASS_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {error && <div className="error">{error}</div>}

            <button type="submit" className="btn btn-analyze" disabled={loading}>
              {loading ? '🔄 Analyzing...' : '📊 Analyze Price'}
            </button>
          </form>

          <div className="pa-info-box">
            <h4>What you get</h4>
            <ul>
              <li>📈 30-day price history chart</li>
              <li>🔮 14-day price forecast</li>
              <li>🏷️ Best day to book & savings</li>
              <li>📉 Demand level & occupancy</li>
            </ul>
          </div>
        </div>

        {/* ── Results ── */}
        {result && <PriceResult data={result} classType={form.classType} />}
      </div>
    </div>
  );
}

function PriceResult({ data, classType }) {
  const history = data.priceHistory || [];
  const future  = data.futurePrices || [];
  const bw      = data.bookingWindow || {};
  const demand  = data.demand || {};

  const allPrices = [...history.map(h => h.price), ...future.map(f => f.price)];
  const maxPrice  = Math.max(...allPrices, 1);
  const minPrice  = Math.min(...allPrices);
  const avgPrice  = allPrices.length ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length) : 0;

  const urgencyColor = { high: 'red', medium: 'orange', low: 'green' }[bw.urgency] || 'blue';
  const urgencyIcon  = { high: '🔴', medium: '⚠️', low: '✅' }[bw.urgency] || '🔵';

  const demandColor = {
    'Very High': '#e53e3e',
    'High':      '#ed8936',
    'Moderate':  '#4299e1',
    'Low':       '#48bb78',
  }[demand.demandLevel] || '#a0aec0';

  return (
    <div className="pa-result-panel">

      {/* Train info header */}
      <div className="card pa-train-header">
        <div className="pa-train-info">
          <span className="pa-train-number">{data.trainNumber}</span>
          {data.trainName && <span className="pa-train-name">{data.trainName}</span>}
        </div>
        <div className="pa-meta-chips">
          <span className="pa-chip">{classType}</span>
          <span className="pa-chip">{data.travelDate}</span>
          <span className="pa-chip base-fare">Base ₹{data.baseFare}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="card pa-stats-grid">
        <div className="pa-stat">
          <span className="pa-stat-label">Current Price</span>
          <span className="pa-stat-value">{bw.currentPrice ? `₹${bw.currentPrice}` : `₹${data.baseFare}`}</span>
        </div>
        <div className="pa-stat green">
          <span className="pa-stat-label">Lowest</span>
          <span className="pa-stat-value">₹{Math.min(minPrice, bw.lowestPrice || minPrice)}</span>
        </div>
        <div className="pa-stat red">
          <span className="pa-stat-label">Highest</span>
          <span className="pa-stat-value">₹{maxPrice}</span>
        </div>
        <div className="pa-stat">
          <span className="pa-stat-label">Average</span>
          <span className="pa-stat-value">₹{avgPrice}</span>
        </div>
      </div>

      {/* Booking window */}
      <div className={`card pa-booking-window bw-${urgencyColor}`}>
        <span className="bw-icon">{urgencyIcon}</span>
        <div className="bw-content">
          <strong>Best day to book: {bw.bestDayToBook}</strong>
          <p>{bw.recommendation}</p>
          {bw.savingsAmount > 0 && (
            <span className="bw-savings">Save ₹{bw.savingsAmount}</span>
          )}
        </div>
      </div>

      {/* Demand card */}
      <div className="card pa-demand-card">
        <h3>📉 Demand Analysis</h3>
        <div className="demand-grid">
          <div className="demand-stat">
            <span className="demand-label">Demand Level</span>
            <span className="demand-value" style={{ color: demandColor }}>{demand.demandLevel}</span>
          </div>
          <div className="demand-stat">
            <span className="demand-label">Occupancy</span>
            <div className="occupancy-bar-wrap">
              <div
                className="occupancy-bar"
                style={{ width: `${demand.occupancyPercent}%`, background: demandColor }}
              />
            </div>
            <span className="demand-value" style={{ color: demandColor }}>{demand.occupancyPercent}%</span>
          </div>
          <div className="demand-stat">
            <span className="demand-label">Availability</span>
            <span className="demand-value">{demand.availabilityTrend}</span>
          </div>
        </div>
        {demand.peakFactors?.length > 0 && (
          <div className="peak-factors">
            {demand.peakFactors.map((f, i) => (
              <span key={i} className="peak-tag">{f}</span>
            ))}
          </div>
        )}
      </div>

      {/* Price history chart */}
      {history.length > 0 && (
        <div className="card pa-chart-card">
          <h3>📈 Price History — Last 30 Days</h3>
          <BarChart data={history} maxPrice={maxPrice} colorKey="history" />
          <div className="chart-legend">
            <span className="legend-item"><span className="legend-dot normal" />Normal</span>
            <span className="legend-item"><span className="legend-dot weekend" />Weekend</span>
          </div>
        </div>
      )}

      {/* Price forecast chart */}
      {future.length > 0 && (
        <div className="card pa-chart-card">
          <h3>🔮 Price Forecast — Next 14 Days</h3>
          <BarChart data={future} maxPrice={maxPrice} colorKey="forecast" />
          <div className="chart-legend">
            <span className="legend-item"><span className="legend-dot forecast" />Predicted</span>
          </div>
        </div>
      )}

    </div>
  );
}

function BarChart({ data, maxPrice, colorKey }) {
  return (
    <div className="pa-bar-chart">
      {data.map((item, i) => {
        const heightPct = Math.max(Math.round((item.price / maxPrice) * 100), 4);
        const date = new Date(item.date);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const barClass = colorKey === 'forecast'
          ? 'bar-forecast'
          : isWeekend ? 'bar-weekend' : 'bar-normal';

        return (
          <div
            key={i}
            className="pa-bar-col"
            title={`${item.date}: ₹${item.price}`}
          >
            <div className={`pa-bar ${barClass}`} style={{ height: `${heightPct}%` }} />
            {i % 7 === 0 && (
              <span className="pa-bar-label">
                {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PriceAnalysis;
