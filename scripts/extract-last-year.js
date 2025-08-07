#!/usr/bin/env node

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REPO_NAME = 'promptfoo/promptfoo';
const TABLES = ['prod-star-growth', 'staging-star-growth'];

async function extractLastYearData() {
  console.log('🔍 Extracting last year of data from existing dataset...');
  console.log(`📊 Repository: ${REPO_NAME}`);
  
  // Calculate date range for last year
  const today = new Date();
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  
  console.log(`📅 Date range: ${oneYearAgo.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`);
  
  for (const tableName of TABLES) {
    console.log(`\n📊 Processing ${tableName}...`);
    
    try {
      // Get all items for the repo
      const params = {
        TableName: tableName,
        KeyConditionExpression: 'repo = :repo',
        ExpressionAttributeValues: {
          ':repo': REPO_NAME
        },
        ScanIndexForward: true
      };
      
      const result = await dynamodb.query(params).promise();
      console.log(`   Found ${result.Items.length} total entries`);
      
      if (result.Items.length === 0) {
        console.log('   No existing data found');
        continue;
      }
      
      // Filter for last year data
      const lastYearData = result.Items.filter(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate >= oneYearAgo;
      });
      
      console.log(`   Found ${lastYearData.length} entries from the last year`);
      
      if (lastYearData.length === 0) {
        console.log('   No data from the last year found');
        continue;
      }
      
      // Clear existing data
      console.log('   🗑️  Clearing existing data...');
      
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
      
      // Store only last year data
      console.log('   💾 Storing last year data...');
      
      let storedCount = 0;
      for (const dataPoint of lastYearData) {
        const params = {
          TableName: tableName,
          Item: dataPoint
        };
        
        try {
          await dynamodb.put(params).promise();
          storedCount++;
          if (storedCount % 10 === 0) {
            console.log(`     ✅ Stored ${storedCount}/${lastYearData.length} data points`);
          }
        } catch (error) {
          console.error(`     ❌ Error storing ${dataPoint.timestamp}:`, error.message);
        }
      }
      
      console.log(`   ✅ Completed: ${storedCount} last year data points stored in ${tableName}`);
      
      // Show summary
      if (lastYearData.length > 0) {
        const first = lastYearData[0];
        const last = lastYearData[lastYearData.length - 1];
        console.log(`   📈 First: ${first.timestamp} - ${first.count} stars`);
        console.log(`   📈 Last: ${last.timestamp} - ${last.count} stars`);
        console.log(`   📈 Growth: ${last.count - first.count} stars in the last year`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error processing ${tableName}:`, error.message);
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

async function main() {
  console.log('🚀 Extract Last Year Data');
  console.log('==========================\n');
  
  // Check current data first
  await checkCurrentData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Extract last year data
  await extractLastYearData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check data after extraction
  await checkCurrentData();
  
  console.log('\n✅ Last year data extraction completed!');
  console.log('\n💡 This data shows the last year of star growth from your existing dataset.');
  console.log('   The data is now focused on the most recent year for better visualization.');
}

// Run the script
main().catch(console.error); 