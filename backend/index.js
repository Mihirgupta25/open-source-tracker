require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Set this in your .env file

const dbPath = path.join(__dirname, 'databases', 'star_growth.db');
const starDb = new Database(dbPath);

const prVelocityDbPath = path.join(__dirname, 'databases', 'pr_velocity.db');
const prVelocityDb = new Database(prVelocityDbPath);

const issueHealthDbPath = path.join(__dirname, 'databases', 'issue_health.db');
const issueHealthDb = new Database(issueHealthDbPath);

const packageDownloadsDbPath = path.join(__dirname, 'databases', 'package_downloads.db');
const packageDownloadsDb = new Database(packageDownloadsDbPath);

app.use(cors());

app.get('/api/stars', async (req, res) => {
  const { repo } = req.query; // e.g., facebook/react
  if (!repo) return res.status(400).json({ error: 'Missing repo parameter' });

  try {
    const headers = GITHUB_TOKEN
      ? { Authorization: `token ${GITHUB_TOKEN}` }
      : {};
    const response = await axios.get(`https://api.github.com/repos/${repo}`, { headers });
    const starCount = response.data.stargazers_count;
    res.json({ count: starCount });
  } catch (err) {
    if (err.response) {
      console.error('GitHub API error:', err.response.status, err.response.data);
    } else {
      console.error('GitHub API error:', err.message);
    }
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/star-history', (req, res) => {
  try {
    const rows = starDb.prepare('SELECT timestamp, count FROM stars WHERE repo = ? ORDER BY timestamp ASC').all('promptfoo/promptfoo');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pr-velocity', (req, res) => {
  try {
    const rows = prVelocityDb.prepare(`
      SELECT rowid as rowid, date, ratio
      FROM pr_ratios
      WHERE repo = ?
      ORDER BY date ASC
    `).all('promptfoo/promptfoo');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/issue-health', (req, res) => {
  try {
    const rows = issueHealthDb.prepare(`
      SELECT rowid as rowid, date, ratio
      FROM issue_ratios
      WHERE repo = ?
      ORDER BY date ASC
    `).all('promptfoo/promptfoo');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/package-downloads', (req, res) => {
  try {
    const rows = packageDownloadsDb.prepare(`
      SELECT rowid as rowid, week_start, downloads
      FROM package_downloads
      WHERE repo = ?
      ORDER BY week_start ASC
    `).all('promptfoo/promptfoo');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
}); 