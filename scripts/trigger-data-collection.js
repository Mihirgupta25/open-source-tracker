#!/usr/bin/env node

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const lambda = new AWS.Lambda();

async function triggerUnifiedCollection() {
  console.log('🔄 Triggering unified data collection...');
  
  try {
    // Send an EventBridge-style event to trigger unified collection
    const params = {
      FunctionName: 'OpenSourceTrackerProdV2-UnifiedCollector545FE1D7-AFzQhaJXo8iV',
      InvocationType: 'Event',
      Payload: JSON.stringify({
        source: 'aws.events',
        'detail-type': 'Scheduled Event',
        detail: {}
      })
    };
    
    await lambda.invoke(params).promise();
    console.log('✅ Triggered unified collection for production');
    
    // Also try staging
    try {
      const stagingParams = {
        FunctionName: 'OpenSourceTrackerStagingV2-UnifiedCollector545FE1D7-AFzQhaJXo8iV',
        InvocationType: 'Event',
        Payload: JSON.stringify({
          source: 'aws.events',
          'detail-type': 'Scheduled Event',
          detail: {}
        })
      };
      
      await lambda.invoke(stagingParams).promise();
      console.log('✅ Triggered unified collection for staging');
    } catch (error) {
      console.log('⚠️  Could not trigger staging collection (function may not exist)');
    }
    
  } catch (error) {
    console.error('❌ Error triggering data collection:', error.message);
  }
}

async function checkDataAfterTrigger() {
  console.log('\n📊 Checking data after trigger...');
  
  // Wait for collection to complete
  console.log('⏳ Waiting 60 seconds for data collection to complete...');
  await new Promise(resolve => setTimeout(resolve, 60000));
  
  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });
  const dynamodb = new AWS.DynamoDB.DocumentClient();
  
  const REPO_NAME = 'promptfoo/promptfoo';
  const TABLES = ['prod-star-growth', 'staging-star-growth'];
  
  for (const tableName of TABLES) {
    console.log(`\n📋 ${tableName}:`);
    
    try {
      const params = {
        TableName: tableName,
        KeyConditionExpression: 'repo = :repo',
        ExpressionAttributeValues: {
          ':repo': REPO_NAME
        },
        ScanIndexForward: false,
        Limit: 10
      };
      
      const result = await dynamodb.query(params).promise();
      console.log(`   Total entries: ${result.Items.length}`);
      
      if (result.Items.length > 0) {
        console.log('   Recent entries:');
        result.Items.forEach(item => {
          console.log(`     ${item.timestamp} - ${item.count} stars`);
        });
      }
      
    } catch (error) {
      console.error(`   ❌ Error querying ${tableName}:`, error.message);
    }
  }
}

async function main() {
  console.log('🚀 Triggering Data Collection');
  console.log('==============================\n');
  
  // Trigger the collection
  await triggerUnifiedCollection();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check the results
  await checkDataAfterTrigger();
  
  console.log('\n✅ Data collection process completed!');
  console.log('\n💡 Check the application to see the updated data.');
}

// Run the script
main().catch(console.error); 