import React, { useState } from 'react';
import { Train, AlertTriangle } from 'lucide-react';
import SearchCard from '../components/journey/SearchCard';
import TrainCard from '../components/journey/TrainCard';
import RouteModal from '../components/journey/RouteModal';
import LoadingSpinner from '../components/journey/LoadingSpinner';
import EmptyState from '../components/journey/EmptyState';
import { searchTrains, fetchTrainByNumber } from '../services/journeyApi';
import './JourneyPlanner.css';

export default function JourneyPlanner() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedTrain, setSelectedTrain] = useState(null);
  const [searchInfo, setSearchInfo] = useState({ source: '', destination: '' });

  const handleSearch = async (source, destination, date) => {
    setLoading(true);
    setError(null);
    setHasSearched(true);
    setSearchInfo({ source, destination });
    try {
      const data = await searchTrains(source, destination);
      setResults(data.data || []);
    } catch (err) {
      console.error('Search failed:', err);
      setError(
        err.response?.data?.error ||
        err.message ||
        'Failed to search trains. Please try again.'
      );
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewRoute = async (train) => {
    // If the train already has stops, show directly
    if (train.stops && train.stops.length > 0) {
      setSelectedTrain(train);
      return;
    }
    // Otherwise fetch full details
    try {
      const data = await fetchTrainByNumber(train.trainNumber);
      setSelectedTrain(data.data || train);
    } catch (err) {
      console.error('Failed to fetch route:', err);
      setSelectedTrain(train);
    }
  };

  return (
    <div className="journey-planner-page min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Hero section */}
      <div className="bg-gradient-to-br from-railway-900 via-railway-800 to-railway-950 pb-32 pt-8 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0">
          <div className="absolute top-10 left-10 w-72 h-72 bg-railway-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-10 w-96 h-96 bg-accent-orange/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-railway-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-4">
              <Train className="w-4 h-4 text-accent-orange" />
              <span className="text-xs font-semibold text-railway-200 uppercase tracking-wider">SmartRail Journey Planner</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
              Plan Your Perfect Journey
            </h1>
            <p className="text-railway-300 text-lg max-w-2xl mx-auto">
              Search across hundreds of trains, compare timings, and discover the best route for your trip.
            </p>
          </div>
        </div>
      </div>

      {/* Search card (overlapping hero) */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 relative z-10">
        <SearchCard onSearch={handleSearch} loading={loading} />
      </div>

      {/* Results section */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Results header */}
        {hasSearched && !loading && results.length > 0 && (
          <div className="flex items-center justify-between mb-6 animate-fade-in">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {results.length} Train{results.length !== 1 ? 's' : ''} Found
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {searchInfo.source} → {searchInfo.destination}
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
              <Train className="w-3.5 h-3.5" />
              Sorted by departure time
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl mb-6 animate-slide-down">
            <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-700">Search Error</p>
              <p className="text-sm text-rose-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && <LoadingSpinner />}

        {/* Train cards */}
        {!loading && results.length > 0 && (
          <div className="grid gap-5">
            {results.map((train, index) => (
              <TrainCard
                key={train.id}
                train={train}
                index={index}
                onViewRoute={handleViewRoute}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && results.length === 0 && (
          <EmptyState hasSearched={hasSearched} />
        )}
      </div>

      {/* Route Modal */}
      {selectedTrain && (
        <RouteModal
          train={selectedTrain}
          onClose={() => setSelectedTrain(null)}
        />
      )}
    </div>
  );
}
