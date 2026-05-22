import React, { useState, useEffect } from 'react';
import { RefreshCw, Users, Shield, Sparkles, CheckCircle } from 'lucide-react';
import { requestExchange, getMatches, acceptExchange } from '../services/exchangeApi';
import ExchangeCard from '../components/exchange/ExchangeCard';
import LoadingSpinner from '../components/journey/LoadingSpinner'; // reuse journey spinner

const SEAT_TYPES = [
  'Lower Berth', 'Middle Berth', 'Upper Berth', 
  'Side Lower', 'Side Upper', 
  'Window Seat', 'Aisle Seat', 'Middle Seat'
];

export default function SeatExchange() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  
  const [myRequestId, setMyRequestId] = useState(null);
  const [matches, setMatches] = useState([]);
  
  const [formData, setFormData] = useState({
    pnr_number: '',
    train_number: '',
    coach_number: '',
    seat_number: '',
    name: '',
    age: '',
    gender: 'M',
    current_seat_type: 'Middle Berth',
    requested_seat_type: 'Lower Berth'
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await requestExchange(formData);
      setMyRequestId(res.request_id);
      fetchMatches(res.request_id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit request');
      setLoading(false);
    }
  };

  const fetchMatches = async (reqId) => {
    try {
      const res = await getMatches(reqId);
      setMatches(res.matches || []);
    } catch (err) {
      console.error('Failed to fetch matches', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (targetReqId) => {
    setLoading(true);
    try {
      await acceptExchange(myRequestId, targetReqId);
      setSuccessMsg('Seat Exchange Approved Successfully! Check your PNR status.');
      setMatches([]); // Clear matches on success
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to accept exchange');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = (targetReqId) => {
    // In a real app, this might ping the server. Here we just hide the card.
    setMatches(matches.filter(m => m.request_id !== targetReqId));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-20">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-railway-900 to-railway-950 pb-24 pt-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-railway-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md">
              <Users className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white">Smart Seat Exchange</h1>
              <p className="text-railway-300">Intelligently swap seats with co-passengers</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Request Form */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 border border-slate-100">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-accent-orange" />
              New Request
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">PNR Number</label>
                  <input required name="pnr_number" onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-railway-500" placeholder="10-digit PNR" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Train No.</label>
                  <input required name="train_number" onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-railway-500" placeholder="e.g. 12951" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Coach</label>
                  <input required name="coach_number" onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-railway-500" placeholder="e.g. B4" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Seat</label>
                  <input required name="seat_number" onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-railway-500" placeholder="e.g. 45" />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Passenger Name</label>
                <input required name="name" onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-railway-500" placeholder="Full Name" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Age</label>
                  <input required type="number" name="age" onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-railway-500" placeholder="Age" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Gender</label>
                  <select name="gender" onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-railway-500">
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="O">Other</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Current Seat Type</label>
                <select name="current_seat_type" value={formData.current_seat_type} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-railway-500">
                  {SEAT_TYPES.map(s => <option key={`c-${s}`} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Requested Seat Type</label>
                <select name="requested_seat_type" value={formData.requested_seat_type} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-railway-500">
                  {SEAT_TYPES.map(s => <option key={`r-${s}`} value={s}>{s}</option>)}
                </select>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full mt-4 py-3 bg-railway-600 hover:bg-railway-700 text-white font-bold rounded-xl shadow-lg shadow-railway-500/30 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && !myRequestId ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Find Matches
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Results */}
        <div className="lg:col-span-8">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-medium mb-6">
              {error}
            </div>
          )}
          
          {successMsg && (
            <div className="p-6 bg-emerald-50 border-2 border-emerald-200 rounded-2xl text-emerald-800 flex items-center gap-4 mb-6 animate-fade-in">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Exchange Approved!</h3>
                <p className="text-emerald-600 font-medium">{successMsg}</p>
              </div>
            </div>
          )}

          {loading && myRequestId && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 flex justify-center">
              <LoadingSpinner />
            </div>
          )}

          {!loading && myRequestId && matches.length === 0 && !successMsg && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <RefreshCw className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-700 mb-2">No Matches Found</h3>
              <p className="text-slate-500 max-w-md">
                We couldn't find any passengers in your train looking for a {formData.current_seat_type} right now. We'll keep your request active.
              </p>
            </div>
          )}

          {!loading && matches.length > 0 && !successMsg && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">
                  {matches.length} Compatible Match{matches.length !== 1 ? 'es' : ''}
                </h2>
                <span className="px-3 py-1 bg-railway-50 text-railway-600 text-xs font-bold uppercase rounded-lg">Auto-sorted by score</span>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2">
                {matches.map(match => (
                  <ExchangeCard 
                    key={match.request_id} 
                    match={match} 
                    onAccept={handleAccept}
                    onReject={handleReject}
                    processing={loading}
                  />
                ))}
              </div>
            </div>
          )}
          
          {!myRequestId && !loading && !successMsg && (
             <div className="bg-gradient-to-br from-railway-50 to-white rounded-2xl shadow-sm border border-slate-100 p-12 h-full flex flex-col items-center justify-center text-center min-h-[400px]">
               <div className="w-24 h-24 bg-white shadow-sm rounded-full flex items-center justify-center mb-6 relative">
                 <Users className="w-10 h-10 text-railway-400" />
                 <div className="absolute -top-1 -right-1 w-8 h-8 bg-emerald-100 rounded-full border-2 border-white flex items-center justify-center">
                   <Sparkles className="w-4 h-4 text-emerald-500" />
                 </div>
               </div>
               <h3 className="text-2xl font-bold text-slate-700 mb-3">Intelligent Matching</h3>
               <p className="text-slate-500 max-w-md leading-relaxed">
                 Our system analyzes seat preferences, coach proximity, and demographics to find mutually beneficial seat exchanges for a comfortable journey.
               </p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
