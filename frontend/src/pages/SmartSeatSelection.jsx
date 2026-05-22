import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './SmartSeatSelection.css';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/* ── Constants ── */
const PREFERENCES = [
  { id: 'window',     label: 'Window Seat',    icon: '🪟', desc: 'Seat near window' },
  { id: 'lower',      label: 'Lower Berth',    icon: '⬇️', desc: 'Easy to access' },
  { id: 'upper',      label: 'Upper Berth',    icon: '⬆️', desc: 'More privacy' },
  { id: 'side_lower', label: 'Side Lower',     icon: '↙️', desc: 'Side berth lower' },
  { id: 'exit',       label: 'Near Exit',      icon: '🚪', desc: 'Quick exit access' },
  { id: 'quiet',      label: 'Quiet Zone',     icon: '🤫', desc: 'Away from exits' },
  { id: 'group',      label: 'Group Together', icon: '👨‍👩‍👧', desc: 'Same bay/row' },
];

const SEAT_COLORS = {
  available:    { bg: '#dcfce7', border: '#22c55e', text: '#15803d' },
  booked:       { bg: '#fee2e2', border: '#ef4444', text: '#b91c1c' },
  recommended:  { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
  selected:     { bg: '#dbeafe', border: '#3b82f6', text: '#1d4ed8' },
  disabled:     { bg: '#f1f5f9', border: '#cbd5e1', text: '#94a3b8' },
};

const TYPE_ICON = {
  Lower: '⬇', Middle: '➡', Upper: '⬆',
  SideLower: '↙', SideUpper: '↗',
  Window: '🪟', Aisle: '↔', Chair: '💺',
};

/* ── Helpers ── */
function getSeatStatus(seat, selectedIds, recommendedIds) {
  if (seat.isBooked)                    return 'booked';
  if (selectedIds.has(seat.id))         return 'selected';
  if (recommendedIds.has(seat.id))      return 'recommended';
  return 'available';
}

/* ── Sub-components ── */
function SeatCell({ seat, status, onClick }) {
  const colors = SEAT_COLORS[status];
  return (
    <div
      className={`sss-seat sss-seat--${status}`}
      style={{ background: colors.bg, borderColor: colors.border, color: colors.text }}
      onClick={() => !seat.isBooked && onClick(seat)}
      title={`Seat ${seat.seatNumber} · ${seat.seatType}${seat.nearWindow ? ' · Window' : ''}${seat.nearExit ? ' · Exit' : ''}${seat.nearWashroom ? ' · Washroom' : ''}`}
    >
      <span className="sss-seat-num">{seat.seatNumber}</span>
      <span className="sss-seat-type">{TYPE_ICON[seat.seatType] || '💺'}</span>
      {status === 'recommended' && <span className="sss-rec-dot" />}
    </div>
  );
}

function BerthCoachLayout({ seats, selectedIds, recommendedIds, onSeatClick }) {
  // Group by bay
  const bays = {};
  seats.forEach(s => {
    if (!bays[s.bayNumber]) bays[s.bayNumber] = [];
    bays[s.bayNumber].push(s);
  });

  return (
    <div className="sss-berth-coach">
      {/* Aisle label */}
      <div className="sss-aisle-label">← AISLE →</div>
      <div className="sss-bays">
        {Object.entries(bays).map(([bay, baySeats]) => {
          const main  = baySeats.filter(s => !['SideLower','SideUpper'].includes(s.seatType));
          const side  = baySeats.filter(s =>  ['SideLower','SideUpper'].includes(s.seatType));
          return (
            <div key={bay} className="sss-bay">
              <div className="sss-bay-label">Bay {bay}</div>
              <div className="sss-bay-main">
                {/* Left column: seats 1,2,3 */}
                <div className="sss-berth-col">
                  {main.filter((_, i) => i < 3).map(s => (
                    <SeatCell key={s.id} seat={s}
                      status={getSeatStatus(s, selectedIds, recommendedIds)}
                      onClick={onSeatClick} />
                  ))}
                </div>
                {/* Right column: seats 4,5,6 */}
                <div className="sss-berth-col">
                  {main.filter((_, i) => i >= 3).map(s => (
                    <SeatCell key={s.id} seat={s}
                      status={getSeatStatus(s, selectedIds, recommendedIds)}
                      onClick={onSeatClick} />
                  ))}
                </div>
              </div>
              {side.length > 0 && (
                <div className="sss-bay-side">
                  {side.map(s => (
                    <SeatCell key={s.id} seat={s}
                      status={getSeatStatus(s, selectedIds, recommendedIds)}
                      onClick={onSeatClick} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChairCoachLayout({ seats, selectedIds, recommendedIds, onSeatClick }) {
  // Group by row (positionY)
  const rows = {};
  seats.forEach(s => {
    if (!rows[s.positionY]) rows[s.positionY] = [];
    rows[s.positionY].push(s);
  });

  return (
    <div className="sss-chair-coach">
      <div className="sss-chair-header">
        <span>🚂 FRONT</span>
        <span>REAR 🚂</span>
      </div>
      <div className="sss-chair-rows">
        {Object.entries(rows).map(([row, rowSeats]) => (
          <div key={row} className="sss-chair-row">
            <span className="sss-row-num">{parseInt(row) + 1}</span>
            <div className="sss-chair-left">
              {rowSeats.filter(s => s.positionX < 2).map(s => (
                <SeatCell key={s.id} seat={s}
                  status={getSeatStatus(s, selectedIds, recommendedIds)}
                  onClick={onSeatClick} />
              ))}
            </div>
            <div className="sss-chair-aisle" />
            <div className="sss-chair-right">
              {rowSeats.filter(s => s.positionX >= 2).map(s => (
                <SeatCell key={s.id} seat={s}
                  status={getSeatStatus(s, selectedIds, recommendedIds)}
                  onClick={onSeatClick} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function SmartSeatSelection() {
  const navigate = useNavigate();
  const [trainNumber,    setTrainNumber]    = useState('12952');
  const [coaches,        setCoaches]        = useState([]);
  const [activeCoach,    setActiveCoach]    = useState(null);
  const [seats,          setSeats]          = useState([]);
  const [coachInfo,      setCoachInfo]      = useState(null);
  const [passengerCount, setPassengerCount] = useState(1);
  const [selectedPrefs,  setSelectedPrefs]  = useState([]);
  const [selectedIds,    setSelectedIds]    = useState(new Set());
  const [recommendedIds, setRecommendedIds] = useState(new Set());
  const [recommendedList,setRecommendedList]= useState([]);
  const [loadingCoaches, setLoadingCoaches] = useState(false);
  const [loadingSeats,   setLoadingSeats]   = useState(false);
  const [loadingRec,     setLoadingRec]     = useState(false);
  const [error,          setError]          = useState('');
  const [zoom,           setZoom]           = useState(1);

  // Passenger modal state
  const [showPaxModal,   setShowPaxModal]   = useState(false);
  const [passengers,     setPassengers]     = useState([
    { name: '', age: '', gender: 'Male', berthPreference: 'Lower' }
  ]);

  /* Load coaches when train number changes */
  const loadCoaches = useCallback(async () => {
    if (!trainNumber.trim()) return;
    setLoadingCoaches(true); setError(''); setCoaches([]);
    setActiveCoach(null); setSeats([]); setSelectedIds(new Set()); setRecommendedIds(new Set());
    try {
      const res = await axios.get(`${API}/seats/${trainNumber}/coaches`);
      const list = res.data.coaches || [];
      setCoaches(list);
      if (list.length > 0) setActiveCoach(list[0].coachName);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load coaches');
    } finally {
      setLoadingCoaches(false);
    }
  }, [trainNumber]);

  /* Load seats when active coach changes */
  useEffect(() => {
    if (!activeCoach || !trainNumber) return;
    setLoadingSeats(true); setSeats([]); setSelectedIds(new Set()); setRecommendedIds(new Set()); setRecommendedList([]);
    axios.get(`${API}/seats/${trainNumber}/${activeCoach}`)
      .then(res => {
        setSeats(res.data.seats || []);
        setCoachInfo(res.data.coach || null);
      })
      .catch(e => setError(e.response?.data?.error || 'Failed to load seats'))
      .finally(() => setLoadingSeats(false));
  }, [activeCoach, trainNumber]);

  const togglePref = (id) => {
    setSelectedPrefs(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSeatClick = (seat) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(seat.id)) {
        next.delete(seat.id);
      } else {
        if (next.size < passengerCount) next.add(seat.id);
      }
      return next;
    });
  };

  const handleRecommend = async () => {
    if (!activeCoach) return;
    setLoadingRec(true); setError(''); setRecommendedIds(new Set()); setRecommendedList([]);
    try {
      const res = await axios.post(`${API}/seats/recommend`, {
        trainNumber:    trainNumber,
        coachName:      activeCoach,
        passengerCount: passengerCount,
        preferences:    selectedPrefs,
      });
      const recs = res.data.recommended || [];
      setRecommendedIds(new Set(recs.map(s => s.id)));
      setRecommendedList(recs);
      // Auto-select recommended seats
      setSelectedIds(new Set(recs.map(s => s.id)));
    } catch (e) {
      setError(e.response?.data?.error || 'Recommendation failed');
    } finally {
      setLoadingRec(false);
    }
  };

  const handleBook = () => {
    if (selectedIds.size === 0) { setError('Please select at least one seat'); return; }
    if (selectedIds.size !== passengerCount) {
      setError(`Please select exactly ${passengerCount} seat(s)`); return;
    }
    // Sync passenger array length with count
    const pax = Array.from({ length: passengerCount }, (_, i) =>
      passengers[i] || { name: '', age: '', gender: 'Male', berthPreference: 'Lower' }
    );
    setPassengers(pax);
    setShowPaxModal(true);
    setError('');
  };

  const handlePaxSubmit = (e) => {
    e.preventDefault();
    for (let i = 0; i < passengers.length; i++) {
      if (!passengers[i].name.trim()) { setError(`Passenger ${i+1}: Name required`); return; }
      if (!passengers[i].age || passengers[i].age < 1) { setError(`Passenger ${i+1}: Valid age required`); return; }
    }
    const selectedSeats = seats.filter(s => selectedIds.has(s.id));
    sessionStorage.setItem('pendingBooking', JSON.stringify({
      trainId:     trainNumber,
      trainName:   '',
      source:      '',
      destination: '',
      date:        new Date().toISOString().split('T')[0],
      classType:   coachInfo?.coachType || 'SL',
      passengers,
      fareInfo:    null,
      totalFare:   0,
      selectedSeats: selectedSeats.map(s => ({ seatNumber: s.seatNumber, coachName: activeCoach })),
    }));
    navigate('/payment');
  };

  const updatePax = (i, field, val) => {
    const updated = [...passengers];
    updated[i][field] = val;
    setPassengers(updated);
  };

  const isChairCoach = coachInfo && ['CC', '2S'].includes(coachInfo.coachType);
  const availableCount = seats.filter(s => !s.isBooked).length;
  const bookedCount    = seats.filter(s =>  s.isBooked).length;

  return (
    <div className="sss-page">
      {/* ── Hero ── */}
      <div className="sss-hero">
        <div className="sss-hero-glow sss-hero-glow--l" />
        <div className="sss-hero-glow sss-hero-glow--r" />
        <div className="sss-hero-inner">
          <span className="sss-hero-badge">💺 SMART SEAT SELECTION</span>
          <h1 className="sss-hero-title">Choose Your Perfect Seat</h1>
          <p className="sss-hero-sub">
            AI-powered seat recommendations based on your preferences — window, lower berth, group seating and more
          </p>
        </div>
      </div>

      <div className="sss-container">

        {/* ── Control Panel ── */}
        <div className="sss-control-panel">
          {/* Train input */}
          <div className="sss-ctrl-group">
            <label>TRAIN NUMBER</label>
            <div className="sss-ctrl-input-wrap">
              <span>🚆</span>
              <input
                type="text"
                value={trainNumber}
                placeholder="e.g. 12952"
                onChange={e => setTrainNumber(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadCoaches()}
              />
            </div>
          </div>

          {/* Passengers */}
          <div className="sss-ctrl-group">
            <label>PASSENGERS</label>
            <div className="sss-ctrl-input-wrap">
              <span>👥</span>
              <input
                type="number" min="1" max="6"
                value={passengerCount}
                onChange={e => setPassengerCount(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          {/* Load button */}
          <button className="sss-btn sss-btn--primary" onClick={loadCoaches} disabled={loadingCoaches}>
            {loadingCoaches ? <><span className="sss-spin" /> Loading...</> : '🔍 Load Train'}
          </button>
        </div>

        {error && <div className="sss-alert sss-alert--error">⚠️ {error}</div>}

        {coaches.length > 0 && (
          <div className="sss-main-grid">

            {/* ── LEFT: Preferences + Coach tabs ── */}
            <div className="sss-sidebar">

              {/* Preferences */}
              <div className="sss-card">
                <h3 className="sss-card-title">🎯 Seat Preferences</h3>
                <p className="sss-card-sub">Select what matters to you</p>
                <div className="sss-pref-grid">
                  {PREFERENCES.map(p => (
                    <button
                      key={p.id}
                      className={`sss-pref-btn ${selectedPrefs.includes(p.id) ? 'active' : ''}`}
                      onClick={() => togglePref(p.id)}
                      title={p.desc}
                    >
                      <span className="sss-pref-icon">{p.icon}</span>
                      <span className="sss-pref-label">{p.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  className="sss-btn sss-btn--recommend"
                  onClick={handleRecommend}
                  disabled={loadingRec || !activeCoach}
                >
                  {loadingRec
                    ? <><span className="sss-spin" /> Finding...</>
                    : '✨ Smart Recommend'
                  }
                </button>
              </div>

              {/* Coach tabs */}
              <div className="sss-card">
                <h3 className="sss-card-title">🚃 Select Coach</h3>
                <div className="sss-coach-tabs">
                  {coaches.map(c => (
                    <button
                      key={c.coachName}
                      className={`sss-coach-tab ${activeCoach === c.coachName ? 'active' : ''}`}
                      onClick={() => setActiveCoach(c.coachName)}
                    >
                      <span className="sss-coach-name">{c.coachName}</span>
                      <span className="sss-coach-type">{c.coachType}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              {seats.length > 0 && (
                <div className="sss-card">
                  <h3 className="sss-card-title">📊 Coach Stats</h3>
                  <div className="sss-stats">
                    <div className="sss-stat sss-stat--green">
                      <span className="sss-stat-val">{availableCount}</span>
                      <span className="sss-stat-lbl">Available</span>
                    </div>
                    <div className="sss-stat sss-stat--red">
                      <span className="sss-stat-val">{bookedCount}</span>
                      <span className="sss-stat-lbl">Booked</span>
                    </div>
                    <div className="sss-stat sss-stat--blue">
                      <span className="sss-stat-val">{selectedIds.size}</span>
                      <span className="sss-stat-lbl">Selected</span>
                    </div>
                    <div className="sss-stat sss-stat--yellow">
                      <span className="sss-stat-val">{recommendedIds.size}</span>
                      <span className="sss-stat-lbl">Recommended</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="sss-card">
                <h3 className="sss-card-title">🗺️ Legend</h3>
                <div className="sss-legend">
                  {Object.entries(SEAT_COLORS).map(([status, colors]) => (
                    <div key={status} className="sss-legend-item">
                      <div className="sss-legend-dot"
                        style={{ background: colors.bg, border: `2px solid ${colors.border}` }} />
                      <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended list */}
              {recommendedList.length > 0 && (
                <div className="sss-card">
                  <h3 className="sss-card-title">⭐ Recommended Seats</h3>
                  <div className="sss-rec-list">
                    {recommendedList.map((s, i) => (
                      <div key={s.id} className="sss-rec-item">
                        <span className="sss-rec-rank">#{i + 1}</span>
                        <div>
                          <div className="sss-rec-seat">Seat {s.seatNumber} — {s.seatType}</div>
                          <div className="sss-rec-tags">
                            {s.nearWindow   && <span className="sss-tag">🪟 Window</span>}
                            {s.nearExit     && <span className="sss-tag">🚪 Exit</span>}
                            {s.nearWashroom && <span className="sss-tag">🚿 Washroom</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── RIGHT: Coach visualization ── */}
            <div className="sss-coach-panel">
              <div className="sss-coach-header">
                <div>
                  <h2 className="sss-coach-title">
                    Coach {activeCoach}
                    {coachInfo && <span className="sss-coach-badge">{coachInfo.coachType}</span>}
                  </h2>
                  <p className="sss-coach-sub">
                    {selectedIds.size > 0
                      ? `${selectedIds.size} of ${passengerCount} seat(s) selected`
                      : 'Click a seat to select, or use Smart Recommend'}
                  </p>
                </div>
                <div className="sss-zoom-controls">
                  <button className="sss-zoom-btn" onClick={() => setZoom(z => Math.max(0.6, z - 0.1))}>−</button>
                  <span className="sss-zoom-val">{Math.round(zoom * 100)}%</span>
                  <button className="sss-zoom-btn" onClick={() => setZoom(z => Math.min(1.6, z + 0.1))}>+</button>
                  <button className="sss-zoom-btn" onClick={() => setZoom(1)}>↺</button>
                </div>
              </div>

              {loadingSeats ? (
                <div className="sss-loading">
                  <span className="sss-spin sss-spin--lg" />
                  <p>Loading coach layout...</p>
                </div>
              ) : (
                <div className="sss-coach-viewport">
                  <div className="sss-coach-scroll" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                    {seats.length > 0 && (
                      isChairCoach
                        ? <ChairCoachLayout seats={seats} selectedIds={selectedIds} recommendedIds={recommendedIds} onSeatClick={handleSeatClick} />
                        : <BerthCoachLayout seats={seats} selectedIds={selectedIds} recommendedIds={recommendedIds} onSeatClick={handleSeatClick} />
                    )}
                  </div>
                </div>
              )}

              {/* Book button */}
              {selectedIds.size > 0 && (
                <div className="sss-book-bar">
                  <div className="sss-book-info">
                    <span>🎫 {selectedIds.size} seat(s) selected</span>
                    <span className="sss-book-seats">
                      Seats: {seats.filter(s => selectedIds.has(s.id)).map(s => s.seatNumber).join(', ')}
                    </span>
                  </div>
                  <button
                    className="sss-btn sss-btn--book"
                    onClick={handleBook}
                    disabled={selectedIds.size !== passengerCount}
                  >
                    {selectedIds.size !== passengerCount
                      ? `Select ${passengerCount - selectedIds.size} more`
                      : '🎫 Book Selected Seats'
                    }
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Empty state */}
        {coaches.length === 0 && !loadingCoaches && (
          <div className="sss-empty">
            <div className="sss-empty-icon">🚂</div>
            <h3>Enter a Train Number</h3>
            <p>Type a train number above and click Load Train to see the interactive coach layout</p>
            <div className="sss-empty-examples">
              {['12952', '12301', '12627', '22691'].map(t => (
                <button key={t} className="sss-example-btn"
                  onClick={() => { setTrainNumber(t); }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── Passenger Modal ── */}
      {showPaxModal && (
        <div className="sss-modal-overlay" onClick={() => setShowPaxModal(false)}>
          <div className="sss-modal" onClick={e => e.stopPropagation()}>
            <div className="sss-modal-header">
              <h2>👤 Passenger Details</h2>
              <button className="sss-modal-close" onClick={() => setShowPaxModal(false)}>✕</button>
            </div>
            <div className="sss-modal-seats">
              Selected: Coach {activeCoach} — Seats {seats.filter(s => selectedIds.has(s.id)).map(s => s.seatNumber).join(', ')}
            </div>
            <form onSubmit={handlePaxSubmit} className="sss-modal-form">
              {passengers.map((p, i) => (
                <div key={i} className="sss-pax-block">
                  <div className="sss-pax-title">Passenger {i + 1}</div>
                  <div className="sss-pax-grid">
                    <div className="sss-pax-field sss-pax-field--wide">
                      <label>Full Name *</label>
                      <input type="text" value={p.name} placeholder="As on ID proof"
                        onChange={e => updatePax(i, 'name', e.target.value)} required />
                    </div>
                    <div className="sss-pax-field">
                      <label>Age *</label>
                      <input type="number" value={p.age} placeholder="Age" min="1" max="120"
                        onChange={e => updatePax(i, 'age', e.target.value)} required />
                    </div>
                    <div className="sss-pax-field">
                      <label>Gender</label>
                      <select value={p.gender} onChange={e => updatePax(i, 'gender', e.target.value)}>
                        <option>Male</option><option>Female</option><option>Other</option>
                      </select>
                    </div>
                    <div className="sss-pax-field">
                      <label>Berth Preference</label>
                      <select value={p.berthPreference} onChange={e => updatePax(i, 'berthPreference', e.target.value)}>
                        <option>Lower</option><option>Middle</option><option>Upper</option>
                        <option>Side Lower</option><option>Side Upper</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              {error && <div className="sss-alert sss-alert--error">⚠️ {error}</div>}
              <button type="submit" className="sss-btn sss-btn--book sss-modal-submit">
                Proceed to Payment →
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
