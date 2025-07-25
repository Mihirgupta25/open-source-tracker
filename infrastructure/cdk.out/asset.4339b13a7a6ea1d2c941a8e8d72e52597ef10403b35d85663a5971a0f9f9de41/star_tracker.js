const Database = require('better-sqlite3');
const axios = require('axios');
require('dotenv').config();
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'promptfoo/promptfoo';
const INTERVAL_MINUTES = 60; // Collect data every hour

// Setup SQLite DB
const dbPath = path.join(__dirname, 'databases', 'star_growth.db');
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

// Helper to get delay until next 2:00 AM PST
function getDelayUntilNext2AMPST() {
  const now = new Date();
  // PST is UTC-8 (no DST handling for simplicity)
  const nowUTC = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
  let next2AM = new Date(nowUTC);
  next2AM.setUTCHours(10, 0, 0, 0); // 2:00 AM PST = 10:00 UTC
  if (nowUTC >= next2AM) {
    next2AM.setUTCDate(next2AM.getUTCDate() + 1);
  }
  return next2AM - nowUTC;
}

function startPSTAlignedInterval(fn, intervalMinutes) {
  const delay = getDelayUntilNext2AMPST();
  setTimeout(() => {
    fn();
    setInterval(fn, intervalMinutes * 60 * 1000);
  }, delay);
}

startPSTAlignedInterval(trackStars, INTERVAL_MINUTES); 