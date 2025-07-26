const Database = require('better-sqlite3');
const path = require('path');
const axios = require('axios');

console.log('📦 Weekly package downloads collection started...');

// Connect to database
const dbPath = path.join(__dirname, '..', 'databases', 'package_downloads.db');
const db = new Database(dbPath);

// Function to get week start date (Monday)
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

// Function to fetch current week data from npm
async function fetchCurrentWeekData(packageName) {
  try {
    const url = `https://api.npmjs.org/downloads/point/last-week/${packageName}`;
    console.log(`🔍 Fetching current week data from: ${url}`);
    
    const response = await axios.get(url);
    const data = response.data;
    
    if (data.error) {
      throw new Error(`npm API error: ${data.error}`);
    }
    
    return {
      downloads: data.downloads,
      start: data.start,
      end: data.end,
      package: data.package
    };
  } catch (error) {
    console.error(`❌ Error fetching current week data:`, error.message);
    return null;
  }
}

// Main weekly collection function
async function collectWeeklyData() {
  const packageName = 'promptfoo';
  const repo = 'promptfoo/promptfoo';
  
  console.log(`🎯 Collecting weekly data for: ${packageName}`);
  
  try {
    // Fetch current week data
    const currentWeekData = await fetchCurrentWeekData(packageName);
    
    if (currentWeekData) {
      const weekStart = getWeekStart(currentWeekData.start);
      
      // Check if we already have this week's data
      const existingData = db.prepare(`
        SELECT downloads FROM package_downloads 
        WHERE repo = ? AND week_start = ?
      `).get(repo, weekStart);
      
      if (existingData) {
        console.log(`📊 Week ${weekStart} already exists: ${existingData.downloads.toLocaleString()} downloads`);
        
        // Update if the new data is different
        if (existingData.downloads !== currentWeekData.downloads) {
          db.prepare(`
            UPDATE package_downloads 
            SET downloads = ? 
            WHERE repo = ? AND week_start = ?
          `).run(currentWeekData.downloads, repo, weekStart);
          
          console.log(`✅ Updated week ${weekStart}: ${currentWeekData.downloads.toLocaleString()} downloads`);
        }
      } else {
        // Insert new week data
        db.prepare(`
          INSERT INTO package_downloads (repo, week_start, downloads)
          VALUES (?, ?, ?)
        `).run(repo, weekStart, currentWeekData.downloads);
        
        console.log(`✅ Added new week ${weekStart}: ${currentWeekData.downloads.toLocaleString()} downloads`);
      }
    } else {
      console.log('⚠️  Could not fetch current week data');
    }
    
    // Show recent data
    const recentData = db.prepare(`
      SELECT week_start, downloads 
      FROM package_downloads 
      WHERE repo = ? 
      ORDER BY week_start DESC
      LIMIT 5
    `).all(repo);
    
    console.log('\n📊 Recent weeks:');
    recentData.forEach(data => {
      console.log(`   Week of ${data.week_start}: ${data.downloads.toLocaleString()} downloads`);
    });
    
  } catch (error) {
    console.error('❌ Error in weekly collection:', error.message);
  } finally {
    db.close();
  }
}

// Run the collection
collectWeeklyData().then(() => {
  console.log('🎉 Weekly package downloads collection complete!');
}).catch(error => {
  console.error('💥 Collection failed:', error);
  process.exit(1);
}); 