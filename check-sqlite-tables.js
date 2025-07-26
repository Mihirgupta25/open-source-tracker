const Database = require('better-sqlite3');
const path = require('path');

// Database paths
const dbPaths = {
  starGrowth: path.join(__dirname, 'backend/databases/star_growth.db'),
  prVelocity: path.join(__dirname, 'backend/databases/pr_velocity.db'),
  issueHealth: path.join(__dirname, 'backend/databases/issue_health.db'),
  packageDownloads: path.join(__dirname, 'backend/databases/package_downloads.db')
};

function checkSQLiteTables() {
  console.log('🔍 Checking SQLite database tables...\n');
  
  try {
    // Check star growth database
    console.log('📊 Star Growth Database:');
    const starDb = new Database(dbPaths.starGrowth);
    const starTables = starDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables:', starTables.map(t => t.name));
    if (starTables.length > 0) {
      const tableName = starTables[0].name;
      const count = starDb.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
      console.log(`Records in ${tableName}: ${count.count}`);
    }
    starDb.close();
    
    // Check PR velocity database
    console.log('\n📈 PR Velocity Database:');
    const prDb = new Database(dbPaths.prVelocity);
    const prTables = prDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables:', prTables.map(t => t.name));
    if (prTables.length > 0) {
      const tableName = prTables[0].name;
      const count = prDb.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
      console.log(`Records in ${tableName}: ${count.count}`);
    }
    prDb.close();
    
    // Check issue health database
    console.log('\n🐛 Issue Health Database:');
    const issueDb = new Database(dbPaths.issueHealth);
    const issueTables = issueDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables:', issueTables.map(t => t.name));
    if (issueTables.length > 0) {
      const tableName = issueTables[0].name;
      const count = issueDb.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
      console.log(`Records in ${tableName}: ${count.count}`);
    }
    issueDb.close();
    
    // Check package downloads database
    console.log('\n📦 Package Downloads Database:');
    const packageDb = new Database(dbPaths.packageDownloads);
    const packageTables = packageDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables:', packageTables.map(t => t.name));
    if (packageTables.length > 0) {
      const tableName = packageTables[0].name;
      const count = packageDb.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
      console.log(`Records in ${tableName}: ${count.count}`);
    }
    packageDb.close();
    
  } catch (error) {
    console.error('❌ Error checking SQLite tables:', error.message);
  }
}

checkSQLiteTables(); 