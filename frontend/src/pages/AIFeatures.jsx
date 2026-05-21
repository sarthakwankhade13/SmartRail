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
  const [waitlistForm, setWaitlistForm] = useState({ trainNumber: '', travelDate: '', waitlistPosition: '', classType: 'SL' });
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
        <p><strong>Days Left:</strong> {r.daysLeft}</p>
        <p><strong>Class Factor:</strong> {r.classFactor}</p>
        <p className="advice-text">💡 {r.advice}</p>
      </div>
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
    const last30 = (r.priceHistory || []).slice(-30);
    const maxPrice = Math.max(...last30.map(h => h.price), r.currentPrice, 1);

    const trendIcon = r.trend === 'up' ? '📈' : r.trend === 'down' ? '📉' : '➡️';
    const trendClass = r.trend === 'up' ? 'trend-up' : r.trend === 'down' ? 'trend-down' : 'trend-stable';

    const windowColor = r.bestBookingWindow?.color || 'blue';

    return (
      <div className="price-analysis-result">

        {/* Festival Alert */}
        {r.festivalAlert && (
          <div className="festival-alert">
            {r.festivalAlert}
          </div>
        )}

        {/* Top stats row */}
        <div className="price-stats-grid">
          <div className="price-stat current">
            <span className="stat-label">Current Price</span>
            <span className="stat-value">₹{r.currentPrice}</span>
            <span className={`stat-trend ${trendClass}`}>{trendIcon} {Math.abs(r.trendPercent)}% vs avg</span>
          </div>
          <div className="price-stat">
            <span className="stat-label">Lowest (90d)</span>
            <span className="stat-value green">₹{r.lowestPrice}</span>
          </div>
          <div className="price-stat">
            <span className="stat-label">Highest (90d)</span>
            <span className="stat-value red">₹{r.highestPrice}</span>
          </div>
          <div className="price-stat">
            <span className="stat-label">30-day Avg</span>
            <span className="stat-value">₹{r.averagePrice}</span>
          </div>
        </div>

        {/* Booking window badge */}
        <div className={`booking-window-badge bw-${windowColor}`}>
          <span className="bw-icon">
            {windowColor === 'green' ? '✅' : windowColor === 'blue' ? '🔵' : windowColor === 'orange' ? '⚠️' : '🔴'}
          </span>
          <div>
            <strong>{r.bestBookingWindow?.badge}</strong>
            <p>{r.bestBookingWindow?.message}</p>
          </div>
          <span className="bw-days">{r.daysLeft}d left</span>
        </div>

        {/* Price history bar chart — last 30 days */}
        <div className="price-chart-section">
          <h4>📊 Price History — Last 30 Days</h4>
          <div className="price-bar-chart">
            {last30.map((h, i) => {
              const heightPct = Math.round((h.price / maxPrice) * 100);
              const isCurrent = i === last30.length - 1;
              const barClass = h.label === 'Festival' ? 'bar-festival'
                : h.label === 'Weekend' ? 'bar-weekend'
                : isCurrent ? 'bar-current'
                : 'bar-normal';
              return (
                <div key={i} className="bar-col" title={`${h.date}: ₹${h.price}${h.label ? ' (' + h.label + ')' : ''}`}>
                  <div
                    className={`price-bar ${barClass}`}
                    style={{ height: `${heightPct}%` }}
                  />
                  {i % 7 === 0 && (
                    <span className="bar-date-label">
                      {new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="chart-legend">
            <span className="legend-item"><span className="legend-dot normal" />Normal</span>
            <span className="legend-item"><span className="legend-dot weekend" />Weekend</span>
            <span className="legend-item"><span className="legend-dot festival" />Festival</span>
            <span className="legend-item"><span className="legend-dot current" />Today</span>
          </div>
        </div>

        {/* Price forecast — next 14 days */}
        {r.priceForecast && r.priceForecast.length > 0 && (
          <div className="price-chart-section">
            <h4>🔮 Price Forecast — Next {r.priceForecast.length} Days</h4>
            <div className="price-bar-chart forecast-chart">
              {r.priceForecast.map((f, i) => {
                const fMax = Math.max(...r.priceForecast.map(x => x.price), 1);
                const heightPct = Math.round((f.price / fMax) * 100);
                const barClass = f.label === 'Festival' ? 'bar-festival'
                  : f.label === 'Weekend' ? 'bar-weekend'
                  : 'bar-forecast';
                return (
                  <div key={i} className="bar-col" title={`${f.date}: ₹${f.price}${f.label ? ' (' + f.label + ')' : ''}`}>
                    <div className={`price-bar ${barClass}`} style={{ height: `${heightPct}%` }} />
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
          <p>{r.recommendation}</p>
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
              <p className="feature-desc">Uses a logistic regression formula with class-sensitivity to predict if your waitlisted ticket will confirm.</p>
              <form onSubmit={(e) => { e.preventDefault(); call('waitlist-predict', waitlistForm); }}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Train Number</label>
                    <input type="text" value={waitlistForm.trainNumber} placeholder="e.g. 12952"
                      onChange={e => setWaitlistForm({...waitlistForm, trainNumber: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Waitlist Position</label>
                    <input type="number" min="1" value={waitlistForm.waitlistPosition}
                      onChange={e => setWaitlistForm({...waitlistForm, waitlistPosition: e.target.value})} required />
                  </div>
                  <div className="form-group">
                    <label>Travel Date</label>
                    <input type="date" value={waitlistForm.travelDate}
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
