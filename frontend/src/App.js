import React, { useState, useEffect } from 'react';
import './App.css';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';

// API base URL - will use environment variable in production
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://l97n7ozrb0.execute-api.us-east-1.amazonaws.com/prod';

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
        const res = await fetch(`${API_BASE_URL}/api/star-history`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setStarHistory(data.map(d => ({
            ...d,
            // Format timestamp as 'Month Day, Year, HH:MM AM/PM' (e.g., 'July 25, 2025, 10:12 PM')
            timestamp: new Date(d.timestamp + 'Z').toLocaleString(undefined, {
              year: 'numeric', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit', hour12: true
            })
          })));
        } else if (data && data.error) {
          setError('Failed to load star history: ' + data.error);
        } else {
          setError('Failed to load star history: Unexpected response');
        }
      } catch (err) {
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
          console.log('📈 Fetching PR velocity...');
          const res = await fetch(`${API_BASE_URL}/api/pr-velocity`);
          const data = await res.json();
          console.log('📈 PR velocity response:', data);
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

            console.log('📈 Setting PR velocity data:', chartData);
            setPrVelocity(chartData);
          } else {
            console.log('📈 No PR velocity data array');
            setPrVelocity([]);
          }
        } catch (error) {
          console.error('📈 PR velocity error:', error);
          setPrVelocity([]);
        }
      }

      async function fetchIssueHealth() {
        try {
          console.log('🐛 Fetching issue health...');
          const res = await fetch(`${API_BASE_URL}/api/issue-health`);
          const data = await res.json();
          console.log('🐛 Issue health response:', data);
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

            console.log('🐛 Setting issue health data:', chartData);
            setIssueHealth(chartData);
          } else {
            console.log('🐛 No issue health data array');
            setIssueHealth([]);
          }
        } catch (error) {
          console.error('🐛 Issue health error:', error);
          setIssueHealth([]);
        }
      }

      async function fetchPackageDownloads() {
        try {
          const res = await fetch(`${API_BASE_URL}/api/package-downloads`);
          const data = await res.json();
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

            setPackageDownloads(chartData);
          } else {
            setPackageDownloads([]);
          }
        } catch {
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
      <h1>Open Source Growth Tracker</h1>
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
                This chart visualizes the growth in GitHub stars for the selected repository over time. Each point represents the total number of stars recorded at a specific time, allowing you to track the project's popularity and community interest. Data is collected from the GitHub API every 3 hours and updates automatically.
              </p>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={starHistory} margin={{ top: 20, right: 30, left: 60, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp"
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
                    const prevDate = new Date(arr[idx - 1].timestamp).toDateString();
                    const currDate = new Date(point.timestamp).toDateString();
                    if (prevDate !== currDate) {
                      return (
                        <ReferenceLine key={point.timestamp} x={point.timestamp} stroke="#f59e42" strokeDasharray="4 2" label={{ value: currDate, position: 'top', fill: '#f59e42', fontSize: 12, fontWeight: 600 }} />
                      );
                    }
                    return null;
                  })}
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#8884d8" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Pull Request Velocity Section */}
          <div className="card">
            <h2>Pull Request Velocity</h2>
            <p style={{ fontSize: '1rem', color: '#3b3b5c', marginBottom: 12, textAlign: 'left' }}>
              This chart visualizes the ratio of merged to open pull requests for the selected repository over time. Each point represents the ratio on a specific day, helping you understand the pace at which pull requests are being merged relative to those remaining open. Data is collected from the GitHub API and updates automatically every day at 11:50 PM PST.
            </p>

            {prVelocity.length > 0 ? (
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
            ) : (
              <p style={{ color: '#888', marginTop: 24 }}>No pull request velocity data available.</p>
            )}
          </div>
          {/* Issue Health Section */}
          <div className="card">
            <h2>Issue Health</h2>
            <p style={{ fontSize: '1rem', color: '#3b3b5c', marginBottom: 12, textAlign: 'left' }}>
              This chart visualizes the ratio of closed to open issues for the selected repository over time. Each point represents the ratio on a specific day, helping you understand how efficiently issues are being resolved relative to those remaining open. Data is collected from the GitHub API and updates automatically every day at 11:50 PM PST.
            </p>

            {issueHealth.length > 0 ? (
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
            ) : (
              <p style={{ color: '#888', marginTop: 24 }}>No issue health data available.</p>
            )}
          </div>
          {/* Package Downloads Section */}
          <div className="card">
            <h2>Package Downloads</h2>
            <p style={{ fontSize: '1rem', color: '#3b3b5c', marginBottom: 12, textAlign: 'left' }}>
              This chart visualizes the weekly package download counts for the selected repository over time. Each point represents the total number of downloads during a specific week, helping you track the project's adoption and usage trends. Data is collected from the npm Registry API and updates automatically every week.
            </p>

            {packageDownloads.length > 0 ? (
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
