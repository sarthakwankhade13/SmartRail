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
    class: 'SL',
    quota: 'GENERAL'
  });
  const [sourceDisplay, setSourceDisplay] = useState('');
  const [destDisplay, setDestDisplay] = useState('');
  const [visibleCards, setVisibleCards] = useState([]);
  const [stations, setStations] = useState([]);
  const [filteredSourceStations, setFilteredSourceStations] = useState([]);
  const [filteredDestStations, setFilteredDestStations] = useState([]);
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState('booking');
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key') || '');
  const [apiInput, setApiInput] = useState('');
  const [aiStep, setAiStep] = useState(0); // 0: From/To, 1: Date, 2: Preferences, 3: Loading/Results
  const [aiInputValue, setAiInputValue] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'bot', text: 'Hello! I am your AI Travel Assistant. Where are you starting your journey from and what is your destination? (e.g. Mumbai to Delhi)' }
  ]);
  const [aiAnswers, setAiAnswers] = useState({ from_to: '', date: '', preferences: '' });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    localStorage.setItem('openai_api_key', apiInput);
    setApiKey(apiInput);
    setApiInput('');
  };

  const handleAiNext = (e) => {
    e.preventDefault();
    if (!aiInputValue.trim()) return;

    const val = aiInputValue.trim();
    const updatedHistory = [...chatHistory, { role: 'user', text: val }];
    setChatHistory(updatedHistory);
    setAiInputValue('');

    if (aiStep === 0) {
      setAiAnswers(prev => ({ ...prev, from_to: val }));
      setAiStep(1);
      setChatHistory([...updatedHistory, { role: 'bot', text: 'Got it. When are you planning to travel? (e.g. tomorrow, next Monday, or a specific date like 2026-05-25)' }]);
    } else if (aiStep === 1) {
      setAiAnswers(prev => ({ ...prev, date: val }));
      setAiStep(2);
      setChatHistory([...updatedHistory, { role: 'bot', text: 'Perfect. Do you have any class preferences (e.g. AC, Sleeper) or budget/speed priorities (e.g. cheapest, fastest)?' }]);
    } else if (aiStep === 2) {
      const finalAnswers = { ...aiAnswers, preferences: val };
      setAiAnswers(prev => ({ ...prev, preferences: val }));
      setAiStep(3);
      submitAiSearch(finalAnswers);
    }
  };

  const submitAiSearch = async (answers) => {
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    try {
      const response = await axios.post(`${API_URL}/ai/gpt-smart-search`, {
        answers,
        apiKey: apiKey
      });
      setAiResult(response.data);
    } catch (err) {
      console.error('GPT search failed:', err);
      const errMsg = err.response?.data?.error || 'Failed to communicate with the AI travel assistant. Please check your API key.';
      setAiError(errMsg);
      setAiStep(2);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiReset = () => {
    setAiStep(0);
    setAiInputValue('');
    setAiAnswers({ from_to: '', date: '', preferences: '' });
    setChatHistory([
      { role: 'bot', text: 'Hello! I am your AI Travel Assistant. Where are you starting your journey from and what is your destination? (e.g. Mumbai to Delhi)' }
    ]);
    setAiResult(null);
    setAiError('');
  };


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
    setSourceDisplay(value);
    // If user clears input, clear the code too
    if (!value) {
      setSearchData({...searchData, source: ''});
      setShowSourceDropdown(false);
      return;
    }
    // Try to find exact code match first
    const exactCode = stations.find(s => s.station_code.toLowerCase() === value.toLowerCase());
    if (exactCode) {
      setSearchData({...searchData, source: exactCode.station_code});
    } else {
      // Store the typed value as-is (backend will normalize)
      setSearchData({...searchData, source: value.toUpperCase()});
    }
    const filtered = stations.filter(station =>
      station.station_code.toLowerCase().includes(value.toLowerCase()) ||
      station.station_name.toLowerCase().includes(value.toLowerCase()) ||
      station.station_city.toLowerCase().includes(value.toLowerCase())
    ).slice(0, 10);
    setFilteredSourceStations(filtered);
    setShowSourceDropdown(filtered.length > 0);
  };

  const handleDestChange = (value) => {
    setDestDisplay(value);
    if (!value) {
      setSearchData({...searchData, destination: ''});
      setShowDestDropdown(false);
      return;
    }
    const exactCode = stations.find(s => s.station_code.toLowerCase() === value.toLowerCase());
    if (exactCode) {
      setSearchData({...searchData, destination: exactCode.station_code});
    } else {
      setSearchData({...searchData, destination: value.toUpperCase()});
    }
    const filtered = stations.filter(station =>
      station.station_code.toLowerCase().includes(value.toLowerCase()) ||
      station.station_name.toLowerCase().includes(value.toLowerCase()) ||
      station.station_city.toLowerCase().includes(value.toLowerCase())
    ).slice(0, 10);
    setFilteredDestStations(filtered);
    setShowDestDropdown(filtered.length > 0);
  };

  const selectSourceStation = (station) => {
    setSearchData({...searchData, source: station.station_code});
    setSourceDisplay(`${station.station_code} - ${station.station_name}`);
    setShowSourceDropdown(false);
  };

  const selectDestStation = (station) => {
    setSearchData({...searchData, destination: station.station_code});
    setDestDisplay(`${station.station_code} - ${station.station_name}`);
    setShowDestDropdown(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    navigate(`/search?source=${searchData.source}&destination=${searchData.destination}&date=${searchData.date}&class=${searchData.class}&quota=${searchData.quota}`);
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
          <div className="search-card" style={{ maxWidth: activeTab === 'ai-search' ? '600px' : '520px', transition: 'max-width 0.3s' }}>
            <div className="search-tabs">
              <button 
                className={`search-tab ${activeTab === 'booking' ? 'active' : ''}`}
                onClick={() => setActiveTab('booking')}
              >
                BOOK TICKET
              </button>
              <button 
                className={`search-tab ${activeTab === 'ai-search' ? 'active' : ''}`}
                onClick={() => setActiveTab('ai-search')}
              >
                🤖 SMART SEARCH AI
              </button>
              <button className="search-tab" onClick={() => navigate('/pnr')}>
                PNR STATUS
              </button>
              <button className="search-tab" onClick={() => window.open('https://www.irctc.co.in/online-charts/', '_blank', 'noopener,noreferrer')}>
                CHARTS / VACANCY
              </button>
            </div>

            {activeTab === 'booking' ? (
              <div className="search-form-container">
                <h2>BOOK TICKET</h2>
                <form onSubmit={handleSearch}>
                  <div className="form-row-inline">
                    <div className="form-group autocomplete-wrapper">
                      <label>FROM</label>
                      <input
                        type="text"
                        placeholder="Enter Station Name or Code"
                        value={sourceDisplay}
                        onChange={(e) => handleSourceChange(e.target.value)}
                        onFocus={() => sourceDisplay && setShowSourceDropdown(true)}
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
                        value={destDisplay}
                        onChange={(e) => handleDestChange(e.target.value)}
                        onFocus={() => destDisplay && setShowDestDropdown(true)}
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
                    <select value={searchData.quota} onChange={(e) => setSearchData({...searchData, quota: e.target.value})}>
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
            ) : (
              <div className="ai-search-container">
                <div className="ai-search-header">
                  <h3>🤖 AI Travel Planner</h3>
                  {apiKey ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="ai-api-status ready">✓ API Key Set</span>
                      <button 
                        onClick={() => { localStorage.removeItem('openai_api_key'); setApiKey(''); }} 
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline' }}
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <span className="ai-api-status missing">✗ API Key Required</span>
                  )}
                </div>

                {!apiKey && (
                  <div className="ai-api-setup">
                    <p>Enter your OpenAI (ChatGPT) API Key to unlock smart, conversational recommendations based on real train data:</p>
                    <form onSubmit={handleSaveApiKey} className="ai-api-input-group">
                      <input
                        type="password"
                        placeholder="sk-proj-..."
                        value={apiInput}
                        onChange={(e) => setApiInput(e.target.value)}
                        required
                      />
                      <button type="submit" className="btn-ai-save">Save Key</button>
                    </form>
                  </div>
                )}

                {apiKey && (
                  <div className="ai-wizard-box">
                    {/* Progress Bar */}
                    <div className="ai-wizard-progress">
                      <div 
                        className="ai-wizard-progress-bar" 
                        style={{ width: `${(aiStep / 3) * 100}%` }}
                      />
                    </div>

                    {/* Chat Messages */}
                    {aiStep < 3 ? (
                      <>
                        <div className="ai-wizard-chat">
                          {chatHistory.map((msg, i) => (
                            <div key={i} className={`chat-bubble ${msg.role}`}>
                              {msg.text}
                            </div>
                          ))}
                        </div>

                        {/* Input Form */}
                        <form onSubmit={handleAiNext} className="ai-wizard-input-form">
                          <input
                            type="text"
                            placeholder={
                              aiStep === 0 ? "e.g. Mumbai to Delhi" :
                              aiStep === 1 ? "e.g. Tomorrow or 2026-05-25" :
                              "e.g. Cheapest AC or Sleeper class"
                            }
                            value={aiInputValue}
                            onChange={(e) => setAiInputValue(e.target.value)}
                            required
                          />
                          <button type="submit" className="btn-ai-send">➔</button>
                        </form>
                      </>
                    ) : (
                      <div className="ai-results-card">
                        {aiLoading && (
                          <div className="ai-loading-spinner">
                            <span className="spinner-icon">🤖</span>
                            <p>Analyzing route details and composing personalized advice...</p>
                          </div>
                        )}

                        {aiError && (
                          <div style={{ padding: '20px' }}>
                            <div className="ai-error-box">
                              {aiError}
                            </div>
                            <button className="btn-ai-reset" onClick={handleAiReset}>Try Again</button>
                          </div>
                        )}

                        {aiResult && (
                          <div style={{ padding: '20px' }}>
                            <div className="ai-rec-box">
                              <h4>🤖 AI Recommendation</h4>
                              <div style={{ whiteSpace: 'pre-line' }}>{aiResult.recommendation}</div>
                            </div>

                            {/* Direct trains */}
                            {aiResult.trains && aiResult.trains.length > 0 && (
                              <div>
                                <h4 style={{ color: '#2c5282', marginBottom: '10px' }}>Available Direct Trains</h4>
                                <div className="ai-trains-list">
                                  {aiResult.trains.map((train) => (
                                    <div key={train.train_number} className="ai-train-item">
                                      <div className="ai-train-row">
                                        <div className="ai-train-name">
                                          <h4>{train.train_number} — {train.train_name}</h4>
                                          <span className="ai-train-type">{train.train_type}</span>
                                        </div>
                                        <div className="ai-train-fare">
                                          ₹{train.fare}
                                        </div>
                                      </div>
                                      <div className="ai-time-row">
                                        <div className="ai-time-node">
                                          <strong>{train.departure_time}</strong>
                                          <span>{train.source_station}</span>
                                        </div>
                                        <div className="ai-time-arrow">➔</div>
                                        <div className="ai-time-node" style={{ textAlign: 'right' }}>
                                          <strong>{train.arrival_time}</strong>
                                          <span>{train.destination_station}</span>
                                        </div>
                                      </div>
                                      <div className="ai-train-actions">
                                        <button
                                          className="btn-ai-book"
                                          onClick={() => navigate(`/book/${train.train_number}?source=${train.source_station_code || aiResult.resolvedSource?.stnCode || train.source_station}&destination=${train.destination_station_code || aiResult.resolvedDestination?.stnCode || train.destination_station}&date=${aiResult.travelDate}&class=${aiResult.class || 'SL'}`)}
                                        >
                                          Book Now
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Connecting / Split options if direct are empty */}
                            {(!aiResult.trains || aiResult.trains.length === 0) && (
                              <div>
                                {aiResult.connectingRoutes && aiResult.connectingRoutes.length > 0 && (
                                  <div>
                                    <h4 style={{ color: '#2c5282', marginBottom: '10px' }}>Connecting Routes</h4>
                                    <div className="ai-trains-list">
                                      {aiResult.connectingRoutes.map((route, i) => (
                                        <div key={i} className="ai-train-item">
                                          <div className="ai-train-row">
                                            <div className="ai-train-name">
                                              <h4>Connecting via {route.via}</h4>
                                              <span className="ai-train-type">{route.note}</span>
                                            </div>
                                            <div className="ai-train-fare">
                                              ₹{route.total_fare}
                                            </div>
                                          </div>
                                          <div className="ai-train-actions">
                                            <button
                                              className="btn-ai-book"
                                              onClick={() => navigate(`/journey-planner`)}
                                            >
                                              Open Journey Planner
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            <button className="btn-ai-reset" onClick={handleAiReset}>Start New Search</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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
