#!/usr/bin/env node

const AWS = require('aws-sdk');
const https = require('https');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REPO_NAME = 'promptfoo/promptfoo';
const START_DATE = '2025-07-27'; // July 27th, 2025
const TABLES = ['staging-star-growth']; // Only staging table

// GitHub API configuration
const USER_AGENT = 'OpenSourceTracker/1.0';

async function fetchGitHubData(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (error) {
            reject(new Error(`Failed to parse JSON: ${error.message}`));
          }
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function getRepositoryInfo() {
  console.log('📊 Fetching repository information...');
  
  try {
    const repoData = await fetchGitHubData(`/repos/${REPO_NAME}`);
    console.log(`✅ Repository: ${repoData.full_name}`);
    console.log(`📅 Created: ${repoData.created_at}`);
    console.log(`⭐ Current stars: ${repoData.stargazers_count}`);
    console.log(`📈 Forks: ${repoData.forks_count}`);
    
    return repoData;
  } catch (error) {
    console.error('❌ Error fetching repository info:', error.message);
    return null;
  }
}

async function getStargazersSinceDate() {
  console.log('📊 Fetching stargazers since July 27th...');
  
  const startDate = new Date(START_DATE);
  console.log(`📅 Start date: ${startDate.toISOString().split('T')[0]}`);
  
  try {
    // Get stargazers with timestamps
    const stargazers = await fetchGitHubData(`/repos/${REPO_NAME}/stargazers?per_page=100&sort=stars`);
    
    if (!Array.isArray(stargazers)) {
      console.error('❌ Unexpected response format from GitHub API');
      return [];
    }
    
    console.log(`📊 Found ${stargazers.length} stargazers (first page)`);
    
    // For each stargazer, we need to get their star timestamp
    const starEvents = [];
    
    for (let i = 0; i < Math.min(stargazers.length, 100); i++) {
      const stargazer = stargazers[i];
      
      try {
        // Get the specific star event for this user
        const starEvent = await fetchGitHubData(`/repos/${REPO_NAME}/stargazers/${stargazer.login}`);
        
        if (starEvent.starred_at) {
          const starDate = new Date(starEvent.starred_at);
          
          // Only include stars since July 27th
          if (starDate >= startDate) {
            starEvents.push({
              date: starDate.toISOString().split('T')[0],
              timestamp: starDate.toISOString(),
              user: stargazer.login
            });
          }
        }
        
        // Add a small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.log(`⚠️  Could not get star timestamp for ${stargazer.login}: ${error.message}`);
        
        if (error.message.includes('rate limit') || error.message.includes('abuse detection')) {
          console.log('🛑 Rate limit hit, stopping collection');
          break;
        }
      }
    }
    
    console.log(`📈 Found ${starEvents.length} star events since July 27th`);
    
    return starEvents;
    
  } catch (error) {
    console.error('❌ Error fetching star history:', error.message);
    return [];
  }
}

function processDailyData(starEvents) {
  console.log('🔄 Processing star events into daily counts...');
  
  // Sort by date
  starEvents.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Group by date and count daily stars
  const dailyStars = {};
  
  starEvents.forEach(event => {
    if (!dailyStars[event.date]) {
      dailyStars[event.date] = 0;
    }
    dailyStars[event.date]++;
  });
  
  // Convert to daily data points
  const processedData = [];
  
  // Get all dates and sort them
  const dates = Object.keys(dailyStars).sort();
  
  dates.forEach(date => {
    processedData.push({
      date: date,
      timestamp: new Date(date + 'T00:00:00Z').toISOString(),
      count: dailyStars[date]
    });
  });
  
  console.log(`📈 Processed ${processedData.length} daily data points`);
  return processedData;
}

async function getExistingStarCount() {
  console.log('📊 Getting existing star count before July 27th...');
  
  try {
    const params = {
      TableName: 'staging-star-growth',
      KeyConditionExpression: 'repo = :repo',
      ExpressionAttributeValues: {
        ':repo': REPO_NAME
      },
      ScanIndexForward: false,
      Limit: 1
    };
    
    const result = await dynamodb.query(params).promise();
    
    if (result.Items.length > 0) {
      // Find the last entry before July 27th
      const beforeJuly27 = result.Items.find(item => {
        const itemDate = new Date(item.timestamp);
        const july27 = new Date(START_DATE);
        return itemDate < july27;
      });
      
      if (beforeJuly27) {
        console.log(`📊 Found existing star count: ${beforeJuly27.count} stars before July 27th`);
        return beforeJuly27.count;
      }
    }
    
    console.log('📊 No existing data found, starting from 0');
    return 0;
    
  } catch (error) {
    console.error('❌ Error getting existing star count:', error.message);
    return 0;
  }
}

async function storeDailyData(processedData, baseStarCount) {
  console.log('💾 Storing daily data in DynamoDB...');
  
  let cumulativeStars = baseStarCount;
  
  for (const dataPoint of processedData) {
    cumulativeStars += dataPoint.count;
    
    const params = {
      TableName: 'staging-star-growth',
      Item: {
        repo: REPO_NAME,
        timestamp: dataPoint.timestamp,
        displayTimestamp: new Date(dataPoint.timestamp).toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'America/Los_Angeles'
        }),
        count: cumulativeStars
      }
    };
    
    try {
      await dynamodb.put(params).promise();
      console.log(`   ✅ ${dataPoint.date}: ${dataPoint.count} new stars, total: ${cumulativeStars}`);
    } catch (error) {
      console.error(`   ❌ Error storing ${dataPoint.date}:`, error.message);
    }
  }
  
  console.log(`   ✅ Completed: ${processedData.length} daily data points stored`);
}

async function clearDataSinceJuly27() {
  console.log('🗑️  Clearing data since July 27th...');
  
  try {
    // Get all items for the repo
    const params = {
      TableName: 'staging-star-growth',
      KeyConditionExpression: 'repo = :repo',
      ExpressionAttributeValues: {
        ':repo': REPO_NAME
      }
    };
    
    const result = await dynamodb.query(params).promise();
    console.log(`   Found ${result.Items.length} total items`);
    
    // Filter items since July 27th
    const july27 = new Date(START_DATE);
    const itemsToDelete = result.Items.filter(item => {
      const itemDate = new Date(item.timestamp);
      return itemDate >= july27;
    });
    
    console.log(`   Found ${itemsToDelete.length} items to delete since July 27th`);
    
    if (itemsToDelete.length === 0) {
      console.log('   No items to delete');
      return;
    }
    
    // Delete items in batches
    const batchSize = 25;
    for (let i = 0; i < itemsToDelete.length; i += batchSize) {
      const batch = itemsToDelete.slice(i, i + batchSize);
      const deleteRequests = batch.map(item => ({
        DeleteRequest: {
          Key: {
            repo: item.repo,
            timestamp: item.timestamp
          }
        }
      }));
      
      await dynamodb.batchWrite({
        RequestItems: {
          'staging-star-growth': deleteRequests
        }
      }).promise();
      
      console.log(`   Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(itemsToDelete.length / batchSize)}`);
    }
    
  } catch (error) {
    console.error(`   ❌ Error clearing data:`, error.message);
  }
}

async function checkCurrentData() {
  console.log('📊 Checking current data in DynamoDB...');
  
  try {
    const params = {
      TableName: 'staging-star-growth',
      KeyConditionExpression: 'repo = :repo',
      ExpressionAttributeValues: {
        ':repo': REPO_NAME
      },
      ScanIndexForward: true
    };
    
    const result = await dynamodb.query(params).promise();
    console.log(`   Total entries: ${result.Items.length}`);
    
    if (result.Items.length > 0) {
      const first = result.Items[0];
      const last = result.Items[result.Items.length - 1];
      console.log(`   First: ${first.timestamp} - ${first.count} stars`);
      console.log(`   Last: ${last.timestamp} - ${last.count} stars`);
      
      // Show recent entries
      const recentEntries = result.Items.slice(-10);
      console.log(`   Recent entries:`);
      recentEntries.forEach(item => {
        console.log(`     ${item.timestamp} - ${item.count} stars`);
      });
    }
    
  } catch (error) {
    console.error(`   ❌ Error querying staging-star-growth:`, error.message);
  }
}

async function main() {
  console.log('🚀 GitHub API Daily Star Count Since July 27th');
  console.log('==============================================\n');
  
  // Check current data first
  await checkCurrentData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Get repository information
  const repoInfo = await getRepositoryInfo();
  if (!repoInfo) {
    console.log('❌ Failed to get repository information');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Get star events since July 27th
  const starEvents = await getStargazersSinceDate();
  
  if (starEvents.length === 0) {
    console.log('❌ No star events found since July 27th');
    console.log('💡 This could mean:');
    console.log('   - No new stars since July 27th');
    console.log('   - Rate limits were hit');
    console.log('   - API access issues');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Process the star events
  const processedData = processDailyData(starEvents);
  
  if (processedData.length === 0) {
    console.log('❌ No processed data available');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Get existing star count before July 27th
  const baseStarCount = await getExistingStarCount();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  console.log('⚠️  This will replace data since July 27th with real daily star counts from GitHub API.');
  console.log('📊 Daily data points:', processedData.length);
  console.log('📅 Date range:', processedData[0]?.date, 'to', processedData[processedData.length - 1]?.date);
  console.log('⭐ Base star count before July 27th:', baseStarCount);
  
  // Clear data since July 27th
  await clearDataSinceJuly27();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Store daily data
  await storeDailyData(processedData, baseStarCount);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check data after import
  await checkCurrentData();
  
  console.log('\n✅ Daily star count reconstruction completed!');
  console.log('\n💡 This data comes from GitHub API, showing real daily star events since July 27th.');
  console.log('   Note: This only includes the first 100 stargazers due to API limitations.');
}

// Run the script
main().catch(console.error); 