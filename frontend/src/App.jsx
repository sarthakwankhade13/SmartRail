import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import TrainSearch from './pages/TrainSearch';
import BookTicket from './pages/BookTicket';
import PNRStatus from './pages/PNRStatus';
import Dashboard from './pages/Dashboard';
import AIFeatures from './pages/AIFeatures';
import './App.css';

function App() {
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <Router>
      <div className="App">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/search" element={<TrainSearch />} />
          <Route path="/book/:trainId" element={isAuthenticated ? <BookTicket /> : <Navigate to="/login" />} />
          <Route path="/pnr" element={<PNRStatus />} />
          <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/ai-features" element={isAuthenticated ? <AIFeatures /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
