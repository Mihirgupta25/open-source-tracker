#!/usr/bin/env node

const { BigQuery } = require('@google-cloud/bigquery');
const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

// BigQuery configuration
const bigquery = new BigQuery({
  projectId: 'githubarchive', // Public GitHub Archive project
  keyFilename: null, // We'll use public data
});

const REPO_NAME = 'promptfoo/promptfoo';
const CREATION_DATE = '2023-04-28';
const TABLES = ['prod-star-growth', 'staging-star-growth'];

async function queryGitHubArchive() {
  console.log('🔍 Querying GitHub Archive for historical star data...');
  
  // Query GitHub Archive for star events
  const query = `
    SELECT
      JSON_EXTRACT_SCALAR(payload, '$.action') as action,
      JSON_EXTRACT_SCALAR(payload, '$.starred_at') as starred_at,
      JSON_EXTRACT_SCALAR(payload, '$.user.login') as user_login,
      created_at,
      id
    FROM \`githubarchive.day.2023*\`
    WHERE type = 'WatchEvent'
    AND JSON_EXTRACT_SCALAR(payload, '$.action') = 'started'
    AND repo.name = '${REPO_NAME}'
    AND created_at >= '${CREATION_DATE}'
    ORDER BY created_at ASC
  `;

  try {
    console.log('📊 Executing BigQuery...');
    const [rows] = await bigquery.query({ query });
    
    console.log(`✅ Found ${rows.length} star events`);
    
    // Process the data to create cumulative star counts
    const starHistory = processStarEvents(rows);
    
    console.log(`📈 Processed ${starHistory.length} data points`);
    
    // Store the data in DynamoDB
    await storeHistoricalData(starHistory);
    
    console.log('✅ Historical data stored successfully!');
    
  } catch (error) {
    console.error('❌ Error querying GitHub Archive:', error);
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
        console.log(`   ✅ Stored: ${dataPoint.date} - ${dataPoint.count} stars`);
      } catch (error) {
        console.error(`   ❌ Error storing ${dataPoint.date}:`, error.message);
      }
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
  
  // Query and store historical data
  await queryGitHubArchive();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check data after import
  await checkCurrentData();
}

// Run the script
main().catch(console.error); 