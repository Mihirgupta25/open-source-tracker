const axios = require('axios');
const fs = require('fs');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'promptfoo/promptfoo';

async function fetchStargazersWithDates() {
  try {
    console.log('🔍 Fetching stargazers with star dates...');
    
    // Try to get stargazers with dates using a different endpoint
    const response = await axios.get(`https://api.github.com/repos/${REPO}/stargazers?per_page=100`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    
    console.log(`📊 Found ${response.data.length} stargazers`);
    
    // The stargazers endpoint doesn't include starred_at by default
    // We need to use a different approach to get historical data
    
    // Let's try using the repository's star history from events
    console.log('📈 Fetching star history from events...');
    
    const events = [];
    let page = 1;
    const maxPages = 100;
    
    while (page <= maxPages) {
      try {
        const eventResponse = await axios.get(`https://api.github.com/repos/${REPO}/events?per_page=100&page=${page}`, {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        if (eventResponse.data.length === 0) {
          console.log(`✅ Reached end of events at page ${page}`);
          break;
        }
        
        // Filter for star events
        const starEvents = eventResponse.data.filter(event => event.type === 'WatchEvent');
        events.push(...starEvents);
        
        console.log(`📄 Page ${page}: Found ${starEvents.length} star events (${eventResponse.data.length} total events)`);
        
        page++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error fetching page ${page}:`, error.message);
        break;
      }
    }
    
    console.log(`📊 Total star events found: ${events.length}`);
    
    // Create timeline from events
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
    
    // Get current repo info
    const repoResponse = await axios.get(`https://api.github.com/repos/${REPO}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    const currentStars = repoResponse.data.stargazers_count;
    const createdAt = new Date(repoResponse.data.created_at);
    
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
    
    // Save timeline
    fs.writeFileSync('promptfoo-star-timeline.json', JSON.stringify(starTimeline, null, 2));
    
    console.log(`💾 Saved star timeline to promptfoo-star-timeline.json`);
    console.log(`📊 Timeline entries: ${starTimeline.length}`);
    console.log(`📊 Current stars: ${currentStars}`);
    console.log(`📅 Repository created: ${createdAt.toISOString()}`);
    
    if (starTimeline.length > 0) {
      console.log(`📅 First event: ${starTimeline[0]?.displayTimestamp || 'N/A'}`);
      console.log(`📅 Last event: ${starTimeline[starTimeline.length - 1]?.displayTimestamp || 'N/A'}`);
    }
    
    // Show sample data
    console.log('\n📋 Sample data:');
    starTimeline.slice(0, 10).forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.displayTimestamp} - ${entry.count} stars (${entry.action}) by ${entry.user}`);
    });
    
    if (starTimeline.length > 10) {
      console.log(`... and ${starTimeline.length - 10} more entries`);
    }
    
    return starTimeline;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

// Alternative: Try to get data from GitHub Archive
async function fetchFromGitHubArchive() {
  console.log('🔍 Note: For comprehensive historical data, consider:');
  console.log('   1. GitHub Archive (BigQuery): githubarchive.day.events');
  console.log('   2. GitHub Archive downloads: https://data.githubarchive.org/');
  console.log('   3. GitHub API events (limited to recent data)');
  console.log('   4. Third-party services that track star history');
  
  return [];
}

async function main() {
  try {
    console.log('🚀 Fetching historical star data for Promptfoo...');
    
    if (process.argv.includes('--archive')) {
      await fetchFromGitHubArchive();
    } else {
      await fetchStargazersWithDates();
    }
    
    console.log('✅ Historical star data fetch completed!');
    
  } catch (error) {
    console.error('❌ Failed to fetch historical data:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchStargazersWithDates, fetchFromGitHubArchive }; 