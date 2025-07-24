import React, { useState } from 'react';
import './App.css';

function App() {
  const [repo, setRepo] = useState('');
  const [starData, setStarData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Helper to extract owner/repo from full URL or return as-is
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
    </div>
  );
}

export default App;
