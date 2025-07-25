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
            // Convert UTC timestamp to local time string (YYYY-MM-DD HH:mm)
            timestamp: new Date(d.timestamp + 'Z').toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
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
      <h1>GitHub Star Growth Tracker</h1>
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
        <div style={{ width: '90%', maxWidth: 800, margin: '40px auto' }}>
          <h2>Star Growth Over Time (promptfoo/promptfoo)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={starHistory} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" minTickGap={40} />
              <YAxis />
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
