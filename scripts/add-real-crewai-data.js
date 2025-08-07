#!/usr/bin/env node

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

async function addRealCrewAIData() {
  console.log('📤 Adding real crewAIInc/crewAI data to staging...');
  
  // The 16 real data points from the image
  const realData = [
    { date: '2023-11-14T16:23:29.000Z', stars: 0 },
    { date: '2024-01-17T00:00:00.000Z', stars: 4650 },
    { date: '2024-02-13T00:00:00.000Z', stars: 7020 },
    { date: '2024-03-18T00:00:00.000Z', stars: 9390 },
    { date: '2024-04-19T00:00:00.000Z', stars: 11730 },
    { date: '2024-05-21T00:00:00.000Z', stars: 14100 },
    { date: '2024-07-05T00:00:00.000Z', stars: 16470 },
    { date: '2024-09-16T00:00:00.000Z', stars: 18810 },
    { date: '2024-11-23T00:00:00.000Z', stars: 21180 },
    { date: '2025-01-04T00:00:00.000Z', stars: 23550 },
    { date: '2025-02-09T00:00:00.000Z', stars: 25890 },
    { date: '2025-03-17T00:00:00.000Z', stars: 28260 },
    { date: '2025-05-01T00:00:00.000Z', stars: 30630 },
    { date: '2025-06-18T00:00:00.000Z', stars: 32970 },
    { date: '2025-08-06T08:42:30.000Z', stars: 35340 },
    { date: '2025-08-06T23:06:21.000Z', stars: 35379 }
  ];
  
  console.log(`📊 Adding to staging-star-growth...`);
  
  let storedCount = 0;
  for (const dataPoint of realData) {
    const timestamp = dataPoint.date;
    const displayTimestamp = new Date(dataPoint.date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'America/Los_Angeles'
    });
    
    const params = {
      TableName: 'staging-star-growth',
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
  
  console.log(`   ✅ Completed: ${storedCount} real data points stored in staging-star-growth`);
}

async function checkStagingData() {
  console.log('📊 Checking staging crewAIInc/crewAI data...');
  
  try {
    const params = {
      TableName: 'staging-star-growth',
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
      
      console.log(`   All data points:`);
      result.Items.forEach(item => {
        const date = new Date(item.timestamp).toISOString().split('T')[0];
        console.log(`     ${date}: ${item.count} stars`);
      });
    }
    
  } catch (error) {
    console.error(`   ❌ Error querying staging-star-growth:`, error.message);
  }
}

async function main() {
  console.log('🚀 Add Real CrewAI Data to Staging');
  console.log('====================================\n');
  
  // Add real data
  await addRealCrewAIData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check staging data
  await checkStagingData();
  
  console.log('\n✅ Real crewAI data added to staging!');
  console.log('\n💡 The staging graph should now show all 16 real data points.');
}

// Run the script
main().catch(console.error); 