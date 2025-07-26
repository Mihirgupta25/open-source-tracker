const Database = require('better-sqlite3');
const path = require('path');

// Database paths
const dbPaths = {
  starGrowth: path.join(__dirname, 'backend/databases/star_growth.db'),
  prVelocity: path.join(__dirname, 'backend/databases/pr_velocity.db'),
  issueHealth: path.join(__dirname, 'backend/databases/issue_health.db'),
  packageDownloads: path.join(__dirname, 'backend/databases/package_downloads.db')
};

function checkSQLiteData() {
  console.log('🔍 Checking local SQLite databases...\n');
  
  try {
    // Check star growth
    console.log('📊 Star Growth Data (SQLite):');
    const starDb = new Database(dbPaths.starGrowth);
    const starData = starDb.prepare('SELECT * FROM star_growth ORDER BY timestamp').all();
    console.log(`Found ${starData.length} records`);
    if (starData.length > 0) {
      console.log('Sample data:', JSON.stringify(starData[0], null, 2));
    }
    starDb.close();
    
    // Check PR velocity
    console.log('\n📈 PR Velocity Data (SQLite):');
    const prDb = new Database(dbPaths.prVelocity);
    const prData = prDb.prepare('SELECT * FROM pr_velocity ORDER BY date').all();
    console.log(`Found ${prData.length} records`);
    if (prData.length > 0) {
      console.log('Sample data:', JSON.stringify(prData[0], null, 2));
    }
    prDb.close();
    
    // Check issue health
    console.log('\n🐛 Issue Health Data (SQLite):');
    const issueDb = new Database(dbPaths.issueHealth);
    const issueData = issueDb.prepare('SELECT * FROM issue_health ORDER BY date').all();
    console.log(`Found ${issueData.length} records`);
    if (issueData.length > 0) {
      console.log('Sample data:', JSON.stringify(issueData[0], null, 2));
    }
    issueDb.close();
    
    // Check package downloads
    console.log('\n📦 Package Downloads Data (SQLite):');
    const packageDb = new Database(dbPaths.packageDownloads);
    const packageData = packageDb.prepare('SELECT * FROM package_downloads ORDER BY week_start').all();
    console.log(`Found ${packageData.length} records`);
    if (packageData.length > 0) {
      console.log('Sample data:', JSON.stringify(packageData[0], null, 2));
    }
    packageDb.close();
    
  } catch (error) {
    console.error('❌ Error checking SQLite data:', error.message);
  }
}

checkSQLiteData(); 