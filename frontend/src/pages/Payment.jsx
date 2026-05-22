import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Payment.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const PAYMENT_METHODS = [
  { id: 'upi',    label: 'UPI',                icon: '📱', desc: 'GPay, PhonePe, Paytm, BHIM' },
  { id: 'card',   label: 'Credit / Debit Card', icon: '💳', desc: 'Visa, Mastercard, RuPay' },
  { id: 'netbank',label: 'Net Banking',         icon: '🏦', desc: 'All major banks' },
  { id: 'wallet', label: 'Wallet',              icon: '👛', desc: 'Paytm, Amazon Pay, Mobikwik' },
];

/* ── ERS Ticket Component ─────────────────────────────────────────────────── */
function TicketERS({ booking, passengers, source, destination, date, classType,
                     trainId, totalFare, fareInfo, onDashboard, onPNR }) {
  const ticketRef = useRef(null);
  const txnId = `TXN${Date.now()}`;
  const bookingDate = new Date().toLocaleString('en-IN');
  const perPax = fareInfo?.selectedFare?.totalFare || Math.round(totalFare / passengers.length);
  const convFee = Math.round(totalFare * 0.018);

  const handlePrint = () => {
    const content = ticketRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`
      <html><head><title>ERS - ${booking.pnrNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #000; }
        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #999; padding: 5px 8px; }
        .ers-header { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 8px; }
        .ers-pnr { color: #0000cc; font-weight: bold; font-size: 16px; }
        .ers-train { color: #cc0000; font-weight: bold; }
        .ers-class { color: #0000cc; font-weight: bold; }
        .ers-status-cnf { color: green; font-weight: bold; }
        .ers-status-wl  { color: red; font-weight: bold; }
        .ers-status-rac { color: orange; font-weight: bold; }
        .ers-note { font-size: 10px; margin-top: 8px; }
        .no-print { display: none; }
        @media print { .no-print { display: none; } }
      </style></head><body>${content}</body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const statusClass = (s) => {
    const u = (s || '').toUpperCase();
    if (u.includes('CNF') || u === 'CONFIRMED') return 'ers-status-cnf';
    if (u.includes('WL')) return 'ers-status-wl';
    return 'ers-status-rac';
  };

  return (
    <div className="ers-wrapper">
      <div className="ers-actions no-print">
        <h2 className="ers-success-title">✅ Booking Confirmed!</h2>
        <div className="ers-action-btns">
          <button className="ers-btn ers-btn--print" onClick={handlePrint}>🖨️ Print / Download PDF</button>
          <button className="ers-btn ers-btn--dash"  onClick={onDashboard}>📋 My Bookings</button>
          <button className="ers-btn ers-btn--pnr"   onClick={onPNR}>🔍 Check PNR</button>
        </div>
      </div>

      {/* ── ERS Ticket ── */}
      <div className="ers-ticket" ref={ticketRef}>
        {/* Header */}
        <div className="ers-top">
          <div className="ers-top-wl">
            <span className={statusClass(booking.bookingStatus)}>{booking.bookingStatus}</span>
          </div>
          <div className="ers-top-title">
            <div className="ers-header-title">Electronic Reservation Slip (ERS)-Normal User</div>
          </div>
          <div className="ers-top-wl ers-top-wl--right">
            <span className={statusClass(booking.bookingStatus)}>{booking.bookingStatus}</span>
          </div>
        </div>

        {/* Logos row */}
        <div className="ers-logos">
          <div className="ers-logo-left">
            <div className="ers-logo-circle">🚂</div>
            <div className="ers-logo-text">Indian Railways</div>
          </div>
          <div className="ers-logo-right">
            <div className="ers-irctc-badge">IRCTC</div>
          </div>
        </div>

        {/* Journey row */}
        <table className="ers-journey-table">
          <tbody>
            <tr>
              <td className="ers-td">
                <div className="ers-td-label">Booked From</div>
                <div className="ers-td-val">{source}</div>
              </td>
              <td className="ers-td ers-td--center">
                <div className="ers-boarding-arrow">Boarding At ➜</div>
                <div className="ers-td-val">{source}</div>
              </td>
              <td className="ers-td">
                <div className="ers-td-label">To</div>
                <div className="ers-td-val">{destination}</div>
              </td>
            </tr>
            <tr>
              <td className="ers-td">
                <div className="ers-td-label">Start Date*</div>
                <div className="ers-td-val">{date}</div>
              </td>
              <td className="ers-td ers-td--center">
                <div className="ers-td-label">Departure*</div>
                <div className="ers-td-val">{fareInfo?.departureTime || 'N.A.'}</div>
              </td>
              <td className="ers-td">
                <div className="ers-td-label">Arrival*</div>
                <div className="ers-td-val">{fareInfo?.arrivalTime || 'N.A.'}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* PNR / Train / Class row */}
        <table className="ers-info-table">
          <tbody>
            <tr>
              <td className="ers-td">
                <div className="ers-td-label">PNR</div>
                <div className="ers-pnr">{booking.pnrNumber}</div>
              </td>
              <td className="ers-td">
                <div className="ers-td-label">Train No./Name</div>
                <div className="ers-train">{trainId} / {booking.trainName || 'SMARTRAIL EXP'}</div>
              </td>
              <td className="ers-td">
                <div className="ers-td-label">Class</div>
                <div className="ers-class">{classType}</div>
              </td>
            </tr>
            <tr>
              <td className="ers-td">
                <div className="ers-td-label">Quota</div>
                <div className="ers-td-val">GENERAL (GN)</div>
              </td>
              <td className="ers-td">
                <div className="ers-td-label">Distance</div>
                <div className="ers-td-val">{fareInfo?.distanceKm || '—'} KM</div>
              </td>
              <td className="ers-td">
                <div className="ers-td-label">Coach</div>
                <div className="ers-td-val" style={{ fontWeight: 700, color: '#1d4ed8' }}>
                  {booking.coachName || (booking.bookingStatus === 'CONFIRMED' ? '—' : booking.bookingStatus)}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Passenger table */}
        <div className="ers-section-title">Passenger Details</div>
        <table className="ers-pax-table">
          <thead>
            <tr>
              <th>#</th><th>Name</th><th>Age</th><th>Gender</th>
              <th>Booking Status</th><th>Coach / Seat</th>
            </tr>
          </thead>
          <tbody>
            {passengers.map((p, i) => {
              // Use allocated seat from booking response if available
              const allocatedSeats = booking.allocatedSeats || [];
              const seatVal = allocatedSeats[i] || booking.bookingStatus;
              const isConfirmed = booking.bookingStatus === 'CONFIRMED';
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{p.name}</td>
                  <td>{p.age}</td>
                  <td>{p.gender === 'Male' ? 'M' : p.gender === 'Female' ? 'F' : 'O'}</td>
                  <td className={statusClass(booking.bookingStatus)}>{booking.bookingStatus}</td>
                  <td style={{ fontWeight: 700, color: isConfirmed ? 'green' : 'red' }}>
                    {seatVal}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Transaction */}
        <div className="ers-txn">
          <div>Transaction ID: {txnId}</div>
          <div className="ers-note-small">IR recovers only 57% of cost of travel on an average.</div>
        </div>

        {/* Payment details */}
        <div className="ers-section-title">Payment Details</div>
        <table className="ers-pay-table">
          <tbody>
            <tr><td>Ticket Fare</td><td>₹ {totalFare.toFixed(2)}</td></tr>
            <tr><td>IRCTC Convenience Fee (Incl. of GST)</td><td>₹ {convFee.toFixed(2)}</td></tr>
            <tr className="ers-pay-total"><td>Total Fare (all inclusive)</td><td>₹ {(totalFare + convFee).toFixed(2)}</td></tr>
          </tbody>
        </table>

        {/* Notes */}
        <div className="ers-notes">
          <p>• Beware of fraudulent customer care number. For any assistance, use only the IRCTC e-ticketing Customer care number: 14646.</p>
          <p>• IRCTC Convenience Fee is charged per e-ticket irrespective of number of passengers on the ticket.</p>
          <p>• The printed Departure and Arrival Times are liable to change. Please Check correct departure, arrival from Railway Station Enquiry or Dial 139 or SMS RAIL to 139.</p>
          <p>• This ticket is booked on a personal User ID, its sale/purchase is an offence u/s 143 of the Railways Act, 1989.</p>
          <p>• Prescribed original ID proof is required while travelling along with SMS/VRM/ERS otherwise will be treated as without ticket and penalized as per Railway Rules.</p>
        </div>

        {/* GST details */}
        <div className="ers-gst">
          <div className="ers-gst-title">Indian Railways GST Details:</div>
          <div className="ers-gst-row">
            <span>Invoice Number: PS{booking.pnrNumber}</span>
            <span>Address: Indian Railways New Delhi</span>
          </div>
          <div className="ers-gst-row">
            <span>SAC Code: 996421</span>
            <span>GSTIN: 07AAAGM0289C1ZL</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Payment() {
  const navigate = useNavigate();
  const [booking,       setBooking]       = useState(null);
  const [payMethod,     setPayMethod]     = useState('upi');
  const [upiId,         setUpiId]         = useState('');
  const [processing,    setProcessing]    = useState(false);
  const [error,         setError]         = useState('');
  const [success,       setSuccess]       = useState(null);

  useEffect(() => {
    const data = sessionStorage.getItem('pendingBooking');
    if (!data) { navigate('/search'); return; }
    setBooking(JSON.parse(data));
  }, [navigate]);

  if (!booking) return null;

  const { trainId, trainName, source, destination, date, classType,
          passengers, fareInfo, totalFare } = booking;

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    setProcessing(true); setError('');

    // Simulate payment processing (2s delay)
    await new Promise(r => setTimeout(r, 2000));

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/book-ticket`, {
        trainNumber:           trainId,
        sourceStationCode:     source,
        destinationStationCode: destination,
        travelDate:            date,
        classType:             classType,
        passengers,
      }, {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
      });

      if (res.status === 201 || res.status === 200) {
        sessionStorage.removeItem('pendingBooking');
        setSuccess(res.data);
      } else if (res.status === 401) {
        navigate('/login');
      } else {
        setError(res.data?.error || 'Booking failed. Please try again.');
      }
    } catch (_e) {
      setError('Network error. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="pay-page">
        <TicketERS
          booking={success}
          passengers={passengers}
          source={source}
          destination={destination}
          date={date}
          classType={classType}
          trainId={trainId}
          totalFare={totalFare}
          fareInfo={fareInfo}
          onDashboard={() => navigate('/dashboard')}
          onPNR={() => navigate('/pnr')}
        />
      </div>
    );
  }

  // ── Payment form ────────────────────────────────────────────────────────────
  return (
    <div className="pay-page">
      <div className="pay-hero">
        <div className="pay-hero-inner">
          <span className="pay-hero-badge">💳 PAYMENT</span>
          <h1>Complete Your Booking</h1>
          <p>Step 2 of 2 — Secure payment powered by SmartRail</p>
        </div>
      </div>

      <div className="pay-container">
        <div className="pay-layout">

          {/* ── LEFT: Payment form ── */}
          <div className="pay-main">
            <div className="pay-card">
              <h3>Select Payment Method</h3>
              <div className="pay-methods">
                {PAYMENT_METHODS.map(m => (
                  <label key={m.id} className={`pay-method ${payMethod === m.id ? 'active' : ''}`}>
                    <input type="radio" name="payMethod" value={m.id}
                      checked={payMethod === m.id}
                      onChange={() => setPayMethod(m.id)} />
                    <span className="pay-method-icon">{m.icon}</span>
                    <div className="pay-method-info">
                      <span className="pay-method-label">{m.label}</span>
                      <span className="pay-method-desc">{m.desc}</span>
                    </div>
                    {payMethod === m.id && <span className="pay-method-check">✓</span>}
                  </label>
                ))}
              </div>

              {/* UPI input */}
              {payMethod === 'upi' && (
                <div className="pay-upi-section">
                  <label className="pay-field-label">UPI ID</label>
                  <div className="pay-upi-input">
                    <span>📱</span>
                    <input
                      type="text"
                      value={upiId}
                      onChange={e => setUpiId(e.target.value)}
                      placeholder="yourname@upi"
                    />
                  </div>
                  <p className="pay-upi-hint">e.g. 9876543210@paytm or name@okaxis</p>
                </div>
              )}

              {/* Card input */}
              {payMethod === 'card' && (
                <div className="pay-card-section">
                  <div className="pay-field">
                    <label className="pay-field-label">Card Number</label>
                    <input type="text" placeholder="1234 5678 9012 3456" maxLength="19" className="pay-input" />
                  </div>
                  <div className="pay-field-row">
                    <div className="pay-field">
                      <label className="pay-field-label">Expiry</label>
                      <input type="text" placeholder="MM/YY" maxLength="5" className="pay-input" />
                    </div>
                    <div className="pay-field">
                      <label className="pay-field-label">CVV</label>
                      <input type="password" placeholder="•••" maxLength="3" className="pay-input" />
                    </div>
                  </div>
                  <div className="pay-field">
                    <label className="pay-field-label">Name on Card</label>
                    <input type="text" placeholder="As printed on card" className="pay-input" />
                  </div>
                </div>
              )}

              {/* Net banking */}
              {payMethod === 'netbank' && (
                <div className="pay-netbank-section">
                  <label className="pay-field-label">Select Bank</label>
                  <select className="pay-input">
                    <option>State Bank of India</option>
                    <option>HDFC Bank</option>
                    <option>ICICI Bank</option>
                    <option>Axis Bank</option>
                    <option>Kotak Mahindra Bank</option>
                    <option>Punjab National Bank</option>
                    <option>Bank of Baroda</option>
                    <option>Other Bank</option>
                  </select>
                </div>
              )}

              {error && <div className="pay-error">⚠️ {error}</div>}

              <form onSubmit={handleConfirmPayment}>
                <button type="submit" className="pay-confirm-btn" disabled={processing}>
                  {processing
                    ? <><span className="pay-spin" /> Processing Payment...</>
                    : `🔒 Pay ₹${totalFare.toLocaleString()}`
                  }
                </button>
              </form>

              <div className="pay-secure-note">
                🔒 256-bit SSL encrypted · PCI DSS compliant · Safe & Secure
              </div>
            </div>
          </div>

          {/* ── RIGHT: Order summary ── */}
          <div className="pay-sidebar">
            <div className="pay-summary-card">
              <h3>📋 Booking Summary</h3>

              <div className="pay-summary-journey">
                <div className="pay-sum-station">
                  <span className="pay-sum-label">FROM</span>
                  <span className="pay-sum-code">{source}</span>
                </div>
                <span className="pay-sum-arrow">→</span>
                <div className="pay-sum-station pay-sum-station--right">
                  <span className="pay-sum-label">TO</span>
                  <span className="pay-sum-code">{destination}</span>
                </div>
              </div>

              <div className="pay-summary-meta">
                <div className="pay-sm-row"><span>Train</span><span>{trainName || trainId}</span></div>
                <div className="pay-sm-row"><span>Date</span><span>{date}</span></div>
                <div className="pay-sm-row"><span>Class</span><span>{classType}</span></div>
                <div className="pay-sm-row"><span>Passengers</span><span>{passengers.length}</span></div>
              </div>

              <div className="pay-passengers-list">
                {passengers.map((p, i) => (
                  <div key={i} className="pay-pax-row">
                    <span className="pay-pax-num">{i + 1}</span>
                    <span className="pay-pax-name">{p.name || '—'}</span>
                    <span className="pay-pax-age">{p.age}y · {p.gender[0]}</span>
                  </div>
                ))}
              </div>

              <div className="pay-amount-box">
                {fareInfo?.selectedFare && (
                  <>
                    <div className="pay-amt-row">
                      <span>Fare × {passengers.length}</span>
                      <span>₹{(fareInfo.selectedFare.totalFare * passengers.length).toLocaleString()}</span>
                    </div>
                  </>
                )}
                <div className="pay-amt-total">
                  <span>Total Amount</span>
                  <span>₹{totalFare.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <button className="pay-back-btn" onClick={() => navigate(-1)}>
              ← Back to Passenger Details
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
