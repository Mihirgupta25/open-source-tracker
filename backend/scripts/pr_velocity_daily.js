require('dotenv').config();
const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'promptfoo/promptfoo';
const INTERVAL_HOURS = 24; // Run once every 24 hours

const dbPath = path.join(__dirname, 'databases', 'pr_velocity.db');
const db = new Database(dbPath);

// Ensure the table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS pr_ratios (
    repo TEXT,
    date TEXT,
    merged_count INTEGER,
    open_count INTEGER,
    ratio REAL,
    UNIQUE(repo, date)
  )
`);

async function fetchPRCount(query) {
  try {
    const headers = GITHUB_TOKEN
      ? { Authorization: `token ${GITHUB_TOKEN}` }
      : {};
    
    const response = await axios.get(`https://api.github.com/search/issues?q=${query}`, { headers });
    return response.data.total_count;
  } catch (error) {
    console.error(`Error fetching PR count for query "${query}":`, error.message);
    return 0;
  }
}

async function calculatePRRatio(date) {
  console.log(`Calculating PR ratio for ${date}...`);
  
  // Get merged PRs (merged on or before the date)
  const mergedQuery = `repo:${REPO} is:pr is:merged merged:<=${date}`;
  const mergedCount = await fetchPRCount(mergedQuery);
  
  // Get open PRs (created on or before the date, not closed before the date)
  const openQuery = `repo:${REPO} is:pr is:open created:<=${date}`;
  const openCount = await fetchPRCount(openQuery);
  
  // Calculate ratio
  const ratio = openCount > 0 ? mergedCount / openCount : 0;
  
  console.log(`${date}: Merged=${mergedCount}, Open=${openCount}, Ratio=${ratio.toFixed(4)}`);
  
  return { mergedCount, openCount, ratio };
}

async function insertPRRatio(date, mergedCount, openCount, ratio) {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO pr_ratios (repo, date, merged_count, open_count, ratio)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(REPO, date, mergedCount, openCount, ratio);
    console.log(`Inserted PR ratio for ${date}: ${ratio.toFixed(4)}`);
  } catch (error) {
    console.error(`Error inserting PR ratio for ${date}:`, error.message);
  }
}

function getDateString(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD format
}

function getNextRunTime() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(12, 0, 0, 0); // 12:00 PM PST
  
  // Convert to PST (UTC-8)
  const pstOffset = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
  tomorrow.setTime(tomorrow.getTime() + pstOffset);
  
  return tomorrow;
}

async function runDailyCollection() {
  const today = new Date();
  const dateString = getDateString(today);
  
  console.log(`[${new Date().toISOString()}] Starting daily PR velocity collection for ${dateString}`);
  
  try {
    const { mergedCount, openCount, ratio } = await calculatePRRatio(dateString);
    await insertPRRatio(dateString, mergedCount, openCount, ratio);
    console.log(`[${new Date().toISOString()}] Daily collection completed for ${dateString}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in daily collection:`, error.message);
  }
}

function startDailyCollection() {
  const nextRun = getNextRunTime();
  const now = new Date();
  const delay = nextRun.getTime() - now.getTime();
  
  console.log(`[${now.toISOString()}] PR velocity daily collector starting...`);
  console.log(`[${now.toISOString()}] Next run scheduled for: ${nextRun.toISOString()} (in ${Math.round(delay / 1000 / 60)} minutes)`);
  
  // Schedule the first run
  setTimeout(async () => {
    await runDailyCollection();
    
    // Then schedule subsequent runs every 24 hours
    setInterval(runDailyCollection, INTERVAL_HOURS * 60 * 60 * 1000);
  }, delay);
}

// Start the daily collection
startDailyCollection();

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n[PR Velocity Daily Collector] Shutting down...');
  db.close();
  process.exit(0);
}); 