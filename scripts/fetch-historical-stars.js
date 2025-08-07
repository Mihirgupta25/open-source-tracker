const axios = require('axios');
const fs = require('fs');

// GitHub API configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'promptfoo/promptfoo';

async function fetchHistoricalStars() {
  try {
    console.log('🔍 Fetching historical star count data for Promptfoo...');
    
    // Get current star count
    const currentResponse = await axios.get(`https://api.github.com/repos/${REPO}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    const currentStars = currentResponse.data.stargazers_count;
    const createdAt = new Date(currentResponse.data.created_at);
    console.log(`📊 Current stars: ${currentStars}`);
    console.log(`📅 Repository created: ${createdAt.toISOString()}`);
    
    // Fetch star history using GitHub API events
    console.log('📈 Fetching star history...');
    const events = [];
    let page = 1;
    const maxPages = 100; // Limit to prevent rate limiting
    
    while (page <= maxPages) {
      try {
        const response = await axios.get(`https://api.github.com/repos/${REPO}/events?per_page=100&page=${page}`, {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        if (response.data.length === 0) {
          console.log(`✅ Reached end of events at page ${page}`);
          break;
        }
        
        // Filter for star events
        const starEvents = response.data.filter(event => event.type === 'WatchEvent');
        events.push(...starEvents);
        
        console.log(`📄 Page ${page}: Found ${starEvents.length} star events (${response.data.length} total events)`);
        
        page++;
        
        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        if (error.response && error.response.status === 404) {
          console.log(`✅ Reached end of events at page ${page}`);
          break;
        }
        console.error(`❌ Error fetching page ${page}:`, error.message);
        break;
      }
    }
    
    console.log(`📊 Total star events found: ${events.length}`);
    
    // Process star events to create timeline
    const starTimeline = [];
    let runningCount = 0;
    
    // Sort events by date (oldest first)
    events.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    for (const event of events) {
      const timestamp = new Date(event.created_at);
      const action = event.payload.action; // 'started' or 'deleted'
      
      if (action === 'started') {
        runningCount++;
      } else if (action === 'deleted') {
        runningCount = Math.max(0, runningCount - 1);
      }
      
      starTimeline.push({
        timestamp: timestamp.toISOString(),
        displayTimestamp: timestamp.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Los_Angeles'
        }),
        count: runningCount,
        action: action,
        user: event.actor.login
      });
    }
    
    // Add current count if no recent events
    if (starTimeline.length === 0 || starTimeline[starTimeline.length - 1].count !== currentStars) {
      const now = new Date();
      starTimeline.push({
        timestamp: now.toISOString(),
        displayTimestamp: now.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Los_Angeles'
        }),
        count: currentStars,
        action: 'current',
        user: 'current'
      });
    }
    
    console.log(`📈 Processed ${starTimeline.length} star count entries`);
    
    // Save to file
    const outputFile = 'promptfoo-historical-stars.json';
    fs.writeFileSync(outputFile, JSON.stringify(starTimeline, null, 2));
    console.log(`💾 Saved historical data to ${outputFile}`);
    
    // Display summary
    console.log('\n📊 Summary:');
    console.log(`- Total star events: ${events.length}`);
    console.log(`- Timeline entries: ${starTimeline.length}`);
    console.log(`- Current stars: ${currentStars}`);
    console.log(`- First event: ${starTimeline[0]?.displayTimestamp || 'N/A'}`);
    console.log(`- Last event: ${starTimeline[starTimeline.length - 1]?.displayTimestamp || 'N/A'}`);
    
    // Show sample data
    console.log('\n📋 Sample data:');
    starTimeline.slice(0, 5).forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.displayTimestamp} - ${entry.count} stars (${entry.action})`);
    });
    
    if (starTimeline.length > 5) {
      console.log(`... and ${starTimeline.length - 5} more entries`);
    }
    
    return starTimeline;
    
  } catch (error) {
    console.error('❌ Error fetching historical stars:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
}

// Alternative: Use GitHub Archive data (if available)
async function fetchFromGitHubArchive() {
  console.log('🔍 Attempting to fetch from GitHub Archive...');
  
  // Note: GitHub Archive data might not be readily available for star events
  // This is a placeholder for future implementation
  console.log('⚠️ GitHub Archive data for star events may not be available');
  console.log('📊 Using GitHub API events instead...');
  
  return await fetchHistoricalStars();
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting historical star count fetch for Promptfoo...');
    
    if (process.argv.includes('--archive')) {
      await fetchFromGitHubArchive();
    } else {
      await fetchHistoricalStars();
    }
    
    console.log('✅ Historical star count fetch completed!');
    
  } catch (error) {
    console.error('❌ Failed to fetch historical stars:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fetchHistoricalStars, fetchFromGitHubArchive }; 