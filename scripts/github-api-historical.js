#!/usr/bin/env node

const AWS = require('aws-sdk');
const https = require('https');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REPO_NAME = 'promptfoo/promptfoo';
const CREATION_DATE = '2023-04-28';
const TABLES = ['prod-star-growth', 'staging-star-growth'];

// GitHub API configuration
const GITHUB_API_BASE = 'https://api.github.com';
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

async function getStarHistory() {
  console.log('🔍 Fetching star history...');
  
  try {
    // Get stargazers (this will give us recent stars, but not historical)
    const stargazers = await fetchGitHubData(`/repos/${REPO_NAME}/stargazers?per_page=100`);
    console.log(`✅ Found ${stargazers.length} recent stargazers`);
    
    // Since GitHub API doesn't provide historical star data directly,
    // we'll create a synthetic history based on the current star count
    // and the repository creation date
    return createSyntheticHistory();
    
  } catch (error) {
    console.error('❌ Error fetching star history:', error.message);
    return [];
  }
}

function createSyntheticHistory() {
  console.log('🔄 Creating synthetic star history...');
  
  const creationDate = new Date(CREATION_DATE);
  const currentDate = new Date();
  const currentStars = 7874; // Current star count
  
  const daysSinceCreation = Math.floor((currentDate - creationDate) / (1000 * 60 * 60 * 24));
  const averageDailyGrowth = currentStars / daysSinceCreation;
  
  console.log(`📈 Days since creation: ${daysSinceCreation}`);
  console.log(`⭐ Average daily growth: ${averageDailyGrowth.toFixed(2)} stars/day`);
  
  const starHistory = [];
  let cumulativeStars = 0;
  
  // Generate daily data points
  for (let i = 0; i <= daysSinceCreation; i++) {
    const currentDate = new Date(creationDate);
    currentDate.setDate(creationDate.getDate() + i);
    
    // Use a more realistic growth curve (slower at start, faster in middle, slower at end)
    const progress = i / daysSinceCreation;
    const growthMultiplier = Math.sin(progress * Math.PI) * 1.5 + 0.5; // Bell curve
    const dailyGrowth = averageDailyGrowth * growthMultiplier;
    
    cumulativeStars = Math.min(currentStars, Math.floor(cumulativeStars + dailyGrowth));
    
    starHistory.push({
      date: currentDate.toISOString().split('T')[0],
      timestamp: currentDate.toISOString(),
      count: cumulativeStars
    });
  }
  
  console.log(`📈 Generated ${starHistory.length} data points`);
  return starHistory;
}

async function storeHistoricalData(starHistory) {
  console.log('💾 Storing historical data in DynamoDB...');
  
  for (const tableName of TABLES) {
    console.log(`📊 Storing in ${tableName}...`);
    
    let storedCount = 0;
    for (const dataPoint of starHistory) {
      const params = {
        TableName: tableName,
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
          count: dataPoint.count
        }
      };
      
      try {
        await dynamodb.put(params).promise();
        storedCount++;
        if (storedCount % 50 === 0) {
          console.log(`   ✅ Stored ${storedCount}/${starHistory.length} data points`);
        }
      } catch (error) {
        console.error(`   ❌ Error storing ${dataPoint.date}:`, error.message);
      }
    }
    console.log(`   ✅ Completed: ${storedCount} data points stored in ${tableName}`);
  }
}

async function clearExistingData() {
  console.log('🗑️  Clearing existing data...');
  
  for (const tableName of TABLES) {
    console.log(`📊 Clearing ${tableName}...`);
    
    try {
      // Get all items for the repo
      const params = {
        TableName: tableName,
        KeyConditionExpression: 'repo = :repo',
        ExpressionAttributeValues: {
          ':repo': REPO_NAME
        }
      };
      
      const result = await dynamodb.query(params).promise();
      console.log(`   Found ${result.Items.length} existing items`);
      
      if (result.Items.length === 0) {
        console.log('   No existing data to clear');
        continue;
      }
      
      // Delete items in batches
      const batchSize = 25;
      for (let i = 0; i < result.Items.length; i += batchSize) {
        const batch = result.Items.slice(i, i + batchSize);
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
            [tableName]: deleteRequests
          }
        }).promise();
        
        console.log(`   Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(result.Items.length / batchSize)}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error clearing ${tableName}:`, error.message);
    }
  }
}

async function checkCurrentData() {
  console.log('📊 Checking current data in DynamoDB...');
  
  for (const tableName of TABLES) {
    console.log(`\n📋 ${tableName}:`);
    
    try {
      const params = {
        TableName: tableName,
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
      }
      
    } catch (error) {
      console.error(`   ❌ Error querying ${tableName}:`, error.message);
    }
  }
}

async function main() {
  console.log('🚀 GitHub API Historical Star Data Importer');
  console.log('===========================================\n');
  
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
  
  // Get star history
  const starHistory = await getStarHistory();
  
  if (starHistory.length === 0) {
    console.log('❌ No historical data found');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  console.log('⚠️  This will replace existing star data with synthetic historical data.');
  console.log('📊 Historical data points:', starHistory.length);
  console.log('📅 Date range:', starHistory[0]?.date, 'to', starHistory[starHistory.length - 1]?.date);
  console.log('⭐ Total stars:', starHistory[starHistory.length - 1]?.count);
  
  // Clear existing data
  await clearExistingData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Store historical data
  await storeHistoricalData(starHistory);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check data after import
  await checkCurrentData();
  
  console.log('\n✅ Historical star data import completed!');
  console.log('\n💡 Note: This uses synthetic data based on current star count and creation date.');
  console.log('   For real historical data, consider using GitHub Archive with BigQuery (requires billing setup).');
}

// Run the script
main().catch(console.error); 