#!/usr/bin/env node

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REPO_NAME = 'promptfoo/promptfoo';
const TABLES = ['prod-star-growth', 'staging-star-growth'];

// Historical data from the image
const historicalData = [
  { date: '2023-04-29', stars: 0 },
  { date: '2023-09-22', stars: 990 },
  { date: '2023-12-20', stars: 1530 },
  { date: '2024-03-13', stars: 2040 },
  { date: '2024-04-23', stars: 2580 },
  { date: '2024-06-03', stars: 3090 },
  { date: '2024-07-26', stars: 3630 },
  { date: '2024-09-17', stars: 4140 },
  { date: '2024-11-15', stars: 4680 },
  { date: '2025-01-23', stars: 5190 },
  { date: '2025-03-10', stars: 5730 },
  { date: '2025-04-23', stars: 6240 },
  { date: '2025-05-31', stars: 6780 },
  { date: '2025-06-24', stars: 7290 },
  { date: '2025-08-03', stars: 7830 },
  { date: '2025-08-06', stars: 7874 }
];

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
      console.log(`   Found ${result.Items.length} items to delete`);
      
      if (result.Items.length === 0) {
        console.log('   No items to delete');
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

async function uploadHistoricalData() {
  console.log('📤 Uploading historical data...');
  
  for (const tableName of TABLES) {
    console.log(`📊 Uploading to ${tableName}...`);
    
    let storedCount = 0;
    for (const dataPoint of historicalData) {
      const timestamp = new Date(dataPoint.date + 'T00:00:00Z').toISOString();
      const displayTimestamp = new Date(dataPoint.date + 'T00:00:00Z').toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/Los_Angeles'
      });
      
      const params = {
        TableName: tableName,
        Item: {
          repo: REPO_NAME,
          timestamp: timestamp,
          displayTimestamp: displayTimestamp,
          count: dataPoint.stars
        }
      };
      
      try {
        await dynamodb.put(params).promise();
        storedCount++;
        console.log(`   ✅ ${dataPoint.date}: ${dataPoint.stars} stars`);
      } catch (error) {
        console.error(`   ❌ Error storing ${dataPoint.date}:`, error.message);
      }
    }
    
    console.log(`   ✅ Completed: ${storedCount} data points stored in ${tableName}`);
  }
}

async function checkDataAfterUpload() {
  console.log('📊 Checking data after upload...');
  
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
        
        // Show all data points
        console.log(`   All data points:`);
        result.Items.forEach(item => {
          const date = new Date(item.timestamp).toISOString().split('T')[0];
          console.log(`     ${date}: ${item.count} stars`);
        });
      }
      
    } catch (error) {
      console.error(`   ❌ Error querying ${tableName}:`, error.message);
    }
  }
}

async function main() {
  console.log('🚀 Upload Historical Star Growth Data');
  console.log('=====================================\n');
  
  console.log('📊 Historical data points to upload:');
  historicalData.forEach(point => {
    console.log(`   ${point.date}: ${point.stars} stars`);
  });
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Clear existing data
  await clearExistingData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Upload historical data
  await uploadHistoricalData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check data after upload
  await checkDataAfterUpload();
  
  console.log('\n✅ Historical data upload completed!');
  console.log('\n💡 Both tables now contain the complete historical star growth data.');
  console.log('   Data spans from April 29, 2023 to August 6, 2025.');
}

// Run the script
main().catch(console.error); 