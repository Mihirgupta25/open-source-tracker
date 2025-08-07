#!/usr/bin/env node

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REPO_NAME = 'promptfoo/promptfoo';
const TABLES = ['prod-star-growth', 'staging-star-growth'];

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
      console.error(`   ❌ Error querying ${tableName}:`, error.message);
    }
  }
}

// Run the script
checkCurrentData().catch(console.error); 