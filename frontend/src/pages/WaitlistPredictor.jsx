import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './WaitlistPredictor.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const CLASS_INFO = {
  '2S': { label: 'Second Sitting', color: '#a0aec0', speed: 'Very Fast' },
  'SL': { label: 'Sleeper',        color: '#48bb78', speed: 'Fast' },
  'CC': { label: 'Chair Car',      color: '#4299e1', speed: 'Moderate' },
  '3A': { label: 'AC 3 Tier',      color: '#667eea', speed: 'Moderate' },
  '2A': { label: 'AC 2 Tier',      color: '#ed8936', speed: 'Slow' },
  '1A': { label: 'AC First Class', color: '#e53e3e', speed: 'Very Slow' },
};

function WaitlistPredictor() {
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    trainNumber:     searchParams.get('train') || '',
    travelDate:      searchParams.get('date')  || '',
    waitlistPosition: '',
    classType:       searchParams.get('class') || 'SL',
  });

  const [result, setResult]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [allClasses, setAllClasses] = useState(null);

  const token = localStorage.getItem('token');

  const predict = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null); setAllClasses(null);
    try {
      const res = await axios.post(`${API_URL}/ai/waitlist-predict`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResult(res.data);

      // Also predict for all classes to show comparison
      const classResults = {};
      await Promise.all(
        Object.keys(CLASS_INFO).map(async (cls) => {
          try {
            const r = await axios.post(`${API_URL}/ai/waitlist-predict`,
              { ...form, classType: cls },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            classResults[cls] = r.data.confirmationProbability;
          } catch { classResults[cls] = 0; }
        })
      );
      setAllClasses(classResults);
    } catch (e) {
      setError(e.response?.data?.error || 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const prob = result?.confirmationProbability || 0;
  const probColor = prob >= 75 ? '#48bb78' : prob >= 45 ? '#ed8936' : '#e53e3e';
  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (prob / 100) * circumference;

  return (
    <div className="container wl-page">
      <div className="wl-header">
        <h1>🎯 AI Waitlist Predictor</h1>
        <p>Find out if your waitlisted ticket will get confirmed using our AI model</p>
      </div>

      <div className="wl-layout">
        {/* ── Input Form ── */}
        <div className="card wl-form-card">
          <h3>Enter Booking Details</h3>
          <form onSubmit={predict}>
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
              <label>Waitlist Position (WL#)</label>
              <input
                type="number"
                min="1"
                max="500"
                value={form.waitlistPosition}
                placeholder="e.g. 12"
                onChange={e => setForm({ ...form, waitlistPosition: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Class</label>
              <div className="class-selector">
                {Object.entries(CLASS_INFO).map(([cls, info]) => (
                  <button
                    key={cls}
                    type="button"
                    className={`class-btn ${form.classType === cls ? 'active' : ''}`}
                    style={{ '--cls-color': info.color }}
                    onClick={() => setForm({ ...form, classType: cls })}
                  >
                    <span className="cls-code">{cls}</span>
                    <span className="cls-speed">{info.speed}</span>
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="error">{error}</div>}

            <button type="submit" className="btn btn-predict" disabled={loading}>
              {loading ? '🔄 Predicting...' : '🎯 Predict Confirmation'}
            </button>
          </form>

          {/* How it works */}
          <div className="how-it-works">
            <h4>How it works</h4>
            <ul>
              <li>📅 More days left = higher chance</li>
              <li>🔢 Lower WL number = higher chance</li>
              <li>🚂 SL clears 4.5× faster than 1A</li>
              <li>📊 Uses logistic regression formula</li>
            </ul>
          </div>
        </div>

        {/* ── Result Panel ── */}
        {result && (
          <div className="wl-result-panel">

            {/* Probability Gauge */}
            <div className="card gauge-card">
              <h3>Confirmation Probability</h3>
              <div className="gauge-wrapper">
                <svg viewBox="0 0 120 120" className="gauge-svg">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="54"
                    fill="none"
                    stroke={probColor}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                  />
                  <text x="60" y="55" textAnchor="middle" fontSize="22" fontWeight="bold" fill={probColor}>
                    {prob}%
                  </text>
                  <text x="60" y="72" textAnchor="middle" fontSize="9" fill="#718096">
                    CONFIRMATION
                  </text>
                </svg>
              </div>

              <div className={`status-badge ${prob >= 75 ? 'high' : prob >= 45 ? 'mid' : 'low'}`}>
                {result.status}
              </div>

              <div className="result-meta">
                <div className="meta-item">
                  <span className="meta-label">Train</span>
                  <span className="meta-value">{result.trainName || result.trainNumber}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">WL Position</span>
                  <span className="meta-value">WL/{result.waitlistPosition}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Days Left</span>
                  <span className="meta-value">{result.daysLeft} days</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Class</span>
                  <span className="meta-value">{result.classType} — {result.classFactor}</span>
                </div>
              </div>

              <div className={`advice-box ${prob >= 75 ? 'high' : prob >= 45 ? 'mid' : 'low'}`}>
                💡 {result.advice}
              </div>
            </div>

            {/* WL Timeline */}
            <div className="card timeline-card">
              <h3>📅 Confirmation Timeline</h3>
              <div className="timeline">
                {[
                  { label: 'Today',       days: 0 },
                  { label: '3 days',      days: 3 },
                  { label: '7 days',      days: 7 },
                  { label: '14 days',     days: 14 },
                  { label: '30 days',     days: 30 },
                ].map(({ label, days }) => {
                  const k = { SL: 1.8, '3A': 1.2, '2A': 0.8, '1A': 0.4, CC: 1.0, '2S': 2.0 }[form.classType] || 1.0;
                  const wl = Math.max(parseInt(form.waitlistPosition) || 1, 1);
                  const exp = k * (days / wl);
                  const p = Math.min(Math.round(1 / (1 + Math.exp(-exp)) * 100), 95);
                  const color = p >= 75 ? '#48bb78' : p >= 45 ? '#ed8936' : '#e53e3e';
                  return (
                    <div key={days} className="timeline-item">
                      <div className="timeline-label">{label}</div>
                      <div className="timeline-bar-wrap">
                        <div className="timeline-bar" style={{ width: `${p}%`, background: color }} />
                      </div>
                      <div className="timeline-pct" style={{ color }}>{p}%</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Class Comparison */}
            {allClasses && (
              <div className="card class-compare-card">
                <h3>📊 Class Comparison (same WL position)</h3>
                <p className="compare-note">How confirmation chance varies by class for WL/{form.waitlistPosition}</p>
                <div className="class-compare-grid">
                  {Object.entries(allClasses)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cls, p]) => {
                      const info = CLASS_INFO[cls];
                      const color = p >= 75 ? '#48bb78' : p >= 45 ? '#ed8936' : '#e53e3e';
                      return (
                        <div key={cls} className={`compare-row ${cls === form.classType ? 'current-class' : ''}`}>
                          <div className="compare-cls" style={{ background: info?.color }}>
                            {cls}
                          </div>
                          <div className="compare-name">{info?.label}</div>
                          <div className="compare-bar-wrap">
                            <div className="compare-bar" style={{ width: `${p}%`, background: color }} />
                          </div>
                          <div className="compare-pct" style={{ color }}>{p}%</div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

export default WaitlistPredictor;
