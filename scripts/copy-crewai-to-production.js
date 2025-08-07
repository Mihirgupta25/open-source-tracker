#!/usr/bin/env node

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

async function copyCrewAIDataToProduction() {
  console.log('📤 Copying crewAIInc/crewAI data from staging to production...');
  
  try {
    // Get all crewAI data from staging
    const stagingParams = {
      TableName: 'staging-star-growth',
      KeyConditionExpression: 'repo = :repo',
      ExpressionAttributeValues: {
        ':repo': 'crewAIInc/crewAI'
      }
    };
    
    const stagingResult = await dynamodb.query(stagingParams).promise();
    console.log(`📊 Found ${stagingResult.Items.length} data points in staging`);
    
    if (stagingResult.Items.length === 0) {
      console.log('❌ No crewAI data found in staging database');
      return;
    }
    
    // Copy each item to production
    let copiedCount = 0;
    for (const item of stagingResult.Items) {
      const productionParams = {
        TableName: 'prod-star-growth',
        Item: {
          repo: item.repo,
          timestamp: item.timestamp,
          displayTimestamp: item.displayTimestamp,
          count: item.count
        }
      };
      
      try {
        await dynamodb.put(productionParams).promise();
        copiedCount++;
        console.log(`   ✅ Copied: ${item.timestamp} - ${item.count} stars`);
      } catch (error) {
        console.error(`   ❌ Error copying ${item.timestamp}:`, error.message);
      }
    }
    
    console.log(`\n✅ Successfully copied ${copiedCount} data points to production`);
    
    // Verify the copy
    const productionParams = {
      TableName: 'prod-star-growth',
      KeyConditionExpression: 'repo = :repo',
      ExpressionAttributeValues: {
        ':repo': 'crewAIInc/crewAI'
      }
    };
    
    const productionResult = await dynamodb.query(productionParams).promise();
    console.log(`📊 Production now has ${productionResult.Items.length} crewAI data points`);
    
    if (productionResult.Items.length > 0) {
      const first = productionResult.Items[0];
      const last = productionResult.Items[productionResult.Items.length - 1];
      console.log(`   First: ${first.timestamp} - ${first.count} stars`);
      console.log(`   Last: ${last.timestamp} - ${last.count} stars`);
    }
    
  } catch (error) {
    console.error('❌ Error copying data:', error.message);
  }
}

async function main() {
  console.log('🚀 Copy CrewAI Data to Production');
  console.log('==================================\n');
  
  await copyCrewAIDataToProduction();
  
  console.log('\n💡 The graph should now show all existing crewAI data points.');
}

// Run the script
main().catch(console.error); 