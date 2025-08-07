const axios = require('axios');
const fs = require('fs');

// Configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'promptfoo/promptfoo';
const START_DATE = '2023-04-28'; // Repository creation date
const END_DATE = '2025-07-24'; // End date specified by user

async function fetchFromGitHubArchiveAPI() {
  console.log('🔍 Fetching from GitHub Archive API...');
  
  try {
    // GitHub Archive API provides data by date
    const apiUrl = 'https://api.githubarchive.org/';
    
    console.log(`📊 Fetching data from ${START_DATE} to ${END_DATE}`);
    
    // Create date range
    const startDate = new Date(START_DATE);
    const endDate = new Date(END_DATE);
    const dates = [];
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }
    
    console.log(`📅 Processing ${dates.length} days of data...`);
    
    const allEvents = [];
    let processedDays = 0;
    
    for (const date of dates) {
      try {
        const url = `${apiUrl}data/${date}`;
        console.log(`📄 Fetching ${date}...`);
        
        const response = await axios.get(url, {
          timeout: 30000, // 30 second timeout
          headers: {
            'User-Agent': 'OpenSourceTracker/1.0'
          }
        });
        
        if (response.data && Array.isArray(response.data)) {
          // Filter for star events for promptfoo/promptfoo
          const starEvents = response.data.filter(event => 
            event.type === 'WatchEvent' && 
            event.repo && 
            event.repo.name === REPO
          );
          
          allEvents.push(...starEvents);
          console.log(`✅ ${date}: Found ${starEvents.length} star events`);
        }
        
        processedDays++;
        
        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.log(`⚠️ Error fetching ${date}: ${error.message}`);
        // Continue with next date
      }
    }
    
    console.log(`📊 Total star events found: ${allEvents.length}`);
    
    return allEvents;
    
  } catch (error) {
    console.error('❌ Error accessing GitHub Archive API:', error.message);
    throw error;
  }
}

async function fetchFromGitHubAPI() {
  console.log('📈 Fetching from GitHub API (recent events only)...');
  
  try {
    const events = [];
    let page = 1;
    const maxPages = 100;
    
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
        
        // Filter for star events and date range
        const starEvents = response.data.filter(event => {
          if (event.type !== 'WatchEvent') return false;
          
          const eventDate = new Date(event.created_at);
          const startDate = new Date(START_DATE);
          const endDate = new Date(END_DATE);
          
          return eventDate >= startDate && eventDate <= endDate;
        });
        
        events.push(...starEvents);
        
        console.log(`📄 Page ${page}: Found ${starEvents.length} star events in date range`);
        
        // Check if we've gone past our end date
        const oldestEvent = response.data[response.data.length - 1];
        if (oldestEvent && new Date(oldestEvent.created_at) < new Date(START_DATE)) {
          console.log('✅ Reached events older than start date');
          break;
        }
        
        page++;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error fetching page ${page}:`, error.message);
        break;
      }
    }
    
    console.log(`📊 Total star events found: ${events.length}`);
    return events;
    
  } catch (error) {
    console.error('❌ Error fetching from GitHub API:', error.message);
    throw error;
  }
}

function createTimeline(events) {
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
  
  return starTimeline;
}

function createDailySummary(timeline) {
  console.log('📊 Creating daily summary...');
  
  const dailyData = {};
  
  for (const entry of timeline) {
    const date = new Date(entry.timestamp).toISOString().split('T')[0];
    
    if (!dailyData[date]) {
      dailyData[date] = {
        date: date,
        stars_added: 0,
        stars_removed: 0,
        final_count: 0,
        events: []
      };
    }
    
    if (entry.action === 'started') {
      dailyData[date].stars_added++;
    } else if (entry.action === 'deleted') {
      dailyData[date].stars_removed++;
    }
    
    dailyData[date].final_count = entry.count;
    dailyData[date].events.push({
      time: entry.displayTimestamp,
      action: entry.action,
      user: entry.user,
      count: entry.count
    });
  }
  
  return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
}

async function main() {
  try {
    console.log('🚀 Fetching Historical Star Data for Promptfoo');
    console.log(`📅 Date Range: ${START_DATE} to ${END_DATE}`);
    console.log('==============================================\n');
    
    // Try GitHub API directly since GitHub Archive is not accessible
    let events = [];
    try {
      events = await fetchFromGitHubAPI();
    } catch (error) {
      console.log('⚠️ GitHub API failed:', error.message);
      events = [];
    }
    
    if (events.length === 0) {
      console.log('⚠️ No events found. This could mean:');
      console.log('   - Repository had no star activity in this period');
      console.log('   - Data is not available in the selected source');
      console.log('   - Date range needs adjustment');
      return;
    }
    
    // Create timeline
    const timeline = createTimeline(events);
    const dailySummary = createDailySummary(timeline);
    
    // Save data
    const outputData = {
      repository: REPO,
      dateRange: {
        start: START_DATE,
        end: END_DATE
      },
      summary: {
        totalEvents: events.length,
        timelineEntries: timeline.length,
        dailyEntries: dailySummary.length,
        finalStarCount: timeline.length > 0 ? timeline[timeline.length - 1].count : 0
      },
      timeline: timeline,
      dailySummary: dailySummary
    };
    
    fs.writeFileSync('promptfoo-historical-stars-2023-2025.json', JSON.stringify(outputData, null, 2));
    
    console.log('\n📊 Results Summary:');
    console.log(`- Repository: ${REPO}`);
    console.log(`- Date Range: ${START_DATE} to ${END_DATE}`);
    console.log(`- Total Star Events: ${events.length}`);
    console.log(`- Timeline Entries: ${timeline.length}`);
    console.log(`- Daily Summary Entries: ${dailySummary.length}`);
    
    if (timeline.length > 0) {
      console.log(`- Final Star Count: ${timeline[timeline.length - 1].count}`);
      console.log(`- First Event: ${timeline[0].displayTimestamp}`);
      console.log(`- Last Event: ${timeline[timeline.length - 1].displayTimestamp}`);
    }
    
    // Show sample data
    console.log('\n📋 Sample Timeline:');
    timeline.slice(0, 10).forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.displayTimestamp} - ${entry.count} stars (${entry.action}) by ${entry.user}`);
    });
    
    if (timeline.length > 10) {
      console.log(`... and ${timeline.length - 10} more entries`);
    }
    
    console.log('\n📋 Sample Daily Summary:');
    dailySummary.slice(0, 5).forEach((day, index) => {
      console.log(`${index + 1}. ${day.date}: +${day.stars_added} -${day.stars_removed} = ${day.final_count} stars`);
    });
    
    if (dailySummary.length > 5) {
      console.log(`... and ${dailySummary.length - 5} more days`);
    }
    
    console.log('\n💾 Data saved to: promptfoo-historical-stars-2023-2025.json');
    console.log('✅ Historical star data fetch completed!');
    
  } catch (error) {
    console.error('❌ Failed to fetch historical data:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { 
  fetchFromGitHubArchiveAPI, 
  fetchFromGitHubAPI, 
  createTimeline, 
  createDailySummary 
}; 