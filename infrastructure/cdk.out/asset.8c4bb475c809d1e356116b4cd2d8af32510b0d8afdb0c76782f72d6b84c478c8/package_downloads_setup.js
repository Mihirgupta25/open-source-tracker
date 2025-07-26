const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Create databases directory if it doesn't exist
const databasesDir = path.join(__dirname, '..', 'databases');
if (!fs.existsSync(databasesDir)) {
  fs.mkdirSync(databasesDir, { recursive: true });
  console.log('✅ Created databases directory');
}

// Create database connection
const dbPath = path.join(__dirname, '..', 'databases', 'package_downloads.db');
const db = new Database(dbPath);

console.log('📦 Setting up package downloads tracking...');

// Create package_downloads table
const createTable = `
CREATE TABLE IF NOT EXISTS package_downloads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    week_start TEXT NOT NULL,
    downloads INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(repo, week_start)
)`;

db.exec(createTable);
console.log('✅ Created package_downloads table');

// Insert sample data for promptfoo/promptfoo
const sampleData = [
    { repo: 'promptfoo/promptfoo', week_start: '2025-07-14', downloads: 15420 },
    { repo: 'promptfoo/promptfoo', week_start: '2025-07-21', downloads: 16850 },
    { repo: 'promptfoo/promptfoo', week_start: '2025-07-28', downloads: 18230 },
    { repo: 'promptfoo/promptfoo', week_start: '2025-08-04', downloads: 19540 },
    { repo: 'promptfoo/promptfoo', week_start: '2025-08-11', downloads: 20890 },
    { repo: 'promptfoo/promptfoo', week_start: '2025-08-18', downloads: 22150 },
    { repo: 'promptfoo/promptfoo', week_start: '2025-08-25', downloads: 23420 }
];

const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO package_downloads (repo, week_start, downloads)
    VALUES (?, ?, ?)
`);

sampleData.forEach(data => {
    insertStmt.run(data.repo, data.week_start, data.downloads);
});

console.log('✅ Inserted sample package download data');
console.log('📊 Sample data points:');
sampleData.forEach(data => {
    console.log(`   Week of ${data.week_start}: ${data.downloads.toLocaleString()} downloads`);
});

db.close();
console.log('🎉 Package downloads setup complete!'); 