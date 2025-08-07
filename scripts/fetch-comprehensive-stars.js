const axios = require('axios');
const fs = require('fs');

// GitHub API configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'promptfoo/promptfoo';

async function fetchCurrentRepoInfo() {
  try {
    const response = await axios.get(`https://api.github.com/repos/${REPO}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    return {
      currentStars: response.data.stargazers_count,
      createdAt: new Date(response.data.created_at),
      updatedAt: new Date(response.data.updated_at),
      description: response.data.description,
      language: response.data.language
    };
  } catch (error) {
    console.error('❌ Error fetching repo info:', error.message);
    throw error;
  }
}

async function fetchStarEvents() {
  console.log('📈 Fetching star events from GitHub API...');
  const events = [];
  let page = 1;
  const maxPages = 50; // Limit to prevent rate limiting
  
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
  
  return events;
}

async function fetchStargazers() {
  console.log('⭐ Fetching stargazers list...');
  const stargazers = [];
  let page = 1;
  const maxPages = 100; // GitHub API limit is 100 pages
  
  while (page <= maxPages) {
    try {
      const response = await axios.get(`https://api.github.com/repos/${REPO}/stargazers?per_page=100&page=${page}`, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (response.data.length === 0) {
        console.log(`✅ Reached end of stargazers at page ${page}`);
        break;
      }
      
      stargazers.push(...response.data);
      console.log(`📄 Page ${page}: Found ${response.data.length} stargazers`);
      
      page++;
      
      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Error fetching stargazers page ${page}:`, error.message);
      break;
    }
  }
  
  return stargazers;
}

async function fetchFromGitHubArchive() {
  console.log('🔍 Attempting to fetch from GitHub Archive...');
  
  // GitHub Archive data is available via BigQuery or direct downloads
  // For now, we'll note that this is an option for more historical data
  console.log('📊 Note: GitHub Archive data is available via:');
  console.log('   - BigQuery: githubarchive.day.events');
  console.log('   - Direct downloads: https://data.githubarchive.org/');
  console.log('   - This would provide more comprehensive historical data');
  
  return [];
}

function createTimelineFromEvents(events, currentStars) {
  console.log('📊 Creating timeline from events...');
  
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
  
  return starTimeline;
}

function createTimelineFromStargazers(stargazers, repoCreatedAt) {
  console.log('📊 Creating timeline from stargazers...');
  
  const starTimeline = [];
  
  // Sort stargazers by star date (oldest first)
  stargazers.sort((a, b) => new Date(a.starred_at) - new Date(b.starred_at));
  
  let count = 0;
  for (const stargazer of stargazers) {
    count++;
    
    // Handle potential invalid dates
    let timestamp;
    try {
      timestamp = new Date(stargazer.starred_at);
      if (isNaN(timestamp.getTime())) {
        console.log(`⚠️ Invalid date for stargazer ${stargazer.user.login}: ${stargazer.starred_at}`);
        continue;
      }
    } catch (error) {
      console.log(`⚠️ Error parsing date for stargazer ${stargazer.user.login}: ${stargazer.starred_at}`);
      continue;
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
      count: count,
      action: 'started',
      user: stargazer.user.login
    });
  }
  
  return starTimeline;
}

async function main() {
  try {
    console.log('🚀 Starting comprehensive historical star count fetch for Promptfoo...');
    
    // Get current repo info
    const repoInfo = await fetchCurrentRepoInfo();
    console.log(`📊 Current stars: ${repoInfo.currentStars}`);
    console.log(`📅 Repository created: ${repoInfo.createdAt.toISOString()}`);
    console.log(`📅 Last updated: ${repoInfo.updatedAt.toISOString()}`);
    
    // Fetch data using multiple methods
    const [events, stargazers] = await Promise.all([
      fetchStarEvents(),
      fetchStargazers()
    ]);
    
    console.log(`📊 Total star events found: ${events.length}`);
    console.log(`⭐ Total stargazers found: ${stargazers.length}`);
    
    // Create timelines
    const eventsTimeline = createTimelineFromEvents(events, repoInfo.currentStars);
    const stargazersTimeline = createTimelineFromStargazers(stargazers, repoInfo.createdAt);
    
    // Save both timelines
    fs.writeFileSync('promptfoo-events-timeline.json', JSON.stringify(eventsTimeline, null, 2));
    fs.writeFileSync('promptfoo-stargazers-timeline.json', JSON.stringify(stargazersTimeline, null, 2));
    
    console.log(`💾 Saved events timeline to promptfoo-events-timeline.json`);
    console.log(`💾 Saved stargazers timeline to promptfoo-stargazers-timeline.json`);
    
    // Display summary
    console.log('\n📊 Summary:');
    console.log(`- Repository created: ${repoInfo.createdAt.toLocaleDateString()}`);
    console.log(`- Current stars: ${repoInfo.currentStars}`);
    console.log(`- Star events: ${events.length}`);
    console.log(`- Stargazers: ${stargazers.length}`);
    console.log(`- Events timeline entries: ${eventsTimeline.length}`);
    console.log(`- Stargazers timeline entries: ${stargazersTimeline.length}`);
    
    if (eventsTimeline.length > 0) {
      console.log(`- First event: ${eventsTimeline[0]?.displayTimestamp || 'N/A'}`);
      console.log(`- Last event: ${eventsTimeline[eventsTimeline.length - 1]?.displayTimestamp || 'N/A'}`);
    }
    
    if (stargazersTimeline.length > 0) {
      console.log(`- First star: ${stargazersTimeline[0]?.displayTimestamp || 'N/A'}`);
      console.log(`- Last star: ${stargazersTimeline[stargazersTimeline.length - 1]?.displayTimestamp || 'N/A'}`);
    }
    
    // Show sample data
    console.log('\n📋 Sample events data:');
    eventsTimeline.slice(0, 5).forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.displayTimestamp} - ${entry.count} stars (${entry.action}) by ${entry.user}`);
    });
    
    console.log('\n📋 Sample stargazers data:');
    stargazersTimeline.slice(0, 5).forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.displayTimestamp} - ${entry.count} stars by ${entry.user}`);
    });
    
    console.log('\n✅ Comprehensive historical star count fetch completed!');
    
  } catch (error) {
    console.error('❌ Failed to fetch historical stars:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { 
  fetchCurrentRepoInfo, 
  fetchStarEvents, 
  fetchStargazers, 
  createTimelineFromEvents, 
  createTimelineFromStargazers 
}; 