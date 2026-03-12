import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Home.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function Home() {
  const navigate = useNavigate();
  const [searchData, setSearchData] = useState({
    source: '',
    destination: '',
    date: '',
    class: 'SL'
  });
  const [visibleCards, setVisibleCards] = useState([]);
  const [stations, setStations] = useState([]);
  const [filteredSourceStations, setFilteredSourceStations] = useState([]);
  const [filteredDestStations, setFilteredDestStations] = useState([]);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);

  // Fetch stations on component mount
  useEffect(() => {
    const fetchStations = async () => {
      try {
        const response = await axios.get(`${API_URL}/stations`);
        setStations(response.data);
      } catch (error) {
        console.error('Failed to fetch stations:', error);
      }
    };
    fetchStations();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const cards = document.querySelectorAll('.feature-card');
      cards.forEach((card, index) => {
        const rect = card.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight - 100;
        
        if (isVisible && !visibleCards.includes(index)) {
          setTimeout(() => {
            setVisibleCards(prev => [...prev, index]);
          }, index * 150);
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check on mount
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, [visibleCards]);

  // Filter stations based on input
  const handleSourceChange = (value) => {
    setSearchData({...searchData, source: value.toUpperCase()});
    if (value.length > 0) {
      const filtered = stations.filter(station => 
        station.station_code.toLowerCase().includes(value.toLowerCase()) ||
        station.station_name.toLowerCase().includes(value.toLowerCase()) ||
        station.station_city.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 10);
      setFilteredSourceStations(filtered);
      setShowSourceDropdown(true);
    } else {
      setShowSourceDropdown(false);
    }
  };

  const handleDestChange = (value) => {
    setSearchData({...searchData, destination: value.toUpperCase()});
    if (value.length > 0) {
      const filtered = stations.filter(station => 
        station.station_code.toLowerCase().includes(value.toLowerCase()) ||
        station.station_name.toLowerCase().includes(value.toLowerCase()) ||
        station.station_city.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 10);
      setFilteredDestStations(filtered);
      setShowDestDropdown(true);
    } else {
      setShowDestDropdown(false);
    }
  };

  const selectSourceStation = (station) => {
    setSearchData({...searchData, source: station.station_code});
    setShowSourceDropdown(false);
  };

  const selectDestStation = (station) => {
    setSearchData({...searchData, destination: station.station_code});
    setShowDestDropdown(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/search?source=${searchData.source}&destination=${searchData.destination}&date=${searchData.date}&class=${searchData.class}`);
  };

  const features = [
    {
      icon: '🎯',
      title: 'AI Waitlist Prediction',
      description: 'Predicts whether a waitlisted ticket will get confirmed using advanced machine learning algorithms and historical booking patterns.',
      color: '#3b82f6'
    },
    {
      icon: '💺',
      title: 'Smart Seat Recommendation',
      description: 'Suggests best seats based on your preferences - window seats, family seating together, lower berth, and less crowded coaches.',
      color: '#8b5cf6'
    },
    {
      icon: '📊',
      title: 'Dynamic Pricing Analysis',
      description: 'Analyzes historical ticket price trends and predicts the best booking time to get optimal fares for your journey.',
      color: '#ec4899'
    },
    {
      icon: '🔄',
      title: 'Seat Swap Platform',
      description: 'Passengers can exchange seats digitally with other travelers for better convenience and comfort during the journey.',
      color: '#f59e0b'
    },
    {
      icon: '🗺️',
      title: 'Journey Planner',
      description: 'Finds optimal train routes with fewer delays, cheaper fares, and minimum train changes for your destination.',
      color: '#10b981'
    },
    {
      icon: '⏱️',
      title: 'Train Delay Prediction',
      description: 'Uses historical train data and real-time analytics to predict potential delays and help you plan better.',
      color: '#ef4444'
    }
  ];

  return (
    <div className="home">
      <div className="hero-section">
        <div className="booking-overlay">
          <div className="search-card">
            <div className="search-tabs">
              <button className="search-tab active">
                BOOK TICKET
              </button>
              <button className="search-tab" onClick={() => navigate('/pnr')}>
                PNR STATUS
              </button>
              <button className="search-tab">
                CHARTS / VACANCY
              </button>
            </div>

            <div className="search-form-container">
              <h2>BOOK TICKET</h2>
              <form onSubmit={handleSearch}>
                <div className="form-row-inline">
                  <div className="form-group autocomplete-wrapper">
                    <label>FROM</label>
                    <input
                      type="text"
                      placeholder="Enter Station Name or Code"
                      value={searchData.source}
                      onChange={(e) => handleSourceChange(e.target.value)}
                      onFocus={() => searchData.source && setShowSourceDropdown(true)}
                      onBlur={() => setTimeout(() => setShowSourceDropdown(false), 200)}
                      required
                    />
                    {showSourceDropdown && filteredSourceStations.length > 0 && (
                      <div className="autocomplete-dropdown">
                        {filteredSourceStations.map((station, index) => (
                          <div 
                            key={index} 
                            className="autocomplete-item"
                            onClick={() => selectSourceStation(station)}
                          >
                            <strong>{station.station_code}</strong> - {station.station_name}
                            <br />
                            <small>{station.station_city}</small>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="swap-icon-inline">⇄</div>
                  <div className="form-group autocomplete-wrapper">
                    <label>TO</label>
                    <input
                      type="text"
                      placeholder="Enter Station Name or Code"
                      value={searchData.destination}
                      onChange={(e) => handleDestChange(e.target.value)}
                      onFocus={() => searchData.destination && setShowDestDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDestDropdown(false), 200)}
                      required
                    />
                    {showDestDropdown && filteredDestStations.length > 0 && (
                      <div className="autocomplete-dropdown">
                        {filteredDestStations.map((station, index) => (
                          <div 
                            key={index} 
                            className="autocomplete-item"
                            onClick={() => selectDestStation(station)}
                          >
                            <strong>{station.station_code}</strong> - {station.station_name}
                            <br />
                            <small>{station.station_city}</small>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-row-inline">
                  <div className="form-group">
                    <label>DD/MM/YYYY *</label>
                    <input
                      type="date"
                      value={searchData.date}
                      onChange={(e) => setSearchData({...searchData, date: e.target.value})}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>ALL CLASSES</label>
                    <select value={searchData.class} onChange={(e) => setSearchData({...searchData, class: e.target.value})}>
                      <option value="EA">Anubhuti Class (EA)</option>
                      <option value="1A">AC First Class (1A)</option>
                      <option value="EV">Vistadome AC (EV)</option>
                      <option value="EC">Exec. Chair Car (EC)</option>
                      <option value="2A">AC 2 Tier (2A)</option>
                      <option value="FC">First Class (FC)</option>
                      <option value="3A">AC 3 Tier (3A)</option>
                      <option value="3E">AC 3 Economy (3E)</option>
                      <option value="VC">Vistadome Chair Car (VC)</option>
                      <option value="CC">AC Chair car (CC)</option>
                      <option value="SL">Sleeper (SL)</option>
                      <option value="VS">Vistadome Non AC (VS)</option>
                      <option value="2S">Second Sitting (2S)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>QUOTA</label>
                  <select>
                    <option value="GENERAL">GENERAL</option>
                    <option value="LADIES">LADIES</option>
                    <option value="LOWER_BERTH">LOWER BERTH/SR.CITIZEN</option>
                    <option value="PERSON_WITH_DISABILITY">PERSON WITH DISABILITY</option>
                    <option value="DUTY_PASS">DUTY PASS</option>
                    <option value="TATKAL">TATKAL</option>
                    <option value="PREMIUM_TATKAL">PREMIUM TATKAL</option>
                  </select>
                </div>

                <div className="search-button-container">
                  <button type="submit" className="btn-search">SEARCH TRAINS</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="features-section">
          <div className="features-header">
            <h2>AI-Powered Smart Features</h2>
            <p>Experience the future of railway booking with our intelligent features</p>
          </div>
          
          <div className="features-grid">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className={`feature-card ${visibleCards.includes(index) ? 'visible' : ''}`}
                style={{ '--accent-color': feature.color }}
              >
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <div className="feature-overlay" style={{ background: feature.color }}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
