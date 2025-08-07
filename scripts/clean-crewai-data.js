#!/usr/bin/env node

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLES = ['prod-star-growth', 'staging-star-growth'];

async function clearCrewAIIncData() {
  console.log('🗑️  Clearing existing crewAIInc/crewAI data...');
  
  for (const tableName of TABLES) {
    console.log(`📊 Clearing ${tableName}...`);
    
    try {
      // Get all items for crewAIInc/crewAI
      const params = {
        TableName: tableName,
        KeyConditionExpression: 'repo = :repo',
        ExpressionAttributeValues: {
          ':repo': 'crewAIInc/crewAI'
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

async function addCleanCrewAIIncData() {
  console.log('📤 Adding clean crewAIInc/crewAI data...');
  
  // Clean daily data points for crewAIInc/crewAI - one per day
  const cleanData = [
    { date: '2025-08-01', stars: 35130 },
    { date: '2025-08-02', stars: 35140 },
    { date: '2025-08-03', stars: 35220 },
    { date: '2025-08-04', stars: 35160 },
    { date: '2025-08-05', stars: 35170 },
    { date: '2025-08-06', stars: 35370 }
  ];
  
  for (const tableName of TABLES) {
    console.log(`📊 Adding to ${tableName}...`);
    
    let storedCount = 0;
    for (const dataPoint of cleanData) {
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
          repo: 'crewAIInc/crewAI',
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
    
    console.log(`   ✅ Completed: ${storedCount} clean data points stored in ${tableName}`);
  }
}

async function checkCleanData() {
  console.log('📊 Checking clean crewAIInc/crewAI data...');
  
  for (const tableName of TABLES) {
    console.log(`\n📋 ${tableName}:`);
    
    try {
      const params = {
        TableName: tableName,
        KeyConditionExpression: 'repo = :repo',
        ExpressionAttributeValues: {
          ':repo': 'crewAIInc/crewAI'
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
  console.log('🚀 Clean CrewAI Data');
  console.log('====================\n');
  
  // Clear existing data
  await clearCrewAIIncData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Add clean data
  await addCleanCrewAIIncData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check clean data
  await checkCleanData();
  
  console.log('\n✅ Clean crewAI data added!');
  console.log('\n💡 The graph should now show a clean timeline without duplicates.');
}

// Run the script
main().catch(console.error); 