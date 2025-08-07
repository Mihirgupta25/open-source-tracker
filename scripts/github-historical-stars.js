#!/usr/bin/env node

const AWS = require('aws-sdk');
const axios = require('axios');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REPO_NAME = 'promptfoo/promptfoo';
const CREATION_DATE = '2023-04-28';
const TABLES = ['prod-star-growth', 'staging-star-growth'];

// Get GitHub token from AWS Secrets Manager
async function getGitHubToken() {
  const secretsManager = new AWS.SecretsManager();
  try {
    const data = await secretsManager.getSecretValue({ SecretId: 'github-token-prod' }).promise();
    const secret = JSON.parse(data.SecretString);
    return secret.token;
  } catch (error) {
    console.error('Error getting GitHub token:', error);
    return null;
  }
}

async function getRepositoryStars(githubToken, page = 1) {
  try {
    const headers = githubToken
      ? { Authorization: `token ${githubToken}` }
      : {};
    
    const response = await axios.get(
      `https://api.github.com/repos/${REPO_NAME}/stargazers?per_page=100&page=${page}`,
      { headers }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error fetching stars:', error.message);
    return [];
  }
}

async function getAllStars(githubToken) {
  console.log('🔍 Fetching all stars for promptfoo/promptfoo...');
  
  const allStars = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    console.log(`📄 Fetching page ${page}...`);
    const stars = await getRepositoryStars(githubToken, page);
    
    if (stars.length === 0) {
      hasMore = false;
    } else {
      allStars.push(...stars);
      page++;
      
      // Add a small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log(`✅ Found ${allStars.length} total stars`);
  return allStars;
}

function processStarHistory(stars) {
  console.log('🔄 Processing star history...');
  
  // Group stars by date
  const starsByDate = {};
  
  stars.forEach(star => {
    const starDate = new Date(star.starred_at);
    const dateKey = starDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    if (!starsByDate[dateKey]) {
      starsByDate[dateKey] = [];
    }
    starsByDate[dateKey].push(star);
  });
  
  // Calculate cumulative stars by date
  const starHistory = [];
  let cumulativeStars = 0;
  const sortedDates = Object.keys(starsByDate).sort();
  
  sortedDates.forEach(date => {
    cumulativeStars += starsByDate[date].length;
    starHistory.push({
      date: date,
      timestamp: new Date(date + 'T00:00:00Z').toISOString(),
      count: cumulativeStars,
      newStars: starsByDate[date].length
    });
  });
  
  console.log(`📈 Processed ${starHistory.length} data points`);
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

async function main() {
  console.log('🚀 GitHub Historical Star Data Importer');
  console.log('=======================================\n');
  
  // Check current data first
  await checkCurrentData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Get GitHub token
  const githubToken = await getGitHubToken();
  if (!githubToken) {
    console.error('❌ No GitHub token available');
    return;
  }
  
  // Get all stars
  const stars = await getAllStars(githubToken);
  
  if (stars.length === 0) {
    console.error('❌ No stars found');
    return;
  }
  
  // Process star history
  const starHistory = processStarHistory(stars);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Ask user if they want to clear existing data
  console.log('⚠️  This will replace existing star data with historical data.');
  console.log('📊 Historical data points:', starHistory.length);
  console.log('📅 Date range:', starHistory[0]?.date, 'to', starHistory[starHistory.length - 1]?.date);
  console.log('⭐ Total stars:', starHistory[starHistory.length - 1]?.count);
  
  // For now, let's proceed with clearing and storing
  await clearExistingData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Store historical data
  await storeHistoricalData(starHistory);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check data after import
  await checkCurrentData();
  
  console.log('\n✅ Historical star data import completed!');
}

// Run the script
main().catch(console.error); 