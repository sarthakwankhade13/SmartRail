import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Navbar.css';

function Navbar() {
  const navigate = useNavigate();
  const isAuthenticated = !!localStorage.getItem('token');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="nav-main">
        <div className="nav-container">
          <div className="nav-logo-section">
            <Link to="/" className="nav-logo">
              <div className="logo-icon">
                <img src="/irctc-logo.png" alt="Indian Railways IRCTC" />
              </div>
              <div className="logo-text">
                <div className="logo-main">INDIAN RAILWAYS</div>
                <div className="logo-sub">Safety | Security | Punctuality</div>
              </div>
            </Link>
          </div>
          <ul className="nav-menu">
            <li><Link to="/">HOME</Link></li>
            <li><Link to="/search">TRAINS</Link></li>
            <li className="dropdown">
              <span className="dropdown-toggle">AI FEATURES ▼</span>
              <div className="dropdown-menu">
                <Link to="/ai-features">Waitlist Prediction</Link>
                <Link to="/ai-features">Smart Seat Selection</Link>
                <Link to="/ai-features">Price Analysis</Link>
                <Link to="/ai-features">Seat Exchange</Link>
                <Link to="/ai-features">Journey Planner</Link>
              </div>
            </li>
            {isAuthenticated && (
              <>
                <li><Link to="/dashboard">MY BOOKINGS</Link></li>
                <li><button onClick={handleLogout} className="btn-logout">LOGOUT</button></li>
              </>
            )}
            {!isAuthenticated && (
              <li><Link to="/login" className="btn-login-register">LOGIN / REGISTER</Link></li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
