import React, { useState, useEffect } from 'react';
import './App.css';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';

// API base URL - will use environment variable in production
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://v7ka0hnhgg.execute-api.us-east-1.amazonaws.com/prod';

function App() {
  const [repo, setRepo] = useState('');
  const [starData, setStarData] = useState(null);
  const [starHistory, setStarHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('promptfoo');
  const [prVelocity, setPrVelocity] = useState([]);
  const [issueHealth, setIssueHealth] = useState([]);
  const [packageDownloads, setPackageDownloads] = useState([]);

  function parseRepo(input) {
    const match = input.match(/github\.com\/(.+?\/[^\/?#]+)/);
    if (match) return match[1];
    return input.trim();
  }

  const fetchStars = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setStarData(null);
    try {
      const repoParam = parseRepo(repo);
      const res = await fetch(`${API_BASE_URL}/api/stars?repo=${repoParam}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStarData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch star history for promptfoo/promptfoo on mount
  useEffect(() => {
    async function fetchHistory() {
      try {
        if (!window.location.hostname.includes('d14l4o1um83q49')) {
          console.log('🔄 Fetching star history...');
        }
        const res = await fetch(`${API_BASE_URL}/api/star-history`);
        const data = await res.json();
        if (!window.location.hostname.includes('d14l4o1um83q49')) {
          console.log('📊 Star history raw response:', data);
        }
        if (Array.isArray(data)) {
          const processedData = data.map(d => ({
            ...d,
            // Keep original timestamp for chart, but format for display
            timestamp: d.timestamp,
            displayTimestamp: (() => {
              let dateObj;
              if (d.timestamp.includes('T') && d.timestamp.includes('Z')) {
                // Already in ISO format: "2025-07-27T01:00:11.206Z"
                dateObj = new Date(d.timestamp);
              } else {
                // Old format: "2025-07-25 07:20:00"
                dateObj = new Date(d.timestamp.replace(' ', 'T') + 'Z');
              }
              return dateObj.toLocaleString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
              });
            })()
          }));
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.log('📊 Processed star history data:', processedData);
          }
          setStarHistory(processedData);
        } else if (data && data.error) {
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.error('📊 Star history error:', data.error);
          }
          setError('Failed to load star history: ' + data.error);
        } else {
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.error('📊 Unexpected star history response:', data);
          }
          setError('Failed to load star history: Unexpected response');
        }
      } catch (err) {
        if (!window.location.hostname.includes('d14l4o1um83q49')) {
          console.error('📊 Star history fetch error:', err);
        }
        setError('Failed to load star history: ' + err.message);
      }
    }
    fetchHistory();
  }, []);

  useEffect(() => {
    if (activeTab === 'promptfoo') {
      console.log('🔄 Fetching data for promptfoo tab...');
      async function fetchPrVelocity() {
        try {
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.log('📈 Fetching PR velocity...');
          }
          const res = await fetch(`${API_BASE_URL}/api/pr-velocity`);
          const data = await res.json();
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.log('📈 PR velocity raw response:', data);
          }
          if (Array.isArray(data)) {
            // Remove duplicates by keeping the latest entry for each date
            const byDate = {};
            data.forEach(d => {
              byDate[d.date] = d; // Keep the latest entry for each date
            });
            const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
            // Add a dummy data point for the next day to ensure the last point is visible
            let chartData = [...sorted.map(d => ({
              ...d,
              date: d.date,
              ratio: d.ratio !== undefined ? Number(d.ratio) : 0
            }))];
            if (chartData.length > 0) {
              const lastDate = new Date(chartData[chartData.length - 1].date + 'T00:00:00Z');
              const nextDate = new Date(lastDate);
              nextDate.setDate(lastDate.getDate() + 1);
              const nextDateStr = nextDate.toISOString().slice(0, 10);
              chartData.push({ date: nextDateStr, ratio: null }); // Only date and ratio: null
            }

            if (!window.location.hostname.includes('d14l4o1um83q49')) {
              console.log('📈 Processed PR velocity data:', chartData);
            }
            setPrVelocity(chartData);
          } else {
            if (!window.location.hostname.includes('d14l4o1um83q49')) {
              console.error('📈 No PR velocity data array, received:', data);
            }
            setPrVelocity([]);
          }
        } catch (error) {
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.error('📈 PR velocity fetch error:', error);
          }
          setPrVelocity([]);
        }
      }

      async function fetchIssueHealth() {
        try {
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.log('🐛 Fetching issue health...');
          }
          const res = await fetch(`${API_BASE_URL}/api/issue-health`);
          const data = await res.json();
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.log('🐛 Issue health raw response:', data);
          }
          if (Array.isArray(data)) {
            // Remove duplicates by keeping the latest entry for each date
            const byDate = {};
            data.forEach(d => {
              byDate[d.date] = d; // Keep the latest entry for each date
            });
            const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
            // Add a dummy data point for the next day to ensure the last point is visible
            let chartData = [...sorted.map(d => ({
              ...d,
              date: d.date,
              ratio: d.ratio !== undefined ? Number(d.ratio) : 0
            }))];
            if (chartData.length > 0) {
              const lastDate = new Date(chartData[chartData.length - 1].date + 'T00:00:00Z');
              const nextDate = new Date(lastDate);
              nextDate.setDate(lastDate.getDate() + 1);
              const nextDateStr = nextDate.toISOString().slice(0, 10);
              chartData.push({ date: nextDateStr, ratio: null }); // Only date and ratio: null
            }

            if (!window.location.hostname.includes('d14l4o1um83q49')) {
              console.log('🐛 Processed issue health data:', chartData);
            }
            setIssueHealth(chartData);
          } else {
            if (!window.location.hostname.includes('d14l4o1um83q49')) {
              console.error('🐛 No issue health data array, received:', data);
            }
            setIssueHealth([]);
          }
        } catch (error) {
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.error('🐛 Issue health fetch error:', error);
          }
          setIssueHealth([]);
        }
      }

      async function fetchPackageDownloads() {
        try {
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.log('📦 Fetching package downloads...');
          }
          const res = await fetch(`${API_BASE_URL}/api/package-downloads`);
          const data = await res.json();
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.log('📦 Package downloads raw response:', data);
          }
          if (Array.isArray(data)) {
            // Remove duplicates by keeping the latest entry for each week
            const byWeek = {};
            data.forEach(d => {
              byWeek[d.week_start] = d; // Keep the latest entry for each week
            });
            const sorted = Object.values(byWeek).sort((a, b) => a.week_start.localeCompare(b.week_start));
            // Add a dummy data point for the next week to ensure the last point is visible
            let chartData = [...sorted.map(d => ({
              ...d,
              week_start: d.week_start,
              downloads: d.downloads !== undefined ? Number(d.downloads) : 0
            }))];
            if (chartData.length > 0) {
              const lastWeek = new Date(chartData[chartData.length - 1].week_start + 'T00:00:00Z');
              const nextWeek = new Date(lastWeek);
              nextWeek.setDate(lastWeek.getDate() + 7);
              const nextWeekStr = nextWeek.toISOString().slice(0, 10);
              chartData.push({ week_start: nextWeekStr, downloads: null }); // Only week_start and downloads: null
            }

            if (!window.location.hostname.includes('d14l4o1um83q49')) {
              console.log('📦 Processed package downloads data:', chartData);
            }
            setPackageDownloads(chartData);
          } else {
            if (!window.location.hostname.includes('d14l4o1um83q49')) {
              console.error('📦 No package downloads data array, received:', data);
            }
            setPackageDownloads([]);
          }
        } catch (error) {
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.error('📦 Package downloads fetch error:', error);
          }
          setPackageDownloads([]);
        }
      }

      fetchPrVelocity();
      fetchIssueHealth();
      fetchPackageDownloads();
    }
  }, [activeTab]);

  return (
    <div className="App">
      {/* Header with GitHub Octocat */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 0',
        borderBottom: '1px solid #e5e7eb',
        marginBottom: '24px',
        position: 'relative'
      }}>
        {/* Invisible spacer to balance the GitHub icon */}
        <div style={{ width: '24px', visibility: 'hidden' }}></div>
        
        {/* Centered title */}
        <h1 style={{ 
          margin: 0, 
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center'
        }}>
          Open Source Growth Tracker
        </h1>
        
        {/* GitHub icon on the right */}
        <a 
          href="https://github.com/Mihirgupta25/open-source-tracker" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            color: '#000',
            textDecoration: 'none',
            fontSize: '24px',
            transition: 'opacity 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.opacity = '0.7';
          }}
          onMouseLeave={(e) => {
            e.target.style.opacity = '1';
          }}
        >
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 16 16" 
            fill="currentColor"
            style={{ display: 'block' }}
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </a>
      </div>
      {/* Environment Indicator */}
      {window.location.hostname.includes('dci8qqj8zzoob') && (
        <div style={{
          backgroundColor: '#fbbf24',
          color: '#92400e',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: 'bold',
          display: 'inline-block',
          marginBottom: '20px',
          border: '2px solid #f59e0b',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          🚧 DEV ENVIRONMENT 🚧
        </div>
      )}

      <div className="tabs">
        <button
          className={activeTab === 'promptfoo' ? 'tab-active' : 'tab'}
          onClick={() => setActiveTab('promptfoo')}
          style={{ marginRight: 12 }}
        >
          Promptfoo
        </button>
        <button
          className={activeTab === 'realtime' ? 'tab-active' : 'tab'}
          onClick={() => setActiveTab('realtime')}
        >
          Real Time Statistics
        </button>
      </div>
      {activeTab === 'promptfoo' && (
        <>
          {starHistory.length > 0 && (
            <div className="card">
              <h2>Star Growth</h2>
              <p style={{ fontSize: '1rem', color: '#3b3b5c', marginBottom: 12, textAlign: 'left' }}>
                This chart visualizes the growth in GitHub stars for the selected repository over time.
              </p>
              <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 12, textAlign: 'left', fontStyle: 'italic' }}>
                Data is collected from the GitHub API every 3 hours.
              </p>
              {!window.location.hostname.includes('d14l4o1um83q49') && (
                <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 8 }}>
                  Debug: {starHistory.length} data points loaded
                </div>
              )}
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={starHistory} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp"
                    tickFormatter={timestamp => {
                      try {
                        let d;
                        if (timestamp.includes('T') && timestamp.includes('Z')) {
                          // Already in ISO format: "2025-07-27T01:00:11.206Z"
                          d = new Date(timestamp);
                        } else {
                          // Old format: "2025-07-25 07:20:00"
                          d = new Date(timestamp.replace(' ', 'T') + 'Z');
                        }
                        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
                      } catch (e) {
                        return timestamp;
                      }
                    }}
                    label={{
                      value: 'Time',
                      position: 'insideBottom',
                      dy: 20,
                      style: { textAnchor: 'middle', fontSize: '1rem', fill: '#6366f1', fontWeight: 600 }
                    }}
                  />
                  <YAxis domain={['auto', 'auto']} 
                    label={{
                      value: 'Stars',
                      position: 'insideLeft',
                      dy: -20,
                      dx: -15,
                      style: { textAnchor: 'middle', fontSize: '1rem', fill: '#6366f1', fontWeight: 600 }
                    }}
                  />
                  {/* Add ReferenceLine for each day change */}
                  {starHistory.length > 1 && starHistory.map((point, idx, arr) => {
                    if (idx === 0) return null;
                    const prevTimestamp = arr[idx - 1].timestamp;
                    const currTimestamp = point.timestamp;
                    
                    let prevDate, currDate;
                    if (prevTimestamp.includes('T') && prevTimestamp.includes('Z')) {
                      prevDate = new Date(prevTimestamp).toDateString();
                    } else {
                      prevDate = new Date(prevTimestamp.replace(' ', 'T') + 'Z').toDateString();
                    }
                    
                    if (currTimestamp.includes('T') && currTimestamp.includes('Z')) {
                      currDate = new Date(currTimestamp).toDateString();
                    } else {
                      currDate = new Date(currTimestamp.replace(' ', 'T') + 'Z').toDateString();
                    }
                    
                    if (prevDate !== currDate) {
                      return (
                        <ReferenceLine key={point.timestamp} x={point.timestamp} stroke="#f59e42" strokeDasharray="4 2" label={{ value: currDate, position: 'top', fill: '#f59e42', fontSize: 12, fontWeight: 600 }} />
                      );
                    }
                    return null;
                  })}
                  <Tooltip 
                    labelFormatter={timestamp => {
                      try {
                        let d;
                        if (timestamp.includes('T') && timestamp.includes('Z')) {
                          // Already in ISO format: "2025-07-27T01:00:11.206Z"
                          d = new Date(timestamp);
                        } else {
                          // Old format: "2025-07-25 07:20:00"
                          d = new Date(timestamp.replace(' ', 'T') + 'Z');
                        }
                        return d.toLocaleString(undefined, { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric',
                          hour: '2-digit', 
                          minute: '2-digit', 
                          hour12: true 
                        });
                      } catch (e) {
                        return timestamp;
                      }
                    }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#8884d8" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Pull Request Velocity Section */}
          <div className="card">
            <h2>Pull Request Velocity</h2>
            <p style={{ fontSize: '1rem', color: '#3b3b5c', marginBottom: 12, textAlign: 'left' }}>
              This chart visualizes the ratio of merged to open pull requests for the selected repository over time.
            </p>
            <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 12, textAlign: 'left', fontStyle: 'italic' }}>
              Data is collected from the GitHub API and updates daily at 11:50 PM PST.
            </p>

            {prVelocity.length > 0 ? (
              <div>
                {!window.location.hostname.includes('d14l4o1um83q49') && (
                  <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 8 }}>
                    Debug: {prVelocity.length} data points loaded
                  </div>
                )}
                <ResponsiveContainer width="100%" height={220}>
                <LineChart data={prVelocity} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" 
                    tickFormatter={date => {
                      try {
                        const d = new Date(date + 'T12:00:00Z');
                        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                      } catch (e) {
                        return date;
                      }
                    }}
                    label={{
                      value: 'Date',
                      position: 'insideBottom',
                      dy: 20,
                      style: { textAnchor: 'middle', fontSize: '1rem', fill: '#6366f1', fontWeight: 600 }
                    }}
                  />
                  <YAxis 
                    label={{
                      value: 'Ratio',
                      position: 'insideLeft',
                      dy: -20,
                      dx: -15,
                      style: { textAnchor: 'middle', fontSize: '1rem', fill: '#6366f1', fontWeight: 600 }
                    }}
                  />
                  <Tooltip 
                    labelFormatter={date => {
                      try {
                        const d = new Date(date + 'T12:00:00Z');
                        return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
                      } catch (e) {
                        return date;
                      }
                    }}
                  />
                  <Line type="monotone" dataKey="ratio" stroke="#f59e42" strokeWidth={3} dot={{ r: 6, fill: "#f59e42" }} />
                </LineChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <p style={{ color: '#888', marginTop: 24 }}>No pull request velocity data available.</p>
            )}
          </div>
          {/* Issue Health Section */}
          <div className="card">
            <h2>Issue Health</h2>
            <p style={{ fontSize: '1rem', color: '#3b3b5c', marginBottom: 12, textAlign: 'left' }}>
              This chart visualizes the ratio of closed to open issues for the selected repository over time.
            </p>
            <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 12, textAlign: 'left', fontStyle: 'italic' }}>
              Data is collected from the GitHub API and updates daily at 11:50 PM PST.
            </p>

            {issueHealth.length > 0 ? (
              <div>
                {!window.location.hostname.includes('d14l4o1um83q49') && (
                  <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 8 }}>
                    Debug: {issueHealth.length} data points loaded
                  </div>
                )}
                <ResponsiveContainer width="100%" height={220}>
                <LineChart data={issueHealth} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" 
                    tickFormatter={date => {
                      try {
                        const d = new Date(date + 'T12:00:00Z');
                        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                      } catch (e) {
                        return date;
                      }
                    }}
                    label={{
                      value: 'Date',
                      position: 'insideBottom',
                      dy: 20,
                      style: { textAnchor: 'middle', fontSize: '1rem', fill: '#6366f1', fontWeight: 600 }
                    }}
                  />
                  <YAxis 
                    label={{
                      value: 'Ratio',
                      position: 'insideLeft',
                      dy: -20,
                      dx: -15,
                      style: { textAnchor: 'middle', fontSize: '1rem', fill: '#6366f1', fontWeight: 600 }
                    }}
                  />
                  <Tooltip 
                    labelFormatter={date => {
                      try {
                        const d = new Date(date + 'T12:00:00Z');
                        return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
                      } catch (e) {
                        return date;
                      }
                    }}
                  />
                  <Line type="monotone" dataKey="ratio" stroke="#10b981" strokeWidth={3} dot={{ r: 6, fill: "#10b981" }} />
                </LineChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <p style={{ color: '#888', marginTop: 24 }}>No issue health data available.</p>
            )}
          </div>
          {/* Package Downloads Section */}
          <div className="card">
            <h2>Package Downloads</h2>
            <p style={{ fontSize: '1rem', color: '#3b3b5c', marginBottom: 12, textAlign: 'left' }}>
              This chart visualizes the weekly package download counts for the selected repository over time.
            </p>
            <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 12, textAlign: 'left', fontStyle: 'italic' }}>
              Data is collected weekly from the npm Registry API.
            </p>

            {packageDownloads.length > 0 ? (
              <div>
                {!window.location.hostname.includes('d14l4o1um83q49') && (
                  <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 8 }}>
                    Debug: {packageDownloads.length} data points loaded
                  </div>
                )}
                <ResponsiveContainer width="100%" height={220}>
                <LineChart data={packageDownloads} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week_start" 
                    tickFormatter={date => {
                      try {
                        const d = new Date(date + 'T12:00:00Z');
                        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                      } catch (e) {
                        return date;
                      }
                    }}
                    label={{
                      value: 'Week',
                      position: 'insideBottom',
                      dy: 20,
                      style: { textAnchor: 'middle', fontSize: '1rem', fill: '#6366f1', fontWeight: 600 }
                    }}
                  />
                  <YAxis 
                    label={{
                      value: 'Downloads',
                      position: 'insideLeft',
                      dy: -20,
                      dx: -15,
                      style: { textAnchor: 'middle', fontSize: '1rem', fill: '#6366f1', fontWeight: 600 }
                    }}
                  />
                  <Tooltip 
                    labelFormatter={date => {
                      try {
                        const d = new Date(date + 'T12:00:00Z');
                        return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
                      } catch (e) {
                        return date;
                      }
                    }}
                  />
                  <Line type="monotone" dataKey="downloads" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 6, fill: "#8b5cf6" }} />
                </LineChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <p style={{ color: '#888', marginTop: 24 }}>No package download data available.</p>
            )}
          </div>
        </>
      )}
      {activeTab === 'realtime' && (
        <div className="card">
          <h2>Real Time Statistics</h2>
                      <p style={{ fontSize: '1rem', color: '#3b3b5c', marginBottom: 16, textAlign: 'left' }}>
            Retrieve real-time statistics for any GitHub repository. Simply enter the repository URL below to instantly view the latest star count and other key metrics.
          </p>
          <h3 style={{ color: '#6366f1', fontWeight: 700, marginBottom: 16 }}>Star Count</h3>
          <form onSubmit={fetchStars} style={{ marginBottom: 20 }}>
            <input
              type="text"
              value={repo}
              onChange={e => setRepo(e.target.value)}
              placeholder="owner/repo or full URL (e.g. facebook/react or https://github.com/facebook/react)"
              style={{ width: 400, padding: 8 }}
            />
            <button type="submit" style={{ marginLeft: 10, padding: 8 }}>Fetch Stars</button>
          </form>
          {loading && <p>Loading...</p>}
          {error && <p style={{ color: 'red' }}>{error}</p>}
          {starData && (
            <div>
              <h2>Star Count: {starData.count}</h2>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
