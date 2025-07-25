import React, { useState, useEffect } from 'react';
import './App.css';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

function App() {
  const [repo, setRepo] = useState('');
  const [starData, setStarData] = useState(null);
  const [starHistory, setStarHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  return (
    <div className="App">
      <h1>Open Source Growth Tracker</h1>
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
      {starHistory.length > 0 && (
        <div className="card">
          <h2>Star Growth of Promptfoo</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={starHistory} margin={{ top: 20, right: 30, left: 40, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" minTickGap={40}
                label={{
                  value: 'Time',
                  position: 'insideBottom',
                  dy: 20,
                  style: { textAnchor: 'middle', fontSize: '1rem', fill: '#6366f1', fontWeight: 600 }
                }}
                tick={false}
              />
              {/* YAxis will now auto-expand to fit all data */}
              <YAxis domain={['auto', 'auto']}
                label={{
                  value: 'Star Count',
                  angle: 0,
                  position: 'insideLeft',
                  dy: -30,
                  style: { textAnchor: 'middle', fontSize: '1rem', fill: '#6366f1', fontWeight: 600 }
                }}
              />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#8884d8" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default App;
