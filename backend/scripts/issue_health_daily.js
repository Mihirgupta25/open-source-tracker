require('dotenv').config();
const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');

const REPO = 'promptfoo/promptfoo';
const INTERVAL_HOURS = 24; // Run every 24 hours

// Connect to the issue health database
const dbPath = path.join(__dirname, '..', 'databases', 'issue_health.db');
const db = new Database(dbPath);

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS issue_ratios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    date TEXT NOT NULL,
    closed_count INTEGER NOT NULL,
    open_count INTEGER NOT NULL,
    ratio REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(repo, date)
  )
`);

// GitHub API configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const headers = GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {};

async function fetchIssueCount(query) {
  try {
    console.log(`Fetching issue count for query: ${query}`);
    const response = await axios.get(`https://api.github.com/search/issues?q=${query}`, { headers });
    return response.data.total_count;
  } catch (error) {
    console.error(`Error fetching issue count for query "${query}":`, error.message);
    return 0;
  }
}

async function calculateIssueRatio(date) {
  console.log(`Calculating issue ratio for ${date}...`);
  
  // Get closed issues (closed on or before the date)
  const closedQuery = `repo:${REPO} is:issue is:closed closed:<=${date}`;
  const closedCount = await fetchIssueCount(closedQuery);
  
  // Get open issues (created on or before the date, not closed before the date)
  const openQuery = `repo:${REPO} is:issue is:open created:<=${date}`;
  const openCount = await fetchIssueCount(openQuery);
  
  // Calculate ratio
  const ratio = openCount > 0 ? closedCount / openCount : 0;
  
  console.log(`${date}: Closed=${closedCount}, Open=${openCount}, Ratio=${ratio.toFixed(4)}`);
  
  return { closedCount, openCount, ratio };
}

async function insertIssueRatio(date, closedCount, openCount, ratio) {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO issue_ratios (repo, date, closed_count, open_count, ratio)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(REPO, date, closedCount, openCount, ratio);
    console.log(`Inserted issue ratio for ${date}: ${ratio.toFixed(4)}`);
  } catch (error) {
    console.error(`Error inserting issue ratio for ${date}:`, error.message);
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
  
  console.log(`[${new Date().toISOString()}] Starting daily issue health collection for ${dateString}`);
  
  try {
    const { closedCount, openCount, ratio } = await calculateIssueRatio(dateString);
    await insertIssueRatio(dateString, closedCount, openCount, ratio);
    console.log(`[${new Date().toISOString()}] Daily issue health collection completed for ${dateString}`);
    
    // Show recent data
    const recentData = db.prepare(`
      SELECT date, closed_count, open_count, ratio
      FROM issue_ratios
      WHERE repo = ?
      ORDER BY date DESC
      LIMIT 5
    `).all(REPO);
    
    console.log('\n📊 Recent issue health data:');
    recentData.forEach(data => {
      console.log(`   ${data.date}: ${data.closed_count} closed, ${data.open_count} open, ratio: ${data.ratio.toFixed(2)}`);
    });
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in daily issue health collection:`, error.message);
  }
}

function startDailyCollection() {
  const nextRun = getNextRunTime();
  const now = new Date();
  const delay = nextRun.getTime() - now.getTime();
  
  console.log(`[${now.toISOString()}] Issue health daily collector starting...`);
  console.log(`[${now.toISOString()}] Next run scheduled for: ${nextRun.toISOString()} (in ${Math.round(delay / 1000 / 60)} minutes)`);
  console.log(`[${now.toISOString()}] Repository: ${REPO}`);
  console.log(`[${now.toISOString()}] Database: ${dbPath}`);
  
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
  console.log('\n[Issue Health Daily Collector] Shutting down...');
  db.close();
  process.exit(0);
}); 