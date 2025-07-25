import React, { useState, useEffect } from 'react';
import './App.css';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';

function App() {
  const [repo, setRepo] = useState('');
  const [starData, setStarData] = useState(null);
  const [starHistory, setStarHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('promptfoo');
  const [prVelocity, setPrVelocity] = useState([]);

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
      const res = await fetch(`http://localhost:4000/api/stars?repo=${repoParam}`);
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
        const res = await fetch('http://localhost:4000/api/star-history');
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
      async function fetchPrVelocity() {
        try {
          const res = await fetch('http://localhost:4000/api/pr-velocity');
          const data = await res.json();
          if (Array.isArray(data)) {
            setPrVelocity(data.map(d => ({
              ...d,
              date: new Date(d.date + 'T00:00:00Z').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
              ratio: d.ratio !== undefined ? Number(d.ratio) : (d.average_duration_hours !== undefined ? Number(d.average_duration_hours) : 0)
            })));
          } else {
            setPrVelocity([]);
          }
        } catch {
          setPrVelocity([]);
        }
      }
      fetchPrVelocity();
    }
  }, [activeTab]);

  return (
    <div className="App">
      <h1>Open Source Growth Tracker</h1>
      <div className="tabs" style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
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
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={starHistory} margin={{ top: 20, right: 30, left: 40, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp"
                    label={{
                      value: 'Time',
                      position: 'insideBottom',
                      dy: 20,
                      style: { textAnchor: 'middle', fontSize: '1rem', fill: '#6366f1', fontWeight: 600 }
                    }}
                  />
                  <YAxis domain={['auto', 'auto']} />
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
            {prVelocity.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={prVelocity} margin={{ top: 20, right: 30, left: 80, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date"
                    label={{
                      value: 'Date',
                      position: 'insideBottom',
                      dy: 20,
                      style: { textAnchor: 'middle', fontSize: '1rem', fill: '#6366f1', fontWeight: 600 }
                    }}
                  />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="ratio" stroke="#f59e42" dot={true} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: '#888', marginTop: 24 }}>No pull request velocity data available.</p>
            )}
          </div>
        </>
      )}
      {activeTab === 'realtime' && (
        <div className="card">
          <h2>Real Time Statistics</h2>
          <p style={{ fontSize: '1.1rem', color: '#3b3b5c', marginBottom: 24, textAlign: 'left' }}>
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
