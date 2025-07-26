require('dotenv').config();
const axios = require('axios');
const Database = require('better-sqlite3');
const path = require('path');

const REPO = 'promptfoo/promptfoo';

// Connect to the issue health database
const dbPath = path.join(__dirname, '..', 'databases', 'issue_health.db');
const db = new Database(dbPath);

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
    console.log(`✅ Inserted issue ratio for ${date}: ${ratio.toFixed(4)}`);
  } catch (error) {
    console.error(`❌ Error inserting issue ratio for ${date}:`, error.message);
  }
}

async function runTest() {
  const today = new Date().toISOString().slice(0, 10);
  
  console.log('🧪 Testing issue health collection for today...');
  console.log(`📅 Date: ${today}`);
  console.log(`🎯 Repository: ${REPO}`);
  
  try {
    const { closedCount, openCount, ratio } = await calculateIssueRatio(today);
    await insertIssueRatio(today, closedCount, openCount, ratio);
    
    // Show all data in database
    const allData = db.prepare(`
      SELECT date, closed_count, open_count, ratio
      FROM issue_ratios
      WHERE repo = ?
      ORDER BY date DESC
    `).all(REPO);
    
    console.log('\n📊 All issue health data in database:');
    allData.forEach(data => {
      console.log(`   ${data.date}: ${data.closed_count} closed, ${data.open_count} open, ratio: ${data.ratio.toFixed(2)}`);
    });
    
  } catch (error) {
    console.error('❌ Error in test:', error.message);
  } finally {
    db.close();
  }
}

// Run the test
runTest().then(() => {
  console.log('🎉 Issue health test complete!');
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
}); 