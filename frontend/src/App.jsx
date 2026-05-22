import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import TrainSearch from './pages/TrainSearch';
import BookTicket from './pages/BookTicket';
import Payment from './pages/Payment';
import PNRStatus from './pages/PNRStatus';
import Dashboard from './pages/Dashboard';
import AIFeatures from './pages/AIFeatures';
import WaitlistPredictor from './pages/WaitlistPredictor';
import PriceAnalysis from './pages/PriceAnalysis';
import SmartSeatSelection from './pages/SmartSeatSelection';
import JourneyPlanner from './pages/JourneyPlanner';
import SeatExchange from './pages/SeatExchange';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

  // Re-check auth on every render cycle (handles same-tab login)
  const checkAuth = useCallback(() => {
    setIsAuthenticated(!!localStorage.getItem('token'));
  }, []);

  useEffect(() => {
    // Listen for storage changes from other tabs
    window.addEventListener('storage', checkAuth);
    // Also poll every second to catch same-tab login
    const interval = setInterval(checkAuth, 500);
    return () => {
      window.removeEventListener('storage', checkAuth);
      clearInterval(interval);
    };
  }, [checkAuth]);

  // Protected route wrapper
  const Protected = ({ children }) => {
    const token = localStorage.getItem('token');
    if (!token) return <Navigate to="/login" replace />;
    return children;
  };

  return (
    <Router>
      <div className="App">
        <Navbar />
        <Routes>
          <Route path="/"              element={<Home />} />
          <Route path="/login"         element={<Login />} />
          <Route path="/signup"        element={<Signup />} />
          <Route path="/search"        element={<TrainSearch />} />
          <Route path="/pnr"           element={<PNRStatus />} />
          <Route path="/waitlist"      element={<WaitlistPredictor />} />
          <Route path="/price-analysis"element={<PriceAnalysis />} />
          <Route path="/smart-seat"    element={<SmartSeatSelection />} />
          <Route path="/journey-planner" element={<JourneyPlanner />} />
          <Route path="/seat-exchange" element={<SeatExchange />} />

          {/* Protected routes — check token at render time */}
          <Route path="/book/:trainId" element={
            <Protected><BookTicket /></Protected>
          } />
          <Route path="/payment"       element={
            <Protected><Payment /></Protected>
          } />
          <Route path="/dashboard"     element={
            <Protected><Dashboard /></Protected>
          } />
          <Route path="/ai-features"   element={
            <Protected><AIFeatures /></Protected>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
