#!/usr/bin/env node

const AWS = require('aws-sdk');
const { BigQuery } = require('@google-cloud/bigquery');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REPO_NAME = 'promptfoo/promptfoo';
const CREATION_DATE = '2023-04-28';
const TABLES = ['prod-star-growth', 'staging-star-growth'];

// BigQuery configuration - use our own project for running queries
const bigquery = new BigQuery({
  projectId: 'open-source-tracker-1754516518', // Our project
});

async function queryGitHubArchive() {
  console.log('🔍 Querying GitHub Archive for historical star data...');
  console.log(`📊 Repository: ${REPO_NAME}`);
  console.log(`📅 Since: ${CREATION_DATE}`);
  
  // Query for WatchEvents (star events) from GitHub Archive
  // Note: We reference the githubarchive project's dataset but run the query in our project
  // Using specific months to avoid quota limits
  const query = `
    SELECT
      created_at,
      JSON_EXTRACT_SCALAR(payload, '$.action') as action,
      JSON_EXTRACT_SCALAR(payload, '$.starred_at') as starred_at,
      JSON_EXTRACT_SCALAR(payload, '$.user.login') as user_login,
      id
    FROM \`githubarchive.day.202304\`
    WHERE type = 'WatchEvent'
    AND JSON_EXTRACT_SCALAR(payload, '$.action') = 'started'
    AND repo.name = '${REPO_NAME}'
    AND created_at >= '${CREATION_DATE}'
    
    UNION ALL
    
    SELECT
      created_at,
      JSON_EXTRACT_SCALAR(payload, '$.action') as action,
      JSON_EXTRACT_SCALAR(payload, '$.starred_at') as starred_at,
      JSON_EXTRACT_SCALAR(payload, '$.user.login') as user_login,
      id
    FROM \`githubarchive.day.202305\`
    WHERE type = 'WatchEvent'
    AND JSON_EXTRACT_SCALAR(payload, '$.action') = 'started'
    AND repo.name = '${REPO_NAME}'
    
    UNION ALL
    
    SELECT
      created_at,
      JSON_EXTRACT_SCALAR(payload, '$.action') as action,
      JSON_EXTRACT_SCALAR(payload, '$.starred_at') as starred_at,
      JSON_EXTRACT_SCALAR(payload, '$.user.login') as user_login,
      id
    FROM \`githubarchive.day.202306\`
    WHERE type = 'WatchEvent'
    AND JSON_EXTRACT_SCALAR(payload, '$.action') = 'started'
    AND repo.name = '${REPO_NAME}'
    
    ORDER BY created_at ASC
  `;

  try {
    console.log('📊 Executing BigQuery query...');
    console.log('⏳ This may take a few minutes for large datasets...');
    
    const [rows] = await bigquery.query({ query });
    
    console.log(`✅ Found ${rows.length} star events`);
    
    if (rows.length === 0) {
      console.log('⚠️  No star events found. This could mean:');
      console.log('   - Repository is private');
      console.log('   - Repository has no stars');
      console.log('   - Data not available in GitHub Archive');
      return [];
    }
    
    // Process the data to create cumulative star counts
    const starHistory = processStarEvents(rows);
    
    console.log(`📈 Processed ${starHistory.length} data points`);
    
    return starHistory;
    
  } catch (error) {
    console.error('❌ Error querying GitHub Archive:', error);
    console.log('\n💡 Troubleshooting tips:');
    console.log('   - Ensure you have BigQuery access');
    console.log('   - Check if the repository is public');
    console.log('   - Verify the repository name is correct');
    console.log('   - Make sure BigQuery API is enabled in your project');
    return [];
  }
}

function processStarEvents(events) {
  console.log('🔄 Processing star events...');
  
  const starHistory = [];
  let cumulativeStars = 0;
  let currentDate = null;
  
  // Group events by date and calculate cumulative stars
  events.forEach(event => {
    const eventDate = new Date(event.created_at);
    const dateKey = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    if (dateKey !== currentDate) {
      if (currentDate !== null) {
        // Store the previous day's data
        starHistory.push({
          date: currentDate,
          timestamp: new Date(currentDate + 'T00:00:00Z').toISOString(),
          count: cumulativeStars
        });
      }
      currentDate = dateKey;
    }
    
    cumulativeStars++;
  });
  
  // Add the last day if we have data
  if (currentDate !== null) {
    starHistory.push({
      date: currentDate,
      timestamp: new Date(currentDate + 'T00:00:00Z').toISOString(),
      count: cumulativeStars
    });
  }
  
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
  console.log('🚀 GitHub Archive Historical Star Data Importer');
  console.log('==============================================\n');
  
  // Check current data first
  await checkCurrentData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Query GitHub Archive
  const starHistory = await queryGitHubArchive();
  
  if (starHistory.length === 0) {
    console.log('❌ No historical data found');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  console.log('⚠️  This will replace existing star data with historical data from GitHub Archive.');
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
  console.log('\n💡 This data comes from GitHub Archive, which contains all public GitHub events.');
}

// Run the script
main().catch(console.error); 