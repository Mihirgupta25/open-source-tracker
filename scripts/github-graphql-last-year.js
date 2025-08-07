#!/usr/bin/env node

const AWS = require('aws-sdk');
const https = require('https');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REPO_NAME = 'promptfoo/promptfoo';
const TABLES = ['prod-star-growth', 'staging-star-growth'];

// GitHub GraphQL API configuration
const USER_AGENT = 'OpenSourceTracker/1.0';

async function fetchGraphQLData(query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });
    
    const options = {
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
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
          reject(new Error(`GitHub GraphQL API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function getRepositoryInfo() {
  console.log('📊 Fetching repository information...');
  
  const query = `
    query {
      repository(owner: "promptfoo", name: "promptfoo") {
        name
        stargazerCount
        createdAt
        forkCount
      }
    }
  `;
  
  try {
    const result = await fetchGraphQLData(query);
    
    if (result.data && result.data.repository) {
      const repo = result.data.repository;
      console.log(`✅ Repository: ${repo.name}`);
      console.log(`📅 Created: ${repo.createdAt}`);
      console.log(`⭐ Current stars: ${repo.stargazerCount}`);
      console.log(`📈 Forks: ${repo.forkCount}`);
      
      return repo;
    } else {
      console.error('❌ Unexpected response format from GitHub GraphQL API');
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching repository info:', error.message);
    return null;
  }
}

async function getStarHistory() {
  console.log('📊 Fetching star history from GitHub GraphQL API...');
  
  // Calculate date range for last year
  const today = new Date();
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  
  console.log(`📅 Date range: ${oneYearAgo.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`);
  
  const query = `
    query {
      repository(owner: "promptfoo", name: "promptfoo") {
        stargazers(first: 100, orderBy: {field: STARRED_AT, direction: DESC}) {
          edges {
            starredAt
            node {
              login
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `;
  
  try {
    const result = await fetchGraphQLData(query);
    
    if (!result.data || !result.data.repository || !result.data.repository.stargazers) {
      console.error('❌ Unexpected response format from GitHub GraphQL API');
      return [];
    }
    
    const stargazers = result.data.repository.stargazers.edges;
    console.log(`📊 Found ${stargazers.length} stargazers (first page)`);
    
    // Filter for stars from the last year
    const starEvents = [];
    
    stargazers.forEach(edge => {
      if (edge.starredAt) {
        const starDate = new Date(edge.starredAt);
        
        // Only include stars from the last year
        if (starDate >= oneYearAgo) {
          starEvents.push({
            date: starDate.toISOString().split('T')[0],
            timestamp: starDate.toISOString(),
            user: edge.node.login
          });
        }
      }
    });
    
    console.log(`📈 Found ${starEvents.length} star events from the last year`);
    
    return starEvents;
    
  } catch (error) {
    console.error('❌ Error fetching star history:', error.message);
    return [];
  }
}

function processLastYearData(starEvents) {
  console.log('🔄 Processing star events into daily cumulative counts...');
  
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
  
  // Convert to cumulative counts
  const processedData = [];
  let cumulativeStars = 0;
  
  // Get all dates and sort them
  const dates = Object.keys(dailyStars).sort();
  
  dates.forEach(date => {
    cumulativeStars += dailyStars[date];
    
    processedData.push({
      date: date,
      timestamp: new Date(date + 'T00:00:00Z').toISOString(),
      count: cumulativeStars
    });
  });
  
  console.log(`📈 Processed ${processedData.length} daily data points`);
  return processedData;
}

async function storeLastYearData(processedData) {
  console.log('💾 Storing last year data in DynamoDB...');
  
  for (const tableName of TABLES) {
    console.log(`📊 Storing in ${tableName}...`);
    
    let storedCount = 0;
    for (const dataPoint of processedData) {
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
        if (storedCount % 10 === 0) {
          console.log(`   ✅ Stored ${storedCount}/${processedData.length} data points`);
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
  console.log('🚀 GitHub GraphQL Last Year Star Growth');
  console.log('========================================\n');
  
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
  
  // Get star history for the last year
  const starEvents = await getStarHistory();
  
  if (starEvents.length === 0) {
    console.log('❌ No star events found for the last year');
    console.log('💡 This could mean:');
    console.log('   - The repository has no stars in the last year');
    console.log('   - Rate limits were hit');
    console.log('   - API access issues');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Process the star events
  const processedData = processLastYearData(starEvents);
  
  if (processedData.length === 0) {
    console.log('❌ No processed data available');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  console.log('⚠️  This will replace existing star data with last year data from GitHub GraphQL API.');
  console.log('📊 Last year data points:', processedData.length);
  console.log('📅 Date range:', processedData[0]?.date, 'to', processedData[processedData.length - 1]?.date);
  console.log('⭐ Final stars:', processedData[processedData.length - 1]?.count);
  
  // Clear existing data
  await clearExistingData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Store last year data
  await storeLastYearData(processedData);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check data after import
  await checkCurrentData();
  
  console.log('\n✅ Last year data import completed!');
  console.log('\n💡 This data comes from GitHub GraphQL API, showing real star events from the last year.');
  console.log('   Note: This only includes the first 100 stargazers due to API limitations.');
}

// Run the script
main().catch(console.error); 