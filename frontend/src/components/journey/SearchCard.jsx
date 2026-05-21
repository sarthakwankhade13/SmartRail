import React, { useState } from 'react';
import { MapPin, ArrowRightLeft, Calendar, Search, Sparkles } from 'lucide-react';

export default function SearchCard({ onSearch, loading }) {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!source.trim() || !destination.trim()) return;
    onSearch(source.trim(), destination.trim(), date);
  };

  const swapStations = () => {
    setSource(destination);
    setDestination(source);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-railway-800 via-railway-900 to-railway-950 p-1 shadow-2xl shadow-railway-900/30">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-railway-600/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent-orange/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

      <div className="relative bg-gradient-to-br from-railway-800/80 to-railway-950/80 backdrop-blur-xl rounded-xl p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-accent-orange to-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Journey Planner</h2>
            <p className="text-railway-300 text-sm">Find the best trains for your route</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col lg:flex-row gap-4 items-end">
            {/* Source */}
            <div className="flex-1 w-full">
              <label className="block text-railway-300 text-xs font-semibold uppercase tracking-wider mb-2">
                From Station
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
                <input
                  id="journey-source-input"
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g. New Delhi"
                  className="w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder-railway-400 focus:outline-none focus:ring-2 focus:ring-accent-orange/50 focus:border-accent-orange/50 transition-all text-sm font-medium"
                />
              </div>
            </div>

            {/* Swap Button */}
            <button
              type="button"
              onClick={swapStations}
              className="hidden lg:flex w-12 h-12 bg-white/10 hover:bg-accent-orange/20 border border-white/10 rounded-xl items-center justify-center transition-all hover:scale-110 hover:rotate-180 duration-300 mb-0.5"
              title="Swap stations"
            >
              <ArrowRightLeft className="w-5 h-5 text-accent-orange" />
            </button>

            {/* Mobile swap */}
            <button
              type="button"
              onClick={swapStations}
              className="lg:hidden self-center w-10 h-10 bg-white/10 hover:bg-accent-orange/20 border border-white/10 rounded-full flex items-center justify-center transition-all -my-1"
            >
              <ArrowRightLeft className="w-4 h-4 text-accent-orange rotate-90" />
            </button>

            {/* Destination */}
            <div className="flex-1 w-full">
              <label className="block text-railway-300 text-xs font-semibold uppercase tracking-wider mb-2">
                To Station
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-400" />
                <input
                  id="journey-destination-input"
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Mumbai CST"
                  className="w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder-railway-400 focus:outline-none focus:ring-2 focus:ring-accent-orange/50 focus:border-accent-orange/50 transition-all text-sm font-medium"
                />
              </div>
            </div>

            {/* Date */}
            <div className="w-full lg:w-48">
              <label className="block text-railway-300 text-xs font-semibold uppercase tracking-wider mb-2">
                Journey Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-railway-400" />
                <input
                  id="journey-date-input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-white/10 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-accent-orange/50 focus:border-accent-orange/50 transition-all text-sm font-medium [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Search Button */}
            <button
              id="journey-search-button"
              type="submit"
              disabled={loading || !source.trim() || !destination.trim()}
              className="w-full lg:w-auto px-8 py-3.5 bg-gradient-to-r from-accent-orange to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
