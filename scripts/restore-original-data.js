#!/usr/bin/env node

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REPO_NAME = 'promptfoo/promptfoo';
const TABLES = ['prod-star-growth', 'staging-star-growth'];

async function clearSyntheticData() {
  console.log('🗑️  Clearing synthetic data...');
  
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

async function triggerDataCollection() {
  console.log('🔄 Triggering fresh data collection...');
  
  try {
    // Trigger the unified collector to get fresh data
    const lambda = new AWS.Lambda();
    
    const params = {
      FunctionName: 'OpenSourceTrackerProdV2-UnifiedCollector545FE1D7-AFzQhaJXo8iV',
      InvocationType: 'Event',
      Payload: JSON.stringify({
        source: 'manual-trigger',
        detail: {
          repos: [REPO_NAME]
        }
      })
    };
    
    await lambda.invoke(params).promise();
    console.log('✅ Triggered data collection for production');
    
    // Also trigger staging if it exists
    try {
      const stagingParams = {
        FunctionName: 'OpenSourceTrackerStagingV2-UnifiedCollector545FE1D7-AFzQhaJXo8iV',
        InvocationType: 'Event',
        Payload: JSON.stringify({
          source: 'manual-trigger',
          detail: {
            repos: [REPO_NAME]
          }
        })
      };
      
      await lambda.invoke(stagingParams).promise();
      console.log('✅ Triggered data collection for staging');
    } catch (error) {
      console.log('⚠️  Could not trigger staging collection (function may not exist)');
    }
    
  } catch (error) {
    console.error('❌ Error triggering data collection:', error.message);
  }
}

async function checkDataAfterRestore() {
  console.log('\n📊 Checking data after restore...');
  
  // Wait a bit for the collection to complete
  console.log('⏳ Waiting 30 seconds for data collection to complete...');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
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
  console.log('🔄 Restoring Original Data');
  console.log('==========================\n');
  
  console.log('⚠️  This will:');
  console.log('   1. Clear all synthetic data from the import scripts');
  console.log('   2. Trigger fresh data collection from the actual system');
  console.log('   3. Restore real-time data collection');
  
  // Clear synthetic data
  await clearSyntheticData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Trigger fresh data collection
  await triggerDataCollection();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check the restored data
  await checkDataAfterRestore();
  
  console.log('\n✅ Data restoration process completed!');
  console.log('\n💡 The system will now collect fresh, accurate data.');
  console.log('   Check the application in a few minutes to see the updated data.');
}

// Run the script
main().catch(console.error); 