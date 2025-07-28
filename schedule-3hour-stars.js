const { spawn } = require('child_process');
const path = require('path');

// Configuration
const INTERVAL_HOURS = 3;
const START_HOUR = 6; // 6:00 AM PDT
const COLLECTION_TIMES = [
  6,  // 6:00 AM
  9,  // 9:00 AM
  12, // 12:00 PM
  15, // 3:00 PM
  18, // 6:00 PM
  21  // 9:00 PM
];

// Function to calculate delay until next collection time
function getDelayUntilNextCollection() {
  const now = new Date();
  const pdtTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  
  // Find the next collection time
  let nextCollectionTime = new Date(pdtTime);
  nextCollectionTime.setHours(START_HOUR, 0, 0, 0); // Start with 6:00 AM today
  
  // If it's already past 6:00 AM today, find the next collection time
  if (pdtTime >= nextCollectionTime) {
    // Find the next collection time in the schedule
    for (let hour of COLLECTION_TIMES) {
      nextCollectionTime.setHours(hour, 0, 0, 0);
      if (pdtTime < nextCollectionTime) {
        break;
      }
    }
    
    // If we've passed all times today, go to tomorrow at 6:00 AM
    if (pdtTime >= nextCollectionTime) {
      nextCollectionTime.setDate(nextCollectionTime.getDate() + 1);
      nextCollectionTime.setHours(START_HOUR, 0, 0, 0);
    }
  }
  
  const delay = nextCollectionTime.getTime() - pdtTime.getTime();
  
  console.log(`⏰ Current PDT time: ${pdtTime.toLocaleString("en-US", {timeZone: "America/Los_Angeles"})}`);
  console.log(`🎯 Next collection time: ${nextCollectionTime.toLocaleString("en-US", {timeZone: "America/Los_Angeles"})}`);
  console.log(`⏱️  Delay: ${Math.round(delay / 1000 / 60)} minutes`);
  
  return delay;
}

// Function to run the star collection script
function runStarCollection() {
  console.log('🚀 Running star collection...');
  
  const scriptPath = path.join(__dirname, 'collect-stars-3hour.js');
  const child = spawn('node', [scriptPath], {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  child.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Star collection completed successfully');
    } else {
      console.error(`❌ Star collection failed with code ${code}`);
    }
    
    // Schedule the next run
    scheduleNextRun();
  });
  
  child.on('error', (error) => {
    console.error('💥 Error running star collection:', error);
    scheduleNextRun();
  });
}

// Function to schedule the next run
function scheduleNextRun() {
  const delay = getDelayUntilNextCollection();
  
  console.log(`⏰ Scheduling next star collection in ${Math.round(delay / 1000 / 60)} minutes...`);
  
  setTimeout(() => {
    runStarCollection();
  }, delay);
}

// Start the scheduling
console.log('🎯 Starting 3-hour star collection scheduler...');
console.log(`📅 Collection times: ${COLLECTION_TIMES.map(h => `${h}:00`).join(', ')} PDT`);
console.log('💡 Press Ctrl+C to stop the scheduler');

// Schedule the first run
scheduleNextRun();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping star collection scheduler...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping star collection scheduler...');
  process.exit(0);
}); 