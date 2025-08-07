#!/usr/bin/env node

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLES = ['prod-star-growth', 'staging-star-growth'];

// Daily data points for crewAI based on the graph
const dailyData = [
  { date: '2025-08-01', stars: 35130 },
  { date: '2025-08-02', stars: 35140 },
  { date: '2025-08-03', stars: 35150 },
  { date: '2025-08-04', stars: 35160 },
  { date: '2025-08-05', stars: 35170 },
  { date: '2025-08-06', stars: 35370 }
];

async function addDailyData() {
  console.log('📤 Adding daily data for crewAI...');
  
  for (const tableName of TABLES) {
    console.log(`📊 Adding to ${tableName}...`);
    
    let storedCount = 0;
    for (const dataPoint of dailyData) {
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
          repo: 'crewAI',
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
    
    console.log(`   ✅ Completed: ${storedCount} daily data points stored in ${tableName}`);
  }
}

async function checkCrewAIData() {
  console.log('📊 Checking crewAI data in DynamoDB...');
  
  for (const tableName of TABLES) {
    console.log(`\n📋 ${tableName}:`);
    
    try {
      const params = {
        TableName: tableName,
        KeyConditionExpression: 'repo = :repo',
        ExpressionAttributeValues: {
          ':repo': 'crewAI'
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
  console.log('🚀 Add Daily CrewAI Data');
  console.log('=========================\n');
  
  // Check current crewAI data
  await checkCrewAIData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Add daily data
  await addDailyData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check data after adding
  await checkCrewAIData();
  
  console.log('\n✅ Daily crewAI data added!');
  console.log('\n💡 The graph should now show the daily data points.');
}

// Run the script
main().catch(console.error); 