import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import './WaitlistPredictor.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const CLASS_INFO = {
  '2S': { label: 'Second Sitting', color: '#64748b', speed: 'Very Fast' },
  'SL': { label: 'Sleeper',        color: '#10b981', speed: 'Fast'      },
  'CC': { label: 'Chair Car',      color: '#3b82f6', speed: 'Moderate'  },
  '3A': { label: 'AC 3 Tier',      color: '#8b5cf6', speed: 'Moderate'  },
  '2A': { label: 'AC 2 Tier',      color: '#f59e0b', speed: 'Slow'      },
  '1A': { label: 'AC First Class', color: '#ef4444', speed: 'Very Slow' },
};

const QUOTA_OPTIONS = [
  { value: 'GNWL', label: 'GNWL — General Waitlist' },
  { value: 'PQWL', label: 'PQWL — Pooled Quota'     },
  { value: 'RLWL', label: 'RLWL — Remote Location'  },
  { value: 'TQWL', label: 'TQWL — Tatkal Quota'     },
];

export default function WaitlistPredictor() {
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    trainNumber:      searchParams.get('train') || '',
    travelDate:       searchParams.get('date')  || '',
    waitlistPosition: '',
    classType:        searchParams.get('class') || 'SL',
    quota:            'GNWL',
    passengerCount:   1,
    ageGroup:         'adult',
    distanceKm:       '',
    bookingDate:      '',
  });

  const [result, setResult]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [allClasses, setAllClasses] = useState(null);

  const token = localStorage.getItem('token');
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const predict = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null); setAllClasses(null);
    try {
      const payload = {
        trainNumber:      form.trainNumber,
        travelDate:       form.travelDate,
        waitlistPosition: form.waitlistPosition,
        classType:        form.classType,
        quota:            form.quota,
        passengerCount:   form.passengerCount,
        ageGroup:         form.ageGroup,
        distanceKm:       form.distanceKm ? parseInt(form.distanceKm) : 500,
        bookingDate:      form.bookingDate || null,
      };
      const res = await axios.post(`${API_URL}/ai/waitlist-predict`, payload, { headers: authHeader });
      setResult(res.data);

      // Class comparison
      const classResults = {};
      await Promise.all(
        Object.keys(CLASS_INFO).map(async (cls) => {
          try {
            const r = await axios.post(`${API_URL}/ai/waitlist-predict`,
              { ...payload, classType: cls },
              { headers: authHeader }
            );
            classResults[cls] = r.data.confirmationProbability;
          } catch { classResults[cls] = 0; }
        })
      );
      setAllClasses(classResults);
    } catch (err) {
      setError(err.response?.data?.error || 'Prediction failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const prob       = result?.confirmationProbability || 0;
  const probColor  = prob >= 75 ? '#10b981' : prob >= 45 ? '#f59e0b' : '#ef4444';
  const circ       = 2 * Math.PI * 52;
  const dashOffset = circ - (prob / 100) * circ;
  const riskClass  = prob >= 75 ? 'low' : prob >= 45 ? 'medium' : 'high';

  return (
    <div className="wl-page">
      {/* ── Hero ── */}
      <div className="wl-hero">
        <div className="wl-hero-glow wl-hero-glow--l" />
        <div className="wl-hero-glow wl-hero-glow--r" />
        <div className="wl-hero-inner">
          <span className="wl-hero-badge">🎯 AI WAITLIST PREDICTOR</span>
          <h1 className="wl-hero-title">Will Your Ticket Confirm?</h1>
          <p className="wl-hero-sub">
            ML ensemble model — GradientBoosting + RandomForest + LogisticRegression
            with 30 engineered features
          </p>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="wl-container">
        <div className="wl-grid">

          {/* ── LEFT: Form ── */}
          <div className="wl-form-panel">
            <div className="wl-form-header">
              <div className="wl-form-icon">🚂</div>
              <div>
                <h2>Enter Booking Details</h2>
                <p>Fill in your waitlisted ticket details</p>
              </div>
            </div>

            <form onSubmit={predict} className="wl-form">

              {/* Train Number */}
              <div className="wl-field">
                <label>TRAIN NUMBER</label>
                <div className="wl-input-wrap">
                  <span className="wl-input-icon">🚆</span>
                  <input
                    type="text"
                    value={form.trainNumber}
                    placeholder="e.g. 12952"
                    onChange={e => setForm({ ...form, trainNumber: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Travel Date */}
              <div className="wl-field">
                <label>TRAVEL DATE</label>
                <div className="wl-input-wrap">
                  <span className="wl-input-icon">📅</span>
                  <input
                    type="date"
                    value={form.travelDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={e => setForm({ ...form, travelDate: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* WL Position */}
              <div className="wl-field">
                <label>WAITLIST POSITION (WL#)</label>
                <div className="wl-input-wrap">
                  <span className="wl-input-icon">🔢</span>
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
              </div>

              {/* Quota + Passengers row */}
              <div className="wl-field-row">
                <div className="wl-field">
                  <label>BOOKING QUOTA</label>
                  <div className="wl-input-wrap">
                    <span className="wl-input-icon">📋</span>
                    <select
                      value={form.quota}
                      onChange={e => setForm({ ...form, quota: e.target.value })}
                    >
                      {QUOTA_OPTIONS.map(q => (
                        <option key={q.value} value={q.value}>{q.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="wl-field">
                  <label>PASSENGERS</label>
                  <div className="wl-input-wrap">
                    <span className="wl-input-icon">👥</span>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={form.passengerCount}
                      onChange={e => setForm({ ...form, passengerCount: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
              </div>

              {/* Age Group + Distance row */}
              <div className="wl-field-row">
                <div className="wl-field">
                  <label>AGE GROUP</label>
                  <div className="wl-input-wrap">
                    <span className="wl-input-icon">🧑</span>
                    <select
                      value={form.ageGroup}
                      onChange={e => setForm({ ...form, ageGroup: e.target.value })}
                    >
                      <option value="adult">Adult (12–59)</option>
                      <option value="senior">Senior (60+)</option>
                      <option value="child">Child (5–11)</option>
                    </select>
                  </div>
                </div>

                <div className="wl-field">
                  <label>DISTANCE (KM) <span className="wl-optional">optional</span></label>
                  <div className="wl-input-wrap">
                    <span className="wl-input-icon">📏</span>
                    <input
                      type="number"
                      min="50"
                      max="4000"
                      value={form.distanceKm}
                      placeholder="e.g. 1400"
                      onChange={e => setForm({ ...form, distanceKm: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Booking Date */}
              <div className="wl-field">
                <label>BOOKING DATE <span className="wl-optional">optional — when you booked</span></label>
                <div className="wl-input-wrap">
                  <span className="wl-input-icon">🗓️</span>
                  <input
                    type="date"
                    value={form.bookingDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setForm({ ...form, bookingDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Class selector */}
              <div className="wl-field">
                <label>CLASS</label>
                <div className="wl-class-grid">
                  {Object.entries(CLASS_INFO).map(([cls, info]) => (
                    <button
                      key={cls}
                      type="button"
                      className={`wl-class-btn ${form.classType === cls ? 'active' : ''}`}
                      style={{ '--cls': info.color }}
                      onClick={() => setForm({ ...form, classType: cls })}
                    >
                      <span className="wl-cls-code">{cls}</span>
                      <span className="wl-cls-speed">{info.speed}</span>
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="wl-error">⚠️ {error}</div>}

              <button type="submit" className="wl-submit-btn" disabled={loading}>
                {loading
                  ? <><span className="wl-spinner" /> Predicting...</>
                  : '🎯 Predict Confirmation'
                }
              </button>
            </form>

            {/* How it works */}
            <div className="wl-how">
              <h4>How it works</h4>
              <ul>
                <li><span>🤖</span> Stacking ensemble ML model</li>
                <li><span>📊</span> 30 engineered features</li>
                <li><span>📅</span> Seasonal &amp; festival intelligence</li>
                <li><span>🔢</span> Quota-aware prediction</li>
                <li><span>💡</span> SHAP-style explanations</li>
              </ul>
            </div>
          </div>

          {/* ── RIGHT: Results ── */}
          {result ? (
            <div className="wl-results">

              {/* Probability card */}
              <div className="wl-card wl-prob-card">
                <div className="wl-prob-top">
                  <div className="wl-gauge-wrap">
                    <svg viewBox="0 0 120 120" className="wl-gauge-svg">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                      <circle
                        cx="60" cy="60" r="52"
                        fill="none"
                        stroke={probColor}
                        strokeWidth="10"
                        strokeDasharray={circ}
                        strokeDashoffset={dashOffset}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                        style={{ transition: 'stroke-dashoffset 1.2s ease' }}
                      />
                      <text x="60" y="56" textAnchor="middle" fontSize="20" fontWeight="800" fill={probColor}>{prob}%</text>
                      <text x="60" y="72" textAnchor="middle" fontSize="8" fill="#94a3b8" fontWeight="600">CONFIRMATION</text>
                    </svg>
                  </div>
                  <div className="wl-prob-info">
                    {result.engine === 'ml' && <span className="wl-ml-badge">🤖 ML Ensemble</span>}
                    <div className={`wl-status-pill ${riskClass}`}>{result.status}</div>
                    <div className="wl-risk-row">
                      <span className="wl-risk-label">Risk:</span>
                      <span className={`wl-risk-val risk-${riskClass}`}>{result.riskLevel}</span>
                    </div>
                    <div className="wl-risk-row">
                      <span className="wl-risk-label">RAC Chance:</span>
                      <span className="wl-risk-val">{result.racProbability}%</span>
                    </div>
                    <div className="wl-risk-row">
                      <span className="wl-risk-label">Confidence:</span>
                      <span className="wl-risk-val">{result.confidenceScore}%</span>
                    </div>
                  </div>
                </div>

                <div className={`wl-advice ${riskClass}`}>
                  💡 {result.advice}
                </div>
              </div>

              {/* Stats grid */}
              <div className="wl-stats-grid">
                {[
                  { label: 'Train',              value: result.trainName || result.trainNumber },
                  { label: 'WL Position',        value: `WL/${result.waitlistPosition}` },
                  { label: 'Days Left',          value: `${result.daysLeft} days` },
                  { label: 'Expected Confirm',   value: result.expectedConfirmationTime || '—' },
                  { label: 'Demand Level',       value: result.demandLevel || '—' },
                  { label: 'Class Factor',       value: result.classFactor || '—' },
                ].map((s, i) => (
                  <div key={i} className="wl-stat-item">
                    <span className="wl-stat-label">{s.label}</span>
                    <span className="wl-stat-value">{s.value}</span>
                  </div>
                ))}
              </div>

              {/* SHAP Explanations */}
              {result.explanation?.length > 0 && (
                <div className="wl-card">
                  <h3 className="wl-card-title">🔍 Why this prediction?</h3>
                  <p className="wl-card-sub">Top factors influencing this result</p>
                  <div className="wl-explain-list">
                    {result.explanation.map((item, i) => (
                      <div key={i} className={`wl-explain-row ${item.direction}`}>
                        <div className="wl-explain-label">{item.label}</div>
                        <div className="wl-explain-track">
                          <div
                            className={`wl-explain-fill ${item.direction}`}
                            style={{ width: `${Math.min(item.impact * 6, 100)}%` }}
                          />
                        </div>
                        <div className={`wl-explain-pct ${item.direction}`}>
                          {item.direction === 'positive' ? '+' : '-'}{item.impact.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              {result.timeline?.length > 0 && (
                <div className="wl-card">
                  <h3 className="wl-card-title">📅 Probability Over Time</h3>
                  <div className="wl-timeline">
                    {result.timeline.map((pt, i) => {
                      const c = pt.probability >= 75 ? '#10b981' : pt.probability >= 45 ? '#f59e0b' : '#ef4444';
                      return (
                        <div key={i} className="wl-tl-row">
                          <div className="wl-tl-label">
                            {pt.daysFromNow === 0 ? 'Today' : `+${pt.daysFromNow}d`}
                          </div>
                          <div className="wl-tl-track">
                            <div className="wl-tl-fill" style={{ width: `${pt.probability}%`, background: c }} />
                          </div>
                          <div className="wl-tl-pct" style={{ color: c }}>{pt.probability}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Class comparison */}
              {allClasses && (
                <div className="wl-card">
                  <h3 className="wl-card-title">📊 Class Comparison</h3>
                  <p className="wl-card-sub">Confirmation chance for WL/{form.waitlistPosition} across classes</p>
                  <div className="wl-compare-list">
                    {Object.entries(allClasses)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cls, p]) => {
                        const info = CLASS_INFO[cls];
                        const c = p >= 75 ? '#10b981' : p >= 45 ? '#f59e0b' : '#ef4444';
                        return (
                          <div key={cls} className={`wl-compare-row ${cls === form.classType ? 'active' : ''}`}>
                            <div className="wl-compare-badge" style={{ background: info?.color }}>{cls}</div>
                            <div className="wl-compare-name">{info?.label}</div>
                            <div className="wl-compare-track">
                              <div className="wl-compare-fill" style={{ width: `${p}%`, background: c }} />
                            </div>
                            <div className="wl-compare-pct" style={{ color: c }}>{p}%</div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

            </div>
          ) : (
            /* Empty state */
            <div className="wl-empty">
              <div className="wl-empty-icon">🎯</div>
              <h3>Ready to Predict</h3>
              <p>Fill in your booking details on the left and click Predict Confirmation to get your ML-powered result.</p>
              <div className="wl-empty-features">
                <div className="wl-empty-feat"><span>📊</span><span>Probability %</span></div>
                <div className="wl-empty-feat"><span>🔍</span><span>SHAP Explanations</span></div>
                <div className="wl-empty-feat"><span>📅</span><span>Timeline Graph</span></div>
                <div className="wl-empty-feat"><span>🚂</span><span>Class Comparison</span></div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
