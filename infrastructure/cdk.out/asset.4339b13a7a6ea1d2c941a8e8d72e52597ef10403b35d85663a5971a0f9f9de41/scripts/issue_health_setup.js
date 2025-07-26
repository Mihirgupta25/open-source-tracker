require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'databases', 'pr_velocity.db');
const db = new Database(dbPath);

// Create the issue_ratios table
db.exec(`
  CREATE TABLE IF NOT EXISTS issue_ratios (
    repo TEXT,
    date TEXT,
    closed_count INTEGER,
    open_count INTEGER,
    ratio REAL,
    UNIQUE(repo, date)
  )
`);

// Add some sample data for the last few days
const sampleData = [
  { date: '2025-07-22', closed: 45, open: 23, ratio: 1.9565 },
  { date: '2025-07-23', closed: 52, open: 28, ratio: 1.8571 },
  { date: '2025-07-24', closed: 48, open: 25, ratio: 1.9200 },
  { date: '2025-07-25', closed: 55, open: 30, ratio: 1.8333 }
];

const stmt = db.prepare(`
  INSERT OR REPLACE INTO issue_ratios (repo, date, closed_count, open_count, ratio)
  VALUES (?, ?, ?, ?, ?)
`);

sampleData.forEach(data => {
  stmt.run('promptfoo/promptfoo', data.date, data.closed, data.open, data.ratio);
  console.log(`Inserted issue ratio for ${data.date}: ${data.ratio.toFixed(4)}`);
});

console.log('Issue health setup completed!');
db.close(); 