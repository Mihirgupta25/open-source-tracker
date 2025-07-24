const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

// Fetch stargazer data for a repo (paginated)
app.get('/api/stars', async (req, res) => {
  const { repo } = req.query; // e.g., facebook/react
  if (!repo) return res.status(400).json({ error: 'Missing repo parameter' });

  try {
    // GitHub API: /repos/{owner}/{repo}/stargazers?per_page=100&page=1
    // Accept header for star timestamps
    let page = 1;
    let stars = [];
    let hasMore = true;
    while (hasMore && page <= 10) { // Limit to 1000 for demo
      const response = await axios.get(`https://api.github.com/repos/${repo}/stargazers`, {
        params: { per_page: 100, page },
        headers: { 'Accept': 'application/vnd.github.v3.star+json' },
      });
      if (response.data.length === 0) break;
      stars = stars.concat(response.data);
      hasMore = response.data.length === 100;
      page++;
    }
    // Map to {starred_at}
    const starHistory = stars.map(s => s.starred_at);
    res.json({ count: starHistory.length, starHistory });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
}); 