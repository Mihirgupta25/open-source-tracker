#!/usr/bin/env node

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REPO_NAME = 'promptfoo/promptfoo';

async function getStagingData() {
  console.log('📊 Getting staging data...');
  
  try {
    const params = {
      TableName: 'staging-star-growth',
      KeyConditionExpression: 'repo = :repo',
      ExpressionAttributeValues: {
        ':repo': REPO_NAME
      },
      ScanIndexForward: true
    };
    
    const result = await dynamodb.query(params).promise();
    console.log(`   Found ${result.Items.length} entries in staging`);
    
    return result.Items;
  } catch (error) {
    console.error('❌ Error getting staging data:', error.message);
    return [];
  }
}

async function getProdData() {
  console.log('📊 Getting current production data...');
  
  try {
    const params = {
      TableName: 'prod-star-growth',
      KeyConditionExpression: 'repo = :repo',
      ExpressionAttributeValues: {
        ':repo': REPO_NAME
      },
      ScanIndexForward: true
    };
    
    const result = await dynamodb.query(params).promise();
    console.log(`   Found ${result.Items.length} entries in production`);
    
    return result.Items;
  } catch (error) {
    console.error('❌ Error getting production data:', error.message);
    return [];
  }
}

async function clearProdData() {
  console.log('🗑️  Clearing production data...');
  
  try {
    const params = {
      TableName: 'prod-star-growth',
      KeyConditionExpression: 'repo = :repo',
      ExpressionAttributeValues: {
        ':repo': REPO_NAME
      }
    };
    
    const result = await dynamodb.query(params).promise();
    console.log(`   Found ${result.Items.length} items to delete`);
    
    if (result.Items.length === 0) {
      console.log('   No items to delete');
      return;
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
          'prod-star-growth': deleteRequests
        }
      }).promise();
      
      console.log(`   Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(result.Items.length / batchSize)}`);
    }
    
  } catch (error) {
    console.error('❌ Error clearing production data:', error.message);
  }
}

async function copyStagingToProd(stagingData) {
  console.log('💾 Copying staging data to production...');
  
  let storedCount = 0;
  for (const item of stagingData) {
    const params = {
      TableName: 'prod-star-growth',
      Item: {
        repo: item.repo,
        timestamp: item.timestamp,
        displayTimestamp: item.displayTimestamp,
        count: item.count
      }
    };
    
    try {
      await dynamodb.put(params).promise();
      storedCount++;
      if (storedCount % 20 === 0) {
        console.log(`   ✅ Stored ${storedCount}/${stagingData.length} items`);
      }
    } catch (error) {
      console.error(`   ❌ Error storing ${item.timestamp}:`, error.message);
    }
  }
  
  console.log(`   ✅ Completed: ${storedCount} items copied to production`);
}

async function checkDataAfterRestore() {
  console.log('📊 Checking data after restore...');
  
  try {
    const params = {
      TableName: 'prod-star-growth',
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
      
      // Show some sample data points
      console.log(`   Sample data points:`);
      const sampleSize = Math.min(5, result.Items.length);
      for (let i = 0; i < sampleSize; i++) {
        const item = result.Items[i];
        console.log(`     ${item.timestamp} - ${item.count} stars`);
      }
      
      if (result.Items.length > 5) {
        console.log(`     ... and ${result.Items.length - 5} more entries`);
      }
    }
    
  } catch (error) {
    console.error(`   ❌ Error querying production:`, error.message);
  }
}

async function main() {
  console.log('🚀 Restore Production from Staging');
  console.log('===================================\n');
  
  // Get current production data
  const prodData = await getProdData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Get staging data
  const stagingData = await getStagingData();
  
  if (stagingData.length === 0) {
    console.log('❌ No staging data found');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  console.log('⚠️  This will replace all production data with staging data.');
  console.log('📊 Staging data points:', stagingData.length);
  console.log('📊 Production data points:', prodData.length);
  console.log('📅 Date range:', stagingData[0]?.timestamp, 'to', stagingData[stagingData.length - 1]?.timestamp);
  console.log('⭐ Final stars:', stagingData[stagingData.length - 1]?.count);
  
  // Clear production data
  await clearProdData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Copy staging data to production
  await copyStagingToProd(stagingData);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check data after restore
  await checkDataAfterRestore();
  
  console.log('\n✅ Production data restoration completed!');
  console.log('\n💡 Production now has the complete historical data from staging.');
  console.log('   This includes all data from April 2023 to August 2025.');
}

// Run the script
main().catch(console.error); 