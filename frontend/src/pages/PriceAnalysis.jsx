import React, { useState, useRef } from 'react';
import axios from 'axios';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import './PriceAnalysis.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const CLASS_OPTIONS = [
  { value: 'SL', label: 'Sleeper (SL)' },
  { value: '3A', label: 'AC 3 Tier (3A)' },
  { value: '2A', label: 'AC 2 Tier (2A)' },
  { value: '1A', label: 'AC First Class (1A)' },
  { value: 'CC', label: 'Chair Car (CC)' },
  { value: '2S', label: 'Second Sitting (2S)' },
];

const TRAIN_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'Exp', label: 'Express' },
  { value: 'SF',  label: 'Superfast' },
  { value: 'Raj', label: 'Rajdhani' },
  { value: 'Sht', label: 'Shatabdi' },
  { value: 'Dur', label: 'Duronto' },
];

const PIE_COLORS = ['#667eea', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const CLASS_COLORS = {
  '2S': '#64748b', 'SL': '#10b981', 'CC': '#3b82f6',
  '3A': '#8b5cf6', '2A': '#f59e0b', '1A': '#ef4444',
};

/* ── Custom Tooltip ── */
const PriceTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="pa-tooltip">
      <p className="pa-tooltip-label">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: ₹{p.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

export default function PriceAnalysis() {
  const [form, setForm] = useState({
    trainNumber: '', travelDate: '', classType: 'SL',
    distanceKm: '', trainType: '',
  });
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [activeTab, setActiveTab] = useState('line');
  const resultRef = useRef(null);

  const analyze = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setResult(null);
    try {
      const res = await axios.post(`${API_URL}/ai/price-analysis`, {
        trainNumber: form.trainNumber,
        travelDate:  form.travelDate,
        classType:   form.classType,
        distanceKm:  form.distanceKm ? parseInt(form.distanceKm) : 0,
      });
      setResult(res.data);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      setError(err.response?.data?.error || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ── Derived data ── */
  const history    = result?.priceHistory  || [];
  const future     = result?.futurePrices  || [];
  const bw         = result?.bookingWindow || {};
  const demand     = result?.demand        || {};
  const classFares = result?.classFares    || {};
  const weekly     = result?.weeklyTrend   || [];
  const typeDist   = result?.trainTypeDist || [];

  const allPrices  = [...history.map(h => h.price), ...future.map(f => f.price)];
  const maxPrice   = allPrices.length ? Math.max(...allPrices) : 0;
  const minPrice   = allPrices.length ? Math.min(...allPrices) : 0;
  const avgPrice   = allPrices.length ? Math.round(allPrices.reduce((a,b)=>a+b,0)/allPrices.length) : 0;

  const cheapestDay = history.length
    ? history.reduce((a, b) => a.price < b.price ? a : b)
    : null;
  const mostExpDay  = history.length
    ? history.reduce((a, b) => a.price > b.price ? a : b)
    : null;

  // Combine history + future for line chart
  const lineData = [
    ...history.map(h => ({ date: h.date.slice(5), price: h.price, type: 'History' })),
    ...future.map(f  => ({ date: f.date.slice(5), forecast: f.price, type: 'Forecast' })),
  ];

  // Class comparison bar data
  const classBarData = Object.entries(classFares)
    .filter(([, v]) => v > 0)
    .map(([cls, price]) => ({ class: cls, price, fill: CLASS_COLORS[cls] || '#667eea' }));

  const urgencyColor = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' }[bw.urgency] || '#3b82f6';
  const demandColor  = { 'Very High': '#ef4444', 'High': '#f59e0b', 'Moderate': '#3b82f6', 'Low': '#10b981' }[demand.demandLevel] || '#94a3b8';

  return (
    <div className="pa-page">
      {/* ── Hero ── */}
      <div className="pa-hero">
        <div className="pa-hero-glow pa-hero-glow--l" />
        <div className="pa-hero-glow pa-hero-glow--r" />
        <div className="pa-hero-inner">
          <span className="pa-hero-badge">📊 PRICE ANALYSIS</span>
          <h1 className="pa-hero-title">Railway Fare Analytics</h1>
          <p className="pa-hero-sub">
            Analyze ticket prices, track trends, compare classes, and find the cheapest day to travel
          </p>
        </div>
      </div>

      <div className="pa-container">

        {/* ── Search Panel ── */}
        <div className="pa-search-panel">
          <form onSubmit={analyze} className="pa-search-form">
            <div className="pa-field">
              <label>TRAIN NUMBER</label>
              <div className="pa-input-wrap">
                <span>🚆</span>
                <input type="text" value={form.trainNumber} placeholder="e.g. 12952"
                  onChange={e => setForm({...form, trainNumber: e.target.value})} required />
              </div>
            </div>

            <div className="pa-field">
              <label>JOURNEY DATE</label>
              <div className="pa-input-wrap">
                <span>📅</span>
                <input type="date" value={form.travelDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm({...form, travelDate: e.target.value})} required />
              </div>
            </div>

            <div className="pa-field">
              <label>CLASS</label>
              <div className="pa-input-wrap">
                <span>💺</span>
                <select value={form.classType} onChange={e => setForm({...form, classType: e.target.value})}>
                  {CLASS_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>

            <div className="pa-field">
              <label>DISTANCE (KM) <span className="pa-opt">optional</span></label>
              <div className="pa-input-wrap">
                <span>📏</span>
                <input type="number" min="50" max="4000" value={form.distanceKm}
                  placeholder="auto-estimated" onChange={e => setForm({...form, distanceKm: e.target.value})} />
              </div>
            </div>

            <button type="submit" className="pa-analyze-btn" disabled={loading}>
              {loading ? <><span className="pa-spin" /> Analyzing...</> : '📊 Analyze Prices'}
            </button>
          </form>
        </div>

        {error && <div className="pa-alert">⚠️ {error}</div>}

        {/* ── Results ── */}
        {result && (
          <div ref={resultRef} className="pa-results">

            {/* Train info bar */}
            <div className="pa-train-bar">
              <div className="pa-train-left">
                <span className="pa-train-num">{result.trainNumber}</span>
                {result.trainName && <span className="pa-train-name">{result.trainName}</span>}
                {result.trainType && <span className="pa-train-type">{result.trainType}</span>}
              </div>
              <div className="pa-train-chips">
                <span className="pa-chip">{result.classType}</span>
                <span className="pa-chip">{result.travelDate}</span>
                <span className="pa-chip pa-chip--purple">Base ₹{result.baseFare}</span>
                <span className="pa-chip">{result.distanceKm} km</span>
              </div>
            </div>

            {/* ── Analytics Cards ── */}
            <div className="pa-cards-grid">
              <div className="pa-card pa-card--green">
                <div className="pa-card-icon">💚</div>
                <div className="pa-card-body">
                  <span className="pa-card-label">Lowest Price</span>
                  <span className="pa-card-value">₹{minPrice.toLocaleString()}</span>
                  {cheapestDay && <span className="pa-card-sub">{cheapestDay.date}</span>}
                </div>
              </div>
              <div className="pa-card pa-card--red">
                <div className="pa-card-icon">🔴</div>
                <div className="pa-card-body">
                  <span className="pa-card-label">Highest Price</span>
                  <span className="pa-card-value">₹{maxPrice.toLocaleString()}</span>
                  {mostExpDay && <span className="pa-card-sub">{mostExpDay.date}</span>}
                </div>
              </div>
              <div className="pa-card pa-card--blue">
                <div className="pa-card-icon">📊</div>
                <div className="pa-card-body">
                  <span className="pa-card-label">Average Price</span>
                  <span className="pa-card-value">₹{avgPrice.toLocaleString()}</span>
                  <span className="pa-card-sub">30-day average</span>
                </div>
              </div>
              <div className="pa-card pa-card--yellow">
                <div className="pa-card-icon">🏷️</div>
                <div className="pa-card-body">
                  <span className="pa-card-label">Best Day to Book</span>
                  <span className="pa-card-value" style={{fontSize:'1rem'}}>{bw.bestDayToBook || '—'}</span>
                  {bw.savingsAmount > 0 && <span className="pa-card-sub">Save ₹{bw.savingsAmount}</span>}
                </div>
              </div>
              <div className="pa-card pa-card--purple">
                <div className="pa-card-icon">📈</div>
                <div className="pa-card-body">
                  <span className="pa-card-label">Demand Level</span>
                  <span className="pa-card-value" style={{color: demandColor, fontSize:'1.1rem'}}>{demand.demandLevel}</span>
                  <span className="pa-card-sub">{demand.occupancyPercent}% occupancy</span>
                </div>
              </div>
              <div className="pa-card pa-card--orange">
                <div className="pa-card-icon">⚡</div>
                <div className="pa-card-body">
                  <span className="pa-card-label">Availability</span>
                  <span className="pa-card-value" style={{fontSize:'1rem'}}>{demand.availabilityTrend}</span>
                  <span className="pa-card-sub">{demand.peakFactors?.join(', ') || 'Normal'}</span>
                </div>
              </div>
            </div>

            {/* Booking window banner */}
            <div className="pa-bw-banner" style={{borderColor: urgencyColor}}>
              <span className="pa-bw-icon" style={{color: urgencyColor}}>
                {bw.urgency === 'high' ? '🔴' : bw.urgency === 'medium' ? '⚠️' : '✅'}
              </span>
              <div className="pa-bw-text">
                <strong>Booking Recommendation</strong>
                <p>{bw.recommendation}</p>
              </div>
              {bw.savingsAmount > 0 && (
                <div className="pa-bw-save" style={{background: urgencyColor}}>
                  Save ₹{bw.savingsAmount}
                </div>
              )}
            </div>

            {/* ── Charts ── */}
            <div className="pa-charts-section">
              {/* Chart tabs */}
              <div className="pa-chart-tabs">
                {[
                  { id: 'line',    label: '📈 Price Trend',      desc: '30-day history + 14-day forecast' },
                  { id: 'area',    label: '📉 Weekly Pattern',   desc: 'Average price by day of week' },
                  { id: 'bar',     label: '💺 Class Comparison', desc: 'Fare across all classes' },
                  { id: 'pie',     label: '🥧 Train Types',      desc: 'Distribution of train categories' },
                ].map(t => (
                  <button key={t.id}
                    className={`pa-chart-tab ${activeTab === t.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(t.id)}>
                    <span>{t.label}</span>
                    <span className="pa-tab-desc">{t.desc}</span>
                  </button>
                ))}
              </div>

              <div className="pa-chart-box">

                {/* Line Chart — Price Trend */}
                {activeTab === 'line' && (
                  <div>
                    <h3 className="pa-chart-title">📈 Price Trend — History & Forecast</h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={lineData} margin={{top:10, right:20, left:10, bottom:5}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="date" tick={{fontSize:11, fill:'#94a3b8'}}
                          interval={Math.floor(lineData.length / 8)} />
                        <YAxis tick={{fontSize:11, fill:'#94a3b8'}}
                          tickFormatter={v => `₹${v}`} />
                        <Tooltip content={<PriceTooltip />} />
                        <Legend />
                        <Line type="monotone" dataKey="price" name="History"
                          stroke="#667eea" strokeWidth={2.5} dot={false}
                          activeDot={{r:5}} />
                        <Line type="monotone" dataKey="forecast" name="Forecast"
                          stroke="#f59e0b" strokeWidth={2.5} dot={false}
                          strokeDasharray="6 3" activeDot={{r:5}} />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="pa-chart-legend">
                      <span><span className="pa-dot" style={{background:'#667eea'}} />Historical Price</span>
                      <span><span className="pa-dot" style={{background:'#f59e0b'}} />Forecasted Price</span>
                    </div>
                  </div>
                )}

                {/* Area Chart — Weekly Pattern */}
                {activeTab === 'area' && (
                  <div>
                    <h3 className="pa-chart-title">📉 Weekly Price Pattern</h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={weekly} margin={{top:10, right:20, left:10, bottom:5}}>
                        <defs>
                          <linearGradient id="weekGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#667eea" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#667eea" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="day" tick={{fontSize:12, fill:'#94a3b8'}} />
                        <YAxis tick={{fontSize:11, fill:'#94a3b8'}} tickFormatter={v => `₹${v}`} />
                        <Tooltip content={<PriceTooltip />} />
                        <Area type="monotone" dataKey="avgPrice" name="Avg Price"
                          stroke="#667eea" strokeWidth={2.5}
                          fill="url(#weekGrad)" activeDot={{r:6}} />
                      </AreaChart>
                    </ResponsiveContainer>
                    <p className="pa-chart-note">
                      💡 Weekends (Sat/Sun) typically have higher fares due to increased demand
                    </p>
                  </div>
                )}

                {/* Bar Chart — Class Comparison */}
                {activeTab === 'bar' && (
                  <div>
                    <h3 className="pa-chart-title">💺 Class-wise Fare Comparison</h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={classBarData} margin={{top:10, right:20, left:10, bottom:5}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="class" tick={{fontSize:13, fill:'#475569', fontWeight:700}} />
                        <YAxis tick={{fontSize:11, fill:'#94a3b8'}} tickFormatter={v => `₹${v}`} />
                        <Tooltip content={<PriceTooltip />} />
                        <Bar dataKey="price" name="Fare" radius={[6,6,0,0]}>
                          {classBarData.map((entry, i) => (
                            <Cell key={i} fill={entry.fill}
                              opacity={entry.class === result.classType ? 1 : 0.65} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="pa-class-legend">
                      {classBarData.map(c => (
                        <div key={c.class} className={`pa-cls-item ${c.class === result.classType ? 'active' : ''}`}>
                          <span className="pa-cls-dot" style={{background: c.fill}} />
                          <span className="pa-cls-name">{c.class}</span>
                          <span className="pa-cls-price">₹{c.price.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pie Chart — Train Type Distribution */}
                {activeTab === 'pie' && (
                  <div>
                    <h3 className="pa-chart-title">🥧 Train Category Distribution</h3>
                    <div className="pa-pie-layout">
                      <ResponsiveContainer width="55%" height={300}>
                        <PieChart>
                          <Pie data={typeDist} cx="50%" cy="50%"
                            innerRadius={70} outerRadius={120}
                            paddingAngle={3} dataKey="value"
                            label={({name, percent}) => `${name} ${(percent*100).toFixed(0)}%`}
                            labelLine={false}>
                            {typeDist.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => [`${v}%`, 'Share']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pa-pie-legend">
                        {typeDist.map((t, i) => (
                          <div key={i} className="pa-pie-item">
                            <span className="pa-pie-dot" style={{background: PIE_COLORS[i % PIE_COLORS.length]}} />
                            <span className="pa-pie-name">{t.name}</span>
                            <span className="pa-pie-val">{t.value}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* ── Demand detail ── */}
            {demand.peakFactors?.length > 0 && (
              <div className="pa-demand-row">
                <span className="pa-demand-title">⚡ Peak Factors:</span>
                {demand.peakFactors.map((f, i) => (
                  <span key={i} className="pa-peak-tag">{f}</span>
                ))}
              </div>
            )}

          </div>
        )}

        {/* Empty state */}
        {!result && !loading && (
          <div className="pa-empty">
            <div className="pa-empty-icon">📊</div>
            <h3>Enter Train Details to Analyze</h3>
            <p>Get 30-day price history, 14-day forecast, class comparison, and weekly patterns</p>
            <div className="pa-empty-features">
              {['📈 Price Trend', '💺 Class Comparison', '📉 Weekly Pattern', '🥧 Train Types'].map(f => (
                <span key={f} className="pa-empty-feat">{f}</span>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
