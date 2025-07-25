const Database = require('better-sqlite3');
const axios = require('axios');
require('dotenv').config();
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'promptfoo/promptfoo';
const INTERVAL_MINUTES = 30;

// Setup SQLite DB
const dbPath = path.join(__dirname, 'star_growth.db');
const db = new Database(dbPath);
db.exec(`CREATE TABLE IF NOT EXISTS stars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repo TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  count INTEGER NOT NULL
)`);

async function fetchStarCount() {
  try {
    const headers = GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {};
    const url = `https://api.github.com/repos/${REPO}`;
    const response = await axios.get(url, { headers });
    return response.data.stargazers_count;
  } catch (err) {
    console.error('Error fetching star count:', err.response ? err.response.data : err.message);
    return null;
  }
}

async function trackStars() {
  const count = await fetchStarCount();
  if (count !== null) {
    db.prepare('INSERT INTO stars (repo, count) VALUES (?, ?)').run(REPO, count);
    console.log(`[${new Date().toISOString()}] Inserted star count: ${count}`);
  }
}

// Run immediately, then every 30 minutes
trackStars();
setInterval(trackStars, INTERVAL_MINUTES * 60 * 1000); 