import React, { useState } from 'react';
import axios from 'axios';
import './AIFeatures.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const FEATURES = [
  { id: 'waitlist',  icon: '🎯', label: 'Waitlist Predictor' },
  { id: 'route',     icon: '🗺️', label: 'Route Optimizer' },
  { id: 'upgrade',   icon: '⬆️', label: 'Seat Upgrade' },
  { id: 'seat',      icon: '💺', label: 'Seat Recommender' },
  { id: 'price',     icon: '📊', label: 'Price Analysis' },
  { id: 'swap',      icon: '🔄', label: 'Seat Swap' },
];

function AIFeatures() {
  const [active, setActive] = useState('waitlist');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  const call = async (endpoint, body) => {
    setLoading(true); setResult(null); setError('');
    try {
      const res = await axios.post(`${API_URL}/ai/${endpoint}`, body, { headers });
      setResult(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Forms ──────────────────────────────────────────────────────────────────
  const [waitlistForm, setWaitlistForm] = useState({ trainNumber: '', travelDate: '', waitlistPosition: '', classType: 'SL', quota: 'GNWL' });
  const [routeForm, setRouteForm]       = useState({ sourceCode: '', destinationCode: '', travelDate: '' });
  const [upgradeForm, setUpgradeForm]   = useState({ trainNumber: '', travelDate: '', classType: 'SL' });
  const [seatForm, setSeatForm]         = useState({ trainNumber: '', preferences: [] });
  const [priceForm, setPriceForm]       = useState({ trainNumber: '', travelDate: '', classType: 'SL' });
  const [swapForm, setSwapForm]         = useState({ trainNumber: '', currentSeat: '', desiredSeatType: '', travelDate: '' });

  const togglePref = (pref) => {
    const prefs = seatForm.preferences.includes(pref)
      ? seatForm.preferences.filter(p => p !== pref)
      : [...seatForm.preferences, pref];
    setSeatForm({ ...seatForm, preferences: prefs });
  };

  // ── Result Renderers ───────────────────────────────────────────────────────
  const renderWaitlist = (r) => (
    <div className="result-structured">
      <div className={`prob-circle ${r.confirmationProbability >= 75 ? 'high' : r.confirmationProbability >= 45 ? 'mid' : 'low'}`}>
        <span className="prob-value">{r.confirmationProbability}%</span>
        <span className="prob-label">Confirmation</span>
      </div>
      <div className="result-details">
        <p><strong>Status:</strong> {r.status}</p>
        <p><strong>Risk Level:</strong> <span style={{ color: r.riskLevel === 'Low' ? '#276749' : r.riskLevel === 'Medium' ? '#c05621' : '#c53030', fontWeight: 700 }}>{r.riskLevel || '—'}</span></p>
        <p><strong>RAC Probability:</strong> {r.racProbability || '—'}%</p>
        <p><strong>Confidence:</strong> {r.confidenceScore || '—'}%</p>
        <p><strong>Days Left:</strong> {r.daysLeft}</p>
        <p><strong>Expected Confirmation:</strong> {r.expectedConfirmationTime || '—'}</p>
        <p><strong>Demand:</strong> {r.demandLevel || '—'}</p>
        <p><strong>Class Factor:</strong> {r.classFactor}</p>
        <p className="advice-text">💡 {r.advice}</p>
        {r.engine === 'ml' && <p style={{ fontSize: '0.75rem', color: '#a0aec0', marginTop: 8 }}>🤖 Powered by ML ensemble model</p>}
      </div>
      {r.explanation && r.explanation.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <strong style={{ fontSize: '0.85rem', color: '#4a5568' }}>🔍 Key Factors:</strong>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {r.explanation.slice(0, 5).map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
                <span style={{ color: item.direction === 'positive' ? '#276749' : '#c53030', fontWeight: 700, width: 20 }}>
                  {item.direction === 'positive' ? '▲' : '▼'}
                </span>
                <span style={{ flex: 1, color: '#4a5568' }}>{item.label}</span>
                <span style={{ color: item.direction === 'positive' ? '#276749' : '#c53030', fontWeight: 600 }}>
                  {item.direction === 'positive' ? '+' : '-'}{item.impact.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderRoute = (r) => (
    <div className="result-structured">
      <div className={`ai-rec-banner ${r.recommendation?.type}`}>
        <p>{r.recommendation?.message}</p>
        {r.recommendation?.confirmationChance > 0 &&
          <span className="confidence-badge">{r.recommendation.confirmationChance}% chance</span>}
      </div>
      {r.directTrains?.length > 0 && (
        <div className="route-section">
          <h4>✅ Direct Trains ({r.directTrains.length})</h4>
          {r.directTrains.slice(0, 3).map((t, i) => (
            <div key={i} className="route-leg">
              <span>{t.train_number} — {t.train_name}</span>
              <span>{t.departure_time} → {t.arrival_time}</span>
            </div>
          ))}
        </div>
      )}
      {r.connectingRoutes?.length > 0 && (
        <div className="route-section">
          <h4>🔗 Connecting Routes</h4>
          {r.connectingRoutes.map((c, i) => (
            <div key={i} className="route-option">
              <p className="route-note">{c.note}</p>
              {c.legs?.map((leg, j) => (
                <div key={j} className="route-leg">
                  <span>{leg.train_name}</span>
                  <span>{leg.source_station} → {leg.destination_station}</span>
                  <span>₹{leg.fare}</span>
                </div>
              ))}
              <p className="route-total">Total: ₹{c.total_fare}</p>
            </div>
          ))}
        </div>
      )}
      {r.splitBookingOptions?.length > 0 && (
        <div className="route-section">
          <h4>✂️ Split Booking</h4>
          {r.splitBookingOptions.map((s, i) => (
            <div key={i} className="route-option">
              <p className="route-note">{s.note}</p>
              <div className="route-leg"><span>{s.leg1?.from} → {s.leg1?.to}</span><span>₹{s.leg1?.fare}</span></div>
              <div className="route-leg"><span>{s.leg2?.from} → {s.leg2?.to}</span><span>₹{s.leg2?.fare}</span></div>
              <p className="route-total">Total: ₹{s.total_fare}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderUpgrade = (r) => (
    <div className="result-structured">
      {r.hasSuggestions ? r.suggestions.map((s, i) => (
        <div key={i} className="upgrade-card">
          <div className="upgrade-header">
            <span className="class-badge current">{s.currentClass}</span>
            <span className="upgrade-arrow">→</span>
            <span className="class-badge upgrade">{s.upgradeClass}</span>
          </div>
          <p className="upgrade-msg">{s.message}</p>
          <p className="upgrade-diff">+₹{s.priceDifference} | {s.upgradeAvailability} seats available</p>
        </div>
      )) : <p>No upgrade suggestions available for this class/train.</p>}
    </div>
  );

  const renderGeneric = (r) => (
    <pre className="result-json">{JSON.stringify(r, null, 2)}</pre>
  );

  const renderPriceAnalysis = (r) => {
    // Backend returns: priceHistory[], futurePrices[], bookingWindow{}, demand{}
    const history  = (r.priceHistory  || []).slice(-30);
    const forecast = r.futurePrices   || [];
    const bw       = r.bookingWindow  || {};
    const demand   = r.demand         || {};

    const allPrices = [...history.map(h => h.price), ...forecast.map(f => f.price)];
    const maxPrice  = Math.max(...allPrices, 1);
    const minPrice  = Math.min(...allPrices, bw.lowestPrice || Infinity);
    const avgPrice  = allPrices.length
      ? Math.round(allPrices.reduce((a, b) => a + b, 0) / allPrices.length)
      : 0;

    const urgencyColor = { high: 'red', medium: 'orange', low: 'green' }[bw.urgency] || 'blue';
    const urgencyIcon  = { high: '🔴', medium: '⚠️', low: '✅' }[bw.urgency] || '🔵';

    const demandColor = {
      'Very High': '#e53e3e', 'High': '#ed8936',
      'Moderate': '#4299e1', 'Low': '#48bb78',
    }[demand.demandLevel] || '#a0aec0';

    return (
      <div className="price-analysis-result">

        {/* Stats row */}
        <div className="price-stats-grid">
          <div className="price-stat current">
            <span className="stat-label">Current Price</span>
            <span className="stat-value">₹{bw.currentPrice || r.baseFare || '—'}</span>
          </div>
          <div className="price-stat">
            <span className="stat-label">Lowest</span>
            <span className="stat-value green">₹{Math.min(minPrice, bw.lowestPrice || minPrice)}</span>
          </div>
          <div className="price-stat">
            <span className="stat-label">Highest</span>
            <span className="stat-value red">₹{maxPrice}</span>
          </div>
          <div className="price-stat">
            <span className="stat-label">Average</span>
            <span className="stat-value">₹{avgPrice}</span>
          </div>
        </div>

        {/* Booking window */}
        <div className={`booking-window-badge bw-${urgencyColor}`}>
          <span className="bw-icon">{urgencyIcon}</span>
          <div>
            <strong>Best day to book: {bw.bestDayToBook}</strong>
            <p>{bw.recommendation}</p>
          </div>
          {bw.savingsAmount > 0 && (
            <span className="bw-days">Save ₹{bw.savingsAmount}</span>
          )}
        </div>

        {/* Demand */}
        {demand.demandLevel && (
          <div style={{ padding: '12px 16px', background: '#f7fafc', borderRadius: 10, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: demandColor }}>{demand.demandLevel} Demand</span>
            <span style={{ color: '#718096', fontSize: '0.85rem' }}>Occupancy: {demand.occupancyPercent}%</span>
            <span style={{ color: '#718096', fontSize: '0.85rem' }}>{demand.availabilityTrend}</span>
            {(demand.peakFactors || []).map((f, i) => (
              <span key={i} style={{ padding: '2px 8px', background: '#faf5ff', color: '#6b46c1', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600 }}>{f}</span>
            ))}
          </div>
        )}

        {/* Price history chart */}
        {history.length > 0 && (
          <div className="price-chart-section">
            <h4>📊 Price History — Last 30 Days</h4>
            <div className="price-bar-chart">
              {history.map((h, i) => {
                const heightPct = Math.max(Math.round((h.price / maxPrice) * 100), 4);
                const d = new Date(h.date);
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const barClass = isWeekend ? 'bar-weekend' : i === history.length - 1 ? 'bar-current' : 'bar-normal';
                return (
                  <div key={i} className="bar-col" title={`${h.date}: ₹${h.price}`}>
                    <div className={`price-bar ${barClass}`} style={{ height: `${heightPct}%` }} />
                    {i % 7 === 0 && (
                      <span className="bar-date-label">
                        {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="chart-legend">
              <span className="legend-item"><span className="legend-dot normal" />Normal</span>
              <span className="legend-item"><span className="legend-dot weekend" />Weekend</span>
              <span className="legend-item"><span className="legend-dot current" />Today</span>
            </div>
          </div>
        )}

        {/* Forecast chart */}
        {forecast.length > 0 && (
          <div className="price-chart-section">
            <h4>🔮 Price Forecast — Next {forecast.length} Days</h4>
            <div className="price-bar-chart forecast-chart">
              {forecast.map((f, i) => {
                const fMax = Math.max(...forecast.map(x => x.price), 1);
                const heightPct = Math.max(Math.round((f.price / fMax) * 100), 4);
                return (
                  <div key={i} className="bar-col" title={`${f.date}: ₹${f.price}`}>
                    <div className="price-bar bar-forecast" style={{ height: `${heightPct}%` }} />
                    {i % 3 === 0 && (
                      <span className="bar-date-label">
                        {new Date(f.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recommendation */}
        <div className="price-recommendation">
          <span className="rec-icon">💡</span>
          <p>{bw.recommendation || 'Analyze a train to get booking recommendations.'}</p>
        </div>

      </div>
    );
  };

  const renderResult = () => {
    if (!result) return null;
    if (active === 'waitlist') return renderWaitlist(result);
    if (active === 'route')    return renderRoute(result);
    if (active === 'upgrade')  return renderUpgrade(result);
    if (active === 'price')    return renderPriceAnalysis(result);
    return renderGeneric(result);
  };

  return (
    <div className="container ai-features-page">
      <div className="card">
        <h2>🤖 AI-Powered Features</h2>

        {/* Feature Tabs */}
        <div className="ai-tabs">
          {FEATURES.map(f => (
            <button
              key={f.id}
              className={`ai-tab ${active === f.id ? 'active' : ''}`}
              onClick={() => { setActive(f.id); setResult(null); setError(''); }}
            >
              {f.icon} {f.label}
            </button>
          ))}
        </div>

        {/* Forms */}
        <div className="feature-form">

          {active === 'waitlist' && (
            <>
              <h3>🎯 Waitlist Confirmation Predictor</h3>
              <p className="feature-desc">ML-powered prediction using ensemble model — GradientBoosting + RandomForest + LogisticRegression.</p>
              <form onSubmit={(e) => { e.preventDefault(); call('waitlist-predict', waitlistForm); }}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Train Number</label>
                    <input type="text" value={waitlistForm.trainNumber} placeholder="e.g. 12952"
                      onChange={e => setWaitlistForm({...waitlistForm, trainNumber: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Waitlist Position (WL#)</label>
                    <input type="number" min="1" max="500" value={waitlistForm.waitlistPosition} placeholder="e.g. 12"
                      onChange={e => setWaitlistForm({...waitlistForm, waitlistPosition: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Travel Date</label>
                    <input type="date" value={waitlistForm.travelDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setWaitlistForm({...waitlistForm, travelDate: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Class</label>
                    <select value={waitlistForm.classType} onChange={e => setWaitlistForm({...waitlistForm, classType: e.target.value})}>
                      <option value="SL">Sleeper (SL)</option>
                      <option value="3A">AC 3 Tier (3A)</option>
                      <option value="2A">AC 2 Tier (2A)</option>
                      <option value="1A">AC First Class (1A)</option>
                      <option value="CC">Chair Car (CC)</option>
                      <option value="2S">Second Sitting (2S)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Booking Quota</label>
                    <select value={waitlistForm.quota} onChange={e => setWaitlistForm({...waitlistForm, quota: e.target.value})}>
                      <option value="GNWL">GNWL — General Waitlist</option>
                      <option value="PQWL">PQWL — Pooled Quota</option>
                      <option value="RLWL">RLWL — Remote Location</option>
                      <option value="TQWL">TQWL — Tatkal Quota</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn btn-ai" disabled={loading}>{loading ? 'Predicting...' : '🎯 Predict Confirmation'}</button>
              </form>
            </>
          )}

          {active === 'route' && (
            <>
              <h3>🗺️ Route Optimizer</h3>
              <p className="feature-desc">Finds direct trains, connecting routes, and split-booking options. If direct trains are full, AI finds the best alternative path.</p>
              <form onSubmit={(e) => { e.preventDefault(); call('route-optimizer', routeForm); }}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>From Station Code</label>
                    <input type="text" value={routeForm.sourceCode} placeholder="e.g. NDLS"
                      onChange={e => setRouteForm({...routeForm, sourceCode: e.target.value.toUpperCase()})} required />
                  </div>
                  <div className="form-group">
                    <label>To Station Code</label>
                    <input type="text" value={routeForm.destinationCode} placeholder="e.g. BCT"
                      onChange={e => setRouteForm({...routeForm, destinationCode: e.target.value.toUpperCase()})} required />
                  </div>
                  <div className="form-group">
                    <label>Travel Date</label>
                    <input type="date" value={routeForm.travelDate}
                      onChange={e => setRouteForm({...routeForm, travelDate: e.target.value})} required />
                  </div>
                </div>
                <button type="submit" className="btn btn-ai" disabled={loading}>{loading ? 'Optimizing...' : '🗺️ Find Best Route'}</button>
              </form>
            </>
          )}

          {active === 'upgrade' && (
            <>
              <h3>⬆️ Smart Seat Upgrade</h3>
              <p className="feature-desc">AI detects when upgrading to a higher class gives better value — more availability for a small price difference.</p>
              <form onSubmit={(e) => { e.preventDefault(); call('seat-upgrade', upgradeForm); }}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Train Number</label>
                    <input type="text" value={upgradeForm.trainNumber} placeholder="e.g. 12952"
                      onChange={e => setUpgradeForm({...upgradeForm, trainNumber: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Current Class</label>
                    <select value={upgradeForm.classType} onChange={e => setUpgradeForm({...upgradeForm, classType: e.target.value})}>
                      <option value="2S">Second Sitting (2S)</option>
                      <option value="SL">Sleeper (SL)</option>
                      <option value="CC">Chair Car (CC)</option>
                      <option value="3A">AC 3 Tier (3A)</option>
                      <option value="2A">AC 2 Tier (2A)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Travel Date</label>
                    <input type="date" value={upgradeForm.travelDate}
                      onChange={e => setUpgradeForm({...upgradeForm, travelDate: e.target.value})} required />
                  </div>
                </div>
                <button type="submit" className="btn btn-ai" disabled={loading}>{loading ? 'Analyzing...' : '⬆️ Check Upgrades'}</button>
              </form>
            </>
          )}

          {active === 'seat' && (
            <>
              <h3>💺 Smart Seat Recommendation</h3>
              <form onSubmit={(e) => { e.preventDefault(); call('seat-recommend', seatForm); }}>
                <div className="form-group">
                  <label>Train Number</label>
                  <input type="text" value={seatForm.trainNumber}
                    onChange={e => setSeatForm({...seatForm, trainNumber: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Preferences</label>
                  <div className="checkbox-group">
                    {['window', 'lower', 'family'].map(p => (
                      <label key={p}>
                        <input type="checkbox" checked={seatForm.preferences.includes(p)} onChange={() => togglePref(p)} />
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" className="btn btn-ai" disabled={loading}>{loading ? 'Analyzing...' : '💺 Get Recommendations'}</button>
              </form>
            </>
          )}

          {active === 'price' && (
            <>
              <h3>📊 Dynamic Price Analysis</h3>
              <form onSubmit={(e) => { e.preventDefault(); call('price-analysis', priceForm); }}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Train Number</label>
                    <input type="text" value={priceForm.trainNumber}
                      onChange={e => setPriceForm({...priceForm, trainNumber: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Travel Date</label>
                    <input type="date" value={priceForm.travelDate}
                      onChange={e => setPriceForm({...priceForm, travelDate: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Class</label>
                    <select value={priceForm.classType} onChange={e => setPriceForm({...priceForm, classType: e.target.value})}>
                      <option value="SL">Sleeper</option>
                      <option value="3A">AC 3 Tier</option>
                      <option value="2A">AC 2 Tier</option>
                      <option value="1A">AC First Class</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn btn-ai" disabled={loading}>{loading ? 'Analyzing...' : '📊 Analyze Price'}</button>
              </form>
            </>
          )}

          {active === 'swap' && (
            <>
              <h3>🔄 Seat Swap Platform</h3>
              <form onSubmit={(e) => { e.preventDefault(); call('seat-swap', swapForm); }}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Train Number</label>
                    <input type="text" value={swapForm.trainNumber}
                      onChange={e => setSwapForm({...swapForm, trainNumber: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Your Current Seat</label>
                    <input type="text" value={swapForm.currentSeat} placeholder="e.g. 32"
                      onChange={e => setSwapForm({...swapForm, currentSeat: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Desired Seat Type</label>
                    <input type="text" value={swapForm.desiredSeatType} placeholder="e.g. lower"
                      onChange={e => setSwapForm({...swapForm, desiredSeatType: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Travel Date</label>
                    <input type="date" value={swapForm.travelDate}
                      onChange={e => setSwapForm({...swapForm, travelDate: e.target.value})} required />
                  </div>
                </div>
                <button type="submit" className="btn btn-ai" disabled={loading}>{loading ? 'Finding...' : '🔄 Find Swap Matches'}</button>
              </form>
            </>
          )}

          {error && <div className="error">{error}</div>}
        </div>

        {/* Result Panel */}
        {result && (
          <div className="result-panel">
            <h3>Results</h3>
            {renderResult()}
          </div>
        )}
      </div>
    </div>
  );
}

export default AIFeatures;
