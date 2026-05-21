import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './TrainSearch.css';

const API_URL = process.env.REACT_APP_API_URL;

function TrainSearch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiRoutes, setAiRoutes] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [smartQuery, setSmartQuery] = useState('');
  const [smartResult, setSmartResult] = useState(null);
  const [showAiOptimizer, setShowAiOptimizer] = useState(false);
  const [filterClass, setFilterClass] = useState('all');
  const [sortBy, setSortBy] = useState('departure');
  const [searchForm, setSearchForm] = useState({
    source: '',
    destination: '',
    date: '',
    classType: ''
  });
  const [stations, setStations] = useState([]);

  useEffect(() => {
    const source = searchParams.get('source');
    const destination = searchParams.get('destination');
    const date = searchParams.get('date');
    const classType = searchParams.get('class');
    
    // Initialize search form from URL params
    setSearchForm({
      source: source || '',
      destination: destination || '',
      date: date || '',
      classType: classType || ''
    });
    
    if (source && destination && date) {
      doSearch(source, destination, date, classType);
    }

    // Fetch stations for dropdowns
    fetchStations();
  }, [searchParams]);

  const fetchStations = async () => {
    try {
      const response = await axios.get(`${API_URL}/stations`);
      setStations(response.data);
    } catch (error) {
      console.error('Failed to fetch stations:', error);
    }
  };

  const doSearch = async (source, destination, date, classType) => {
    setLoading(true);
    setAiRoutes(null);
    setShowAiOptimizer(false);
    try {
      const response = await axios.get(`${API_URL}/trains/search`, {
        params: { source, destination, date, class: classType }
      });
      setTrains(response.data);

      // If no direct trains, show AI optimizer option instead of auto-triggering
      if (response.data.length === 0) {
        setShowAiOptimizer(true);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const findAlternativeRoutes = async (source, destination, date) => {
    setAiLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_URL}/ai/route-optimizer`, {
        sourceCode: source,
        destinationCode: destination,
        travelDate: date
      }, { headers: { Authorization: `Bearer ${token}` } });
      setAiRoutes(response.data);
    } catch (err) {
      console.error('Route optimizer failed:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSmartSearch = async (e) => {
    e.preventDefault();
    if (!smartQuery.trim()) return;
    setLoading(true);
    setSmartResult(null);
    try {
      const response = await axios.post(`${API_URL}/ai/smart-search`, {
        query: smartQuery,
        source: searchParams.get('source') || '',
        destination: searchParams.get('destination') || '',
        date: searchParams.get('date') || ''
      });
      setSmartResult(response.data);
      setTrains(response.data.trains || []);
    } catch (err) {
      console.error('Smart search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBook = (trainNumber, classType) => {
    const token = localStorage.getItem('token');
    if (!token) { navigate('/login'); return; }
    const params = new URLSearchParams(searchParams);
    if (classType) params.set('class', classType);
    navigate(`/book/${trainNumber}?${params.toString()}`);
  };

  const handleSearchFormSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchForm.source) params.set('source', searchForm.source);
    if (searchForm.destination) params.set('destination', searchForm.destination);
    if (searchForm.date) params.set('date', searchForm.date);
    if (searchForm.classType) params.set('class', searchForm.classType);
    navigate(`/search?${params.toString()}`);
  };

  const handleNextDate = () => {
    const currentDate = searchForm.date || new Date().toISOString().split('T')[0];
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split('T')[0];
    
    const params = new URLSearchParams(searchParams);
    params.set('date', nextDateStr);
    navigate(`/search?${params.toString()}`);
  };

  const handlePrevDate = () => {
    const currentDate = searchForm.date || new Date().toISOString().split('T')[0];
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split('T')[0];
    
    const params = new URLSearchParams(searchParams);
    params.set('date', prevDateStr);
    navigate(`/search?${params.toString()}`);
  };

  const handleFilterStationChange = (field, value) => {
    const params = new URLSearchParams(searchParams);
    params.set(field, value);
    navigate(`/search?${params.toString()}`);
  };

  const handleFilterDateChange = (date) => {
    const params = new URLSearchParams(searchParams);
    params.set('date', date);
    navigate(`/search?${params.toString()}`);
  };

  const source = searchParams.get('source');
  const destination = searchParams.get('destination');

  // Filter and sort trains
  const filteredTrains = trains.filter(train => {
    if (filterClass === 'all') return true;
    return train.class_fares && train.class_fares[filterClass];
  });

  const sortedTrains = [...filteredTrains].sort((a, b) => {
    if (sortBy === 'departure') {
      return a.departure_time.localeCompare(b.departure_time);
    } else if (sortBy === 'arrival') {
      return a.arrival_time.localeCompare(b.arrival_time);
    } else if (sortBy === 'price') {
      return (a.fare || 0) - (b.fare || 0);
    } else if (sortBy === 'duration') {
      return (a.duration_h || 0) - (b.duration_h || 0);
    }
    return 0;
  });

  return (
    <div className="container">
      {/* Search Form */}
      <div className="card search-form-card">
        <form onSubmit={handleSearchFormSubmit} className="search-form">
          <div className="search-form-row">
            <div className="search-form-group">
              <label>From</label>
              <input
                type="text"
                value={searchForm.source}
                onChange={(e) => setSearchForm({...searchForm, source: e.target.value})}
                placeholder="Source Station"
                className="search-input"
              />
            </div>
            <div className="search-form-group">
              <label>To</label>
              <input
                type="text"
                value={searchForm.destination}
                onChange={(e) => setSearchForm({...searchForm, destination: e.target.value})}
                placeholder="Destination Station"
                className="search-input"
              />
            </div>
            <div className="search-form-group">
              <label>Date</label>
              <input
                type="date"
                value={searchForm.date}
                onChange={(e) => setSearchForm({...searchForm, date: e.target.value})}
                className="search-input"
              />
            </div>
            <div className="search-form-group">
              <label>Class</label>
              <select
                value={searchForm.classType}
                onChange={(e) => setSearchForm({...searchForm, classType: e.target.value})}
                className="search-input"
              >
                <option value="">All Classes</option>
                <option value="2S">2S</option>
                <option value="SL">SL</option>
                <option value="CC">CC</option>
                <option value="3A">3A</option>
                <option value="2A">2A</option>
                <option value="1A">1A</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary search-btn">
              🔍 Search
            </button>
          </div>
          
          {/* Date Navigation */}
          {searchForm.date && (
            <div className="date-navigation">
              <button type="button" onClick={handlePrevDate} className="btn btn-secondary date-nav-btn">
                ← Previous Day
              </button>
              <span className="current-date">{searchForm.date}</span>
              <button type="button" onClick={handleNextDate} className="btn btn-secondary date-nav-btn">
                Next Day →
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Smart Search Bar */}
      <div className="card smart-search-card">
        <div className="smart-search-header">
          <span className="ai-badge">🤖 AI</span>
          <h3>Smart Search</h3>
          <p>Try: "Cheapest train to Delhi tomorrow" or "Fast AC train tonight"</p>
        </div>
        <form onSubmit={handleSmartSearch} className="smart-search-form">
          <input
            type="text"
            value={smartQuery}
            onChange={(e) => setSmartQuery(e.target.value)}
            placeholder='e.g. "Cheapest train to Mumbai tomorrow"'
            className="smart-search-input"
          />
          <button type="submit" className="btn btn-ai" disabled={loading}>
            {loading ? '...' : '🔍 Ask AI'}
          </button>
        </form>
        {smartResult && (
          <div className="smart-result-meta">
            {smartResult.fuzzyCorrections?.source && (
              <span className="correction-badge">📍 Source: {smartResult.fuzzyCorrections.source}</span>
            )}
            {smartResult.fuzzyCorrections?.destination && (
              <span className="correction-badge">📍 Destination: {smartResult.fuzzyCorrections.destination}</span>
            )}
            {smartResult.travelDate && (
              <span className="correction-badge">📅 Date: {smartResult.travelDate}</span>
            )}
            {smartResult.sortBy !== 'default' && (
              <span className="correction-badge">🔃 Sorted by: {smartResult.sortBy}</span>
            )}
          </div>
        )}
      </div>

      {/* Main Results */}
      <div className="card">
        <h2>Available Trains
          {source && destination && <span className="route-label"> — {source} → {destination}</span>}
        </h2>

        {/* Filter Bar */}
        {!loading && trains.length > 0 && (
          <div className="filter-bar">
            <div className="filter-group">
              <label>From:</label>
              <select 
                value={source || ''} 
                onChange={(e) => handleFilterStationChange('source', e.target.value)}
                className="filter-select"
              >
                <option value="">Select Source</option>
                {stations.map(station => (
                  <option key={station.station_code} value={station.station_code}>
                    {station.station_name} ({station.station_code})
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>To:</label>
              <select 
                value={destination || ''} 
                onChange={(e) => handleFilterStationChange('destination', e.target.value)}
                className="filter-select"
              >
                <option value="">Select Destination</option>
                {stations.map(station => (
                  <option key={station.station_code} value={station.station_code}>
                    {station.station_name} ({station.station_code})
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Date:</label>
              <input 
                type="date" 
                value={searchForm.date || ''} 
                onChange={(e) => handleFilterDateChange(e.target.value)}
                className="filter-select"
              />
            </div>
            <div className="filter-group">
              <label>Filter by Class:</label>
              <select 
                value={filterClass} 
                onChange={(e) => setFilterClass(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Classes</option>
                <option value="2S">2S (Second Sitting)</option>
                <option value="SL">SL (Sleeper)</option>
                <option value="CC">CC (Chair Car)</option>
                <option value="3A">3A (AC 3 Tier)</option>
                <option value="2A">2A (AC 2 Tier)</option>
                <option value="1A">1A (AC First)</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Sort by:</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="filter-select"
              >
                <option value="departure">Departure Time</option>
                <option value="arrival">Arrival Time</option>
                <option value="price">Price (Low to High)</option>
                <option value="duration">Duration</option>
              </select>
            </div>
            <div className="filter-info">
              <span>{sortedTrains.length} train(s) found</span>
            </div>
          </div>
        )}

        {loading && <div className="loading-spinner"><p>🔍 Searching trains...</p></div>}

        {!loading && trains.length > 0 && (
          <div className="trains-list">
            {sortedTrains.map((train) => (
              <div key={train.train_number} className="train-card">
                <div className="train-info">
                  <h3>{train.train_number} — {train.train_name}</h3>
                  {train.train_type && <span className="train-type-badge">{train.train_type}</span>}
                </div>
                <div className="train-details">
                  <div className="time-info">
                    <div className="station-time">
                      <strong>{train.source_station}</strong>
                      <p>{train.departure_time}</p>
                    </div>
                    <div className="arrow-block">
                      <div className="arrow">→</div>
                      {train.distance_km && (
                        <div className="distance-label">{train.distance_km} km</div>
                      )}
                    </div>
                    <div className="station-time">
                      <strong>{train.destination_station}</strong>
                      <p>{train.arrival_time}</p>
                    </div>
                  </div>

                  {/* Class-wise fare table */}
                  {train.class_fares && (
                    <div className="fare-table">
                      {Object.entries(train.class_fares)
                        .filter(([, f]) => f && f.totalFare > 0)
                        .sort((a, b) => a[1].totalFare - b[1].totalFare)
                        .map(([cls, f]) => {
                          const availability = f.availability || 'AVAIL';
                          let availText = 'Avail';
                          let availClass = 'avail';
                          
                          if (availability === 'WL') {
                            availText = `WL ${f.waitlist_number || 1}`;
                            availClass = 'wl';
                          } else if (availability === 'RAC') {
                            availText = `RAC ${f.rac_number || 1}`;
                            availClass = 'rac';
                          }
                          
                          return (
                            <div
                              key={cls}
                              className={`fare-cell ${searchParams.get('class') === cls ? 'selected-class' : ''}`}
                              title={`Base: ₹${f.baseFare} | Res: ₹${f.reservationCharge} | SF: ₹${f.superfastCharge} | GST: ₹${f.gst}`}
                            >
                              <span className="fare-class">{cls}</span>
                              <span className="fare-amount">₹{f.totalFare}</span>
                              <span className={`fare-avail ${availClass}`}>{availText}</span>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {!train.class_fares && (
                    <div className="availability">
                      <p>Fare: <strong>₹{train.fare}</strong></p>
                    </div>
                  )}
                </div>
                <div className="train-card-actions">
                  <button
                    className="btn btn-primary"
                    onClick={() => handleBook(train.train_number, searchParams.get('class'))}
                    disabled={train.available_seats === 0}
                  >
                    {train.available_seats > 0 ? 'Book Now' : 'Sold Out'}
                  </button>
                  <button
                    className="btn btn-wl"
                    onClick={() => navigate(`/waitlist?train=${train.train_number}&date=${searchParams.get('date')}&class=${searchParams.get('class')}`)}
                    title="Check waitlist confirmation probability"
                  >
                    🎯 Check WL
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Results — AI Route Optimizer */}
        {!loading && trains.length === 0 && (
          <div className="no-results">
            <p className="no-results-text">😔 No direct trains found for this route.</p>
            
            {showAiOptimizer && !aiRoutes && (
              <button 
                className="btn btn-ai" 
                onClick={() => findAlternativeRoutes(source, destination, searchParams.get('date'))}
                disabled={aiLoading}
              >
                {aiLoading ? '🤖 AI is finding alternative routes...' : '🤖 Find Alternative Routes with AI'}
              </button>
            )}

            {aiLoading && <p className="ai-thinking">🤖 AI is finding alternative routes...</p>}

            {aiRoutes && (
              <div className="ai-routes-section">
                <div className={`ai-recommendation ${aiRoutes.recommendation?.type}`}>
                  <h4>🤖 AI Recommendation</h4>
                  <p>{aiRoutes.recommendation?.message}</p>
                  {aiRoutes.recommendation?.confirmationChance > 0 && (
                    <span className="confidence-badge">
                      {aiRoutes.recommendation.confirmationChance}% confirmation chance
                    </span>
                  )}
                </div>

                {aiRoutes.connectingRoutes?.length > 0 && (
                  <div className="connecting-routes">
                    <h4>🔗 Connecting Routes</h4>
                    {aiRoutes.connectingRoutes.map((route, i) => (
                      <div key={i} className="route-option">
                        <p className="route-note">{route.note}</p>
                        {route.legs?.map((leg, j) => (
                          <div key={j} className="route-leg">
                            <span>{leg.train_name || leg.train_number}</span>
                            <span>{leg.source_station} → {leg.destination_station}</span>
                            <span>₹{leg.fare}</span>
                          </div>
                        ))}
                        <p className="route-total">Total: ₹{route.total_fare}</p>
                      </div>
                    ))}
                  </div>
                )}

                {aiRoutes.splitBookingOptions?.length > 0 && (
                  <div className="split-booking">
                    <h4>✂️ Split Booking Options</h4>
                    {aiRoutes.splitBookingOptions.map((opt, i) => (
                      <div key={i} className="route-option">
                        <p className="route-note">{opt.note}</p>
                        <div className="route-leg">
                          <span>{opt.leg1?.from} → {opt.leg1?.to}</span>
                          <span>Dep: {opt.leg1?.departure}</span>
                          <span>₹{opt.leg1?.fare}</span>
                        </div>
                        <div className="route-leg">
                          <span>{opt.leg2?.from} → {opt.leg2?.to}</span>
                          <span>Dep: {opt.leg2?.departure}</span>
                          <span>₹{opt.leg2?.fare}</span>
                        </div>
                        <p className="route-total">Total: ₹{opt.total_fare}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default TrainSearch;
