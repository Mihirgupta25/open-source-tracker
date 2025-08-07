const axios = require('axios');
const fs = require('fs');

// GitHub API configuration
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'promptfoo/promptfoo';

// BigQuery configuration (if using BigQuery)
const BIGQUERY_PROJECT_ID = process.env.BIGQUERY_PROJECT_ID || 'your-project-id';

async function fetchFromGitHubArchiveAPI() {
  console.log('🔍 Fetching from GitHub Archive API...');
  
  try {
    // GitHub Archive provides data via BigQuery or direct downloads
    // For demonstration, we'll show the BigQuery approach
    
    console.log('📊 GitHub Archive Data Sources:');
    console.log('1. BigQuery: githubarchive.day.events');
    console.log('2. Direct downloads: https://data.githubarchive.org/');
    console.log('3. GitHub Archive API: https://api.githubarchive.org/');
    
    // Example BigQuery query for star events
    const bigQueryQuery = `
      SELECT 
        created_at,
        actor.login as user,
        repo.name as repository,
        payload.action as action
      FROM \`githubarchive.day.events\`
      WHERE 
        type = 'WatchEvent' 
        AND repo.name = 'promptfoo/promptfoo'
        AND created_at >= '2023-04-28'  -- Repository creation date
      ORDER BY created_at ASC
    `;
    
    console.log('\n📋 Example BigQuery Query:');
    console.log(bigQueryQuery);
    
    return {
      method: 'BigQuery',
      query: bigQueryQuery,
      description: 'This query would fetch all star events for promptfoo/promptfoo from repository creation onwards'
    };
    
  } catch (error) {
    console.error('❌ Error accessing GitHub Archive:', error.message);
    throw error;
  }
}

async function fetchFromGitHubArchiveDownloads() {
  console.log('📥 Fetching from GitHub Archive downloads...');
  
  try {
    // GitHub Archive provides hourly JSON files
    const baseUrl = 'https://data.githubarchive.org/';
    
    // Example: Get data for a specific date
    const targetDate = '2023-04-28'; // Repository creation date
    const hours = Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0'));
    
    console.log(`📊 Fetching data for ${targetDate} (24 hours)`);
    console.log('📋 Example URLs:');
    hours.slice(0, 5).forEach(hour => {
      console.log(`   ${baseUrl}${targetDate}-${hour}.json.gz`);
    });
    console.log('   ... and 19 more hours');
    
    // Note: In practice, you'd download and process these files
    // For now, we'll show the structure
    
    return {
      method: 'Direct Downloads',
      baseUrl: baseUrl,
      description: 'Download hourly JSON files and filter for WatchEvent type'
    };
    
  } catch (error) {
    console.error('❌ Error accessing GitHub Archive downloads:', error.message);
    throw error;
  }
}

async function fetchFromGitHubArchiveAPI() {
  console.log('🌐 Fetching from GitHub Archive API...');
  
  try {
    // GitHub Archive also provides an API
    const apiUrl = 'https://api.githubarchive.org/';
    
    console.log('📊 GitHub Archive API endpoints:');
    console.log('   - /data/:year/:month/:day/:hour');
    console.log('   - /data/:year/:month/:day');
    console.log('   - /data/:year/:month');
    
    // Example API call
    const exampleDate = '2023-04-28';
    const exampleUrl = `${apiUrl}data/${exampleDate}`;
    
    console.log(`📋 Example API URL: ${exampleUrl}`);
    
    return {
      method: 'GitHub Archive API',
      baseUrl: apiUrl,
      description: 'Use the API to fetch historical data for specific dates'
    };
    
  } catch (error) {
    console.error('❌ Error accessing GitHub Archive API:', error.message);
    throw error;
  }
}

async function createBigQueryScript() {
  console.log('📝 Creating BigQuery script...');
  
  const script = `
-- BigQuery script to fetch historical star data for promptfoo/promptfoo
-- Run this in Google BigQuery console

-- Get all star events for the repository
SELECT 
  created_at,
  actor.login as user,
  repo.name as repository,
  payload.action as action,
  -- Calculate running total of stars
  SUM(CASE WHEN payload.action = 'started' THEN 1 ELSE -1 END) 
    OVER (ORDER BY created_at ROWS UNBOUNDED PRECEDING) as running_stars
FROM \`githubarchive.day.events\`
WHERE 
  type = 'WatchEvent' 
  AND repo.name = 'promptfoo/promptfoo'
  AND created_at >= '2023-04-28'  -- Repository creation date
ORDER BY created_at ASC;

-- Alternative: Get daily star counts
SELECT 
  DATE(created_at) as date,
  COUNT(CASE WHEN payload.action = 'started' THEN 1 END) as stars_added,
  COUNT(CASE WHEN payload.action = 'deleted' THEN 1 END) as stars_removed,
  SUM(CASE WHEN payload.action = 'started' THEN 1 ELSE -1 END) as net_change
FROM \`githubarchive.day.events\`
WHERE 
  type = 'WatchEvent' 
  AND repo.name = 'promptfoo/promptfoo'
  AND created_at >= '2023-04-28'
GROUP BY DATE(created_at)
ORDER BY date ASC;
  `;
  
  fs.writeFileSync('bigquery-star-history.sql', script);
  console.log('💾 Saved BigQuery script to bigquery-star-history.sql');
  
  return script;
}

async function createPythonScript() {
  console.log('🐍 Creating Python script for GitHub Archive...');
  
  const script = `
import requests
import json
from datetime import datetime, timedelta
import gzip

def fetch_github_archive_data(start_date, end_date, repo_name):
    """
    Fetch star events from GitHub Archive for a specific repository
    """
    base_url = "https://data.githubarchive.org/"
    star_events = []
    
    current_date = start_date
    while current_date <= end_date:
        # Fetch data for each hour of the day
        for hour in range(24):
            hour_str = f"{hour:02d}"
            date_str = current_date.strftime("%Y-%m-%d")
            url = f"{base_url}{date_str}-{hour_str}.json.gz"
            
            try:
                response = requests.get(url)
                if response.status_code == 200:
                    # Decompress and parse JSON
                    data = json.loads(gzip.decompress(response.content))
                    
                    # Filter for star events for the specific repository
                    for event in data:
                        if (event.get('type') == 'WatchEvent' and 
                            event.get('repo', {}).get('name') == repo_name):
                            star_events.append({
                                'timestamp': event['created_at'],
                                'user': event['actor']['login'],
                                'action': event['payload']['action'],
                                'repository': event['repo']['name']
                            })
                            
            except Exception as e:
                print(f"Error fetching {url}: {e}")
                
        current_date += timedelta(days=1)
    
    return star_events

def process_star_events(events):
    """
    Process star events to create a timeline
    """
    # Sort by timestamp
    events.sort(key=lambda x: x['timestamp'])
    
    timeline = []
    running_count = 0
    
    for event in events:
        if event['action'] == 'started':
            running_count += 1
        elif event['action'] == 'deleted':
            running_count = max(0, running_count - 1)
        
        timeline.append({
            'timestamp': event['timestamp'],
            'count': running_count,
            'action': event['action'],
            'user': event['user']
        })
    
    return timeline

# Example usage
if __name__ == "__main__":
    from datetime import datetime
    
    # Set date range (repository created April 28, 2023)
    start_date = datetime(2023, 4, 28)
    end_date = datetime.now()
    repo_name = "promptfoo/promptfoo"
    
    print(f"Fetching star events for {repo_name} from {start_date} to {end_date}")
    
    # Fetch data
    events = fetch_github_archive_data(start_date, end_date, repo_name)
    print(f"Found {len(events)} star events")
    
    # Process timeline
    timeline = process_star_events(events)
    print(f"Created timeline with {len(timeline)} entries")
    
    # Save to file
    with open('promptfoo-github-archive-timeline.json', 'w') as f:
        json.dump(timeline, f, indent=2)
    
    print("Saved timeline to promptfoo-github-archive-timeline.json")
  `;
  
  fs.writeFileSync('fetch_github_archive.py', script);
  console.log('💾 Saved Python script to fetch_github_archive.py');
  
  return script;
}

async function main() {
  try {
    console.log('🚀 GitHub Archive Historical Star Data Fetch');
    console.log('============================================\n');
    
    // Show different approaches
    const approaches = await Promise.all([
      fetchFromGitHubArchiveAPI(),
      fetchFromGitHubArchiveDownloads(),
      fetchFromGitHubArchiveAPI()
    ]);
    
    console.log('\n📊 Available Methods:');
    approaches.forEach((approach, index) => {
      console.log(`${index + 1}. ${approach.method}`);
      console.log(`   ${approach.description}`);
      console.log('');
    });
    
    // Create scripts
    await createBigQueryScript();
    await createPythonScript();
    
    console.log('✅ GitHub Archive analysis completed!');
    console.log('\n📋 Next Steps:');
    console.log('1. Use BigQuery script in Google Cloud Console');
    console.log('2. Run Python script to fetch from archive downloads');
    console.log('3. Process the data to create historical timeline');
    console.log('4. Import the data into your tracking system');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { 
  fetchFromGitHubArchiveAPI, 
  fetchFromGitHubArchiveDownloads, 
  createBigQueryScript, 
  createPythonScript 
}; 