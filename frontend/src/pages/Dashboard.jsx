import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Dashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const STATUS_STYLE = {
  CONFIRMED: { bg: '#f0fdf4', color: '#15803d', border: '#22c55e' },
  WL:        { bg: '#fff1f2', color: '#be123c', border: '#ef4444' },
  RAC:       { bg: '#fffbeb', color: '#b45309', border: '#f59e0b' },
  CANCELLED: { bg: '#f8fafc', color: '#64748b', border: '#cbd5e1' },
};
const getStyle = (s) => STATUS_STYLE[(s||'').toUpperCase().split('/')[0]] || STATUS_STYLE.CONFIRMED;

/* ── Mini ERS for download ── */
function buildTicketHTML(b) {
  const paxRows = (b.passengers || []).map((p, i) => {
    const seat = p.seatNumber || p.seat_number || '—';
    const isWL  = String(seat).startsWith('WL');
    const isRAC = String(seat).startsWith('RAC');
    const seatColor = isWL ? 'red' : isRAC ? 'orange' : 'green';
    const statusColor = (b.booking_status||'').toUpperCase() === 'CONFIRMED' ? 'green'
                      : (b.booking_status||'').toUpperCase().startsWith('WL') ? 'red' : 'orange';
    return `<tr>
      <td>${i+1}</td>
      <td>${p.name||'—'}</td>
      <td>${p.age||'—'}</td>
      <td>${(p.gender||'—')[0]}</td>
      <td style="color:${statusColor};font-weight:bold">${b.booking_status||'—'}</td>
      <td style="color:${seatColor};font-weight:bold">${seat}</td>
    </tr>`;
  }).join('');

  const convFee = Math.round((b.total_fare||0) * 0.018);

  // Extract coach from first passenger seat (format: "S1/34")
  const firstSeat = (b.passengers||[])[0];
  const firstSeatVal = firstSeat ? (firstSeat.seatNumber || firstSeat.seat_number || '') : '';
  const coachDisplay = firstSeatVal.includes('/') ? firstSeatVal.split('/')[0] : '—';

  return `
  <html><head><title>ERS-${b.pnr_number}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#000}
    table{width:100%;border-collapse:collapse}
    td,th{border:1px solid #999;padding:5px 8px}
    th{background:#f0f0f0;font-weight:bold}
    .hdr{text-align:center;font-weight:bold;font-size:14px;text-decoration:underline;margin-bottom:8px}
    .pnr{color:#00c;font-weight:bold;font-size:16px}
    .train{color:#c00;font-weight:bold}
    .cls{color:#00c;font-weight:bold}
    .lbl{font-size:10px;color:#555}
    .sec{font-weight:bold;text-decoration:underline;margin:8px 0 4px}
    .note{font-size:10px;line-height:1.6;border-top:1px solid #ccc;padding-top:6px;margin-top:6px}
    .total td{font-weight:bold}
  </style></head><body>
  <div class="hdr">Electronic Reservation Slip (ERS) — SmartRail</div>
  <table><tr>
    <td><div class="lbl">From</div><b>${b.source_station}</b></td>
    <td><div class="lbl">To</div><b>${b.destination_station}</b></td>
    <td><div class="lbl">Date</div><b>${b.travel_date}</b></td>
  </tr></table>
  <table style="margin-top:6px"><tr>
    <td><div class="lbl">PNR</div><div class="pnr">${b.pnr_number}</div></td>
    <td><div class="lbl">Train</div><div class="train">${b.train_number} / ${b.train_name||'—'}</div></td>
    <td><div class="lbl">Class</div><div class="cls">${b.class_type}</div></td>
    <td><div class="lbl">Coach</div><b style="color:#1d4ed8">${coachDisplay}</b></td>
  </tr></table>
  <div class="sec" style="margin-top:8px">Passenger Details</div>
  <table><thead><tr>
    <th>#</th><th>Name</th><th>Age</th><th>Gender</th><th>Booking Status</th><th>Coach / Seat</th>
  </tr></thead>
  <tbody>${paxRows || '<tr><td colspan="6" style="text-align:center;color:#999">No passenger data</td></tr>'}</tbody></table>
  <div class="sec">Payment Details</div>
  <table>
    <tr><td>Ticket Fare</td><td>₹ ${(b.total_fare||0).toFixed(2)}</td></tr>
    <tr><td>IRCTC Convenience Fee (Incl. GST)</td><td>₹ ${convFee.toFixed(2)}</td></tr>
    <tr class="total"><td>Total Fare (all inclusive)</td><td>₹ ${((b.total_fare||0)+convFee).toFixed(2)}</td></tr>
  </table>
  <div class="note">
    <p>• Prescribed original ID proof is required while travelling along with SMS/VRM/ERS.</p>
    <p>• For assistance, call IRCTC Customer Care: 14646</p>
    <p>• Booked via SmartRail — Powered by Indian Railways</p>
  </div>
  </body></html>`;
}

async function downloadTicket(b, paxData, setPaxData) {
  // Always fetch fresh passenger data before downloading
  let pax = paxData[b.pnr_number];
  if (!pax || pax.length === 0) {
    try {
      const res = await fetch(`${API_URL}/pnr/${b.pnr_number}`);
      if (res.ok) {
        const data = await res.json();
        pax = data.passengers || [];
        setPaxData(prev => ({ ...prev, [b.pnr_number]: pax }));
      }
    } catch (_e) {}
  }

  const html = buildTicketHTML({ ...b, passengers: pax || [] });
  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 600);
}

export default function Dashboard() {
  const [bookings,    setBookings]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [cancelId,    setCancelId]    = useState(null);
  const [cancelling,  setCancelling]  = useState(false);
  const [cancelMsg,   setCancelMsg]   = useState('');
  const [expandedPnr, setExpandedPnr] = useState(null);
  const [paxData,     setPaxData]     = useState({});

  useEffect(() => { fetchBookings(); }, []);

  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/user/bookings`, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
      });
      if (res.status === 401) { window.location.href = '/login'; return; }
      setBookings(res.data || []);
    } catch (_e) {
    } finally {
      setLoading(false);
    }
  };

  const fetchPassengers = async (pnr) => {
    if (paxData[pnr]) { setExpandedPnr(expandedPnr === pnr ? null : pnr); return; }
    try {
      const res = await axios.get(`${API_URL}/pnr/${pnr}`, { validateStatus: () => true });
      if (res.status === 200) {
        setPaxData(prev => ({ ...prev, [pnr]: res.data.passengers || [] }));
      }
    } catch (_e) {}
    setExpandedPnr(expandedPnr === pnr ? null : pnr);
  };

  const handleCancel = async (bookingId) => {
    setCancelling(true); setCancelMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/cancel-booking`,
        { bookingId },
        { headers: { Authorization: `Bearer ${token}` }, validateStatus: () => true }
      );
      if (res.status === 200) {
        setCancelMsg('Booking cancelled successfully. Refund will be processed in 5–7 days.');
        setBookings(prev => prev.map(b =>
          b.booking_id === bookingId ? { ...b, booking_status: 'CANCELLED' } : b
        ));
      } else {
        setCancelMsg(res.data?.error || 'Cancellation failed. Please try again.');
      }
    } catch (_e) {
      setCancelMsg('Network error. Please try again.');
    } finally {
      setCancelling(false);
      setCancelId(null);
    }
  };

  const confirmed = bookings.filter(b => b.booking_status !== 'CANCELLED').length;
  const cancelled = bookings.filter(b => b.booking_status === 'CANCELLED').length;

  return (
    <div className="db-page">
      {/* Hero */}
      <div className="db-hero">
        <div className="db-hero-inner">
          <span className="db-hero-badge">📋 MY BOOKINGS</span>
          <h1>Your Travel Dashboard</h1>
          <p>Manage bookings, download tickets, and track your journeys</p>
        </div>
      </div>

      <div className="db-container">

        {/* Stats */}
        <div className="db-stats">
          <div className="db-stat db-stat--blue">
            <span className="db-stat-val">{bookings.length}</span>
            <span className="db-stat-lbl">Total Bookings</span>
          </div>
          <div className="db-stat db-stat--green">
            <span className="db-stat-val">{confirmed}</span>
            <span className="db-stat-lbl">Active</span>
          </div>
          <div className="db-stat db-stat--gray">
            <span className="db-stat-val">{cancelled}</span>
            <span className="db-stat-lbl">Cancelled</span>
          </div>
        </div>

        {cancelMsg && (
          <div className={`db-msg ${cancelMsg.includes('success') ? 'db-msg--ok' : 'db-msg--err'}`}>
            {cancelMsg.includes('success') ? '✅' : '⚠️'} {cancelMsg}
          </div>
        )}

        {loading && (
          <div className="db-loading"><span className="db-spin" /> Loading bookings...</div>
        )}

        {!loading && bookings.length === 0 && (
          <div className="db-empty">
            <div className="db-empty-icon">🎫</div>
            <h3>No Bookings Yet</h3>
            <p>Your booked tickets will appear here</p>
            <a href="/search" className="db-search-link">Search Trains →</a>
          </div>
        )}

        {!loading && bookings.length > 0 && (
          <div className="db-list">
            {bookings.map(b => {
              const st = getStyle(b.booking_status);
              const isCancelled = b.booking_status === 'CANCELLED';
              const isExpanded  = expandedPnr === b.pnr_number;
              const pax         = paxData[b.pnr_number] || [];

              return (
                <div key={b.booking_id} className={`db-card ${isCancelled ? 'db-card--cancelled' : ''}`}>
                  {/* Card header */}
                  <div className="db-card-header">
                    <div className="db-card-left">
                      <span className="db-train-num">{b.train_number}</span>
                      <span className="db-train-name">{b.train_name}</span>
                    </div>
                    <span className="db-status-pill"
                      style={{ background: st.bg, color: st.color, borderColor: st.border }}>
                      {b.booking_status}
                    </span>
                  </div>

                  {/* Journey */}
                  <div className="db-journey">
                    <div className="db-station">
                      <span className="db-station-lbl">FROM</span>
                      <span className="db-station-code">{b.source_station}</span>
                    </div>
                    <div className="db-journey-mid">
                      <div className="db-journey-line" />
                      <span className="db-journey-icon">🚆</span>
                      <div className="db-journey-line" />
                    </div>
                    <div className="db-station db-station--right">
                      <span className="db-station-lbl">TO</span>
                      <span className="db-station-code">{b.destination_station}</span>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="db-meta">
                    <span>📅 {b.travel_date}</span>
                    <span>💺 {b.class_type}</span>
                    <span>💰 ₹{b.total_fare}</span>
                    <span className="db-pnr">PNR: <strong>{b.pnr_number}</strong></span>
                  </div>

                  {/* Passengers expand */}
                  {isExpanded && pax.length > 0 && (
                    <div className="db-pax-table">
                      <table>
                        <thead><tr><th>#</th><th>Name</th><th>Age</th><th>Gender</th><th>Seat / Status</th></tr></thead>
                        <tbody>
                          {pax.map((p, i) => {
                            const seatVal = p.seatNumber || p.seat_number || '—';
                            const isExchanged = p.exchanged === true;
                            const isWL = String(seatVal).startsWith('WL');
                            const isRAC = String(seatVal).startsWith('RAC');
                            return (
                              <tr key={i}>
                                <td>{i+1}</td>
                                <td>{p.name}</td>
                                <td>{p.age}</td>
                                <td>{p.gender}</td>
                                <td>
                                  <span style={{
                                    fontWeight: 700,
                                    color: isWL ? '#dc2626' : isRAC ? '#d97706' : '#15803d',
                                    background: isWL ? '#fef2f2' : isRAC ? '#fffbeb' : '#f0fdf4',
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    fontSize: '0.85rem',
                                  }}>
                                    {isWL ? '🔴' : isRAC ? '🟡' : '🟢'} {seatVal}
                                  </span>
                                  {isExchanged && (
                                    <span style={{
                                      marginLeft: 8,
                                      fontSize: '0.72rem',
                                      background: '#eff6ff',
                                      color: '#1d4ed8',
                                      padding: '2px 6px',
                                      borderRadius: 6,
                                      fontWeight: 600,
                                    }}>🔄 Seat Exchanged</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="db-actions">
                    <button className="db-btn db-btn--ghost"
                      onClick={() => fetchPassengers(b.pnr_number)}>
                      {isExpanded ? '▲ Hide Passengers' : '▼ View Passengers'}
                    </button>

                    <button className="db-btn db-btn--download"
                      onClick={() => downloadTicket({ ...b, passengers: pax }, paxData, setPaxData)}>
                      🖨️ Download Ticket
                    </button>

                    {!isCancelled && (
                      cancelId === b.booking_id ? (
                        <div className="db-confirm-cancel">
                          <span>Cancel this booking?</span>
                          <button className="db-btn db-btn--danger"
                            disabled={cancelling}
                            onClick={() => handleCancel(b.booking_id)}>
                            {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
                          </button>
                          <button className="db-btn db-btn--ghost"
                            onClick={() => setCancelId(null)}>No</button>
                        </div>
                      ) : (
                        <button className="db-btn db-btn--cancel"
                          onClick={() => { setCancelId(b.booking_id); setCancelMsg(''); }}>
                          ✕ Cancel Booking
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
