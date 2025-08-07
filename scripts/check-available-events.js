const axios = require('axios');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'promptfoo/promptfoo';

async function checkAvailableEvents() {
  try {
    console.log('🔍 Checking available events for promptfoo/promptfoo...');
    
    // Get repository info first
    const repoResponse = await axios.get(`https://api.github.com/repos/${REPO}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    console.log(`📊 Repository Info:`);
    console.log(`- Name: ${repoResponse.data.full_name}`);
    console.log(`- Created: ${repoResponse.data.created_at}`);
    console.log(`- Current Stars: ${repoResponse.data.stargazers_count}`);
    console.log(`- Last Updated: ${repoResponse.data.updated_at}`);
    
    // Get recent events
    console.log('\n📈 Fetching recent events...');
    const eventsResponse = await axios.get(`https://api.github.com/repos/${REPO}/events?per_page=100`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    console.log(`📊 Found ${eventsResponse.data.length} total events`);
    
    // Analyze event types
    const eventTypes = {};
    const starEvents = [];
    
    eventsResponse.data.forEach((event, index) => {
      const eventDate = new Date(event.created_at);
      const eventType = event.type;
      
      if (!eventTypes[eventType]) {
        eventTypes[eventType] = 0;
      }
      eventTypes[eventType]++;
      
      if (eventType === 'WatchEvent') {
        starEvents.push({
          date: event.created_at,
          action: event.payload.action,
          user: event.actor.login
        });
      }
      
      // Show first 10 events
      if (index < 10) {
        console.log(`${index + 1}. ${eventDate.toISOString()} - ${eventType} by ${event.actor.login}`);
      }
    });
    
    console.log('\n📊 Event Type Summary:');
    Object.entries(eventTypes).forEach(([type, count]) => {
      console.log(`- ${type}: ${count} events`);
    });
    
    console.log(`\n⭐ Star Events Found: ${starEvents.length}`);
    starEvents.forEach((event, index) => {
      console.log(`${index + 1}. ${event.date} - ${event.action} by ${event.user}`);
    });
    
    // Check if we can get more events
    console.log('\n📄 Checking for more events...');
    let page = 2;
    let totalEvents = eventsResponse.data.length;
    
    while (page <= 5) {
      try {
        const response = await axios.get(`https://api.github.com/repos/${REPO}/events?per_page=100&page=${page}`, {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        if (response.data.length === 0) {
          console.log(`✅ No more events found at page ${page}`);
          break;
        }
        
        totalEvents += response.data.length;
        console.log(`📄 Page ${page}: Found ${response.data.length} events`);
        
        // Check for star events in this page
        const pageStarEvents = response.data.filter(event => event.type === 'WatchEvent');
        if (pageStarEvents.length > 0) {
          console.log(`⭐ Page ${page} star events: ${pageStarEvents.length}`);
        }
        
        page++;
        
      } catch (error) {
        console.log(`❌ Error at page ${page}: ${error.message}`);
        break;
      }
    }
    
    console.log(`\n📊 Total events found: ${totalEvents}`);
    
    // Check stargazers
    console.log('\n⭐ Checking stargazers...');
    const stargazersResponse = await axios.get(`https://api.github.com/repos/${REPO}/stargazers?per_page=100`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    console.log(`📊 Found ${stargazersResponse.data.length} stargazers (first page)`);
    console.log('📋 Sample stargazers:');
    stargazersResponse.data.slice(0, 5).forEach((stargazer, index) => {
      console.log(`${index + 1}. ${stargazer.login}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

checkAvailableEvents(); 