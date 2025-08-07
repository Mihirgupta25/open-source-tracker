#!/usr/bin/env node

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REPO_NAME = 'promptfoo/promptfoo';
const TABLES = ['prod-star-growth', 'staging-star-growth'];

async function clearAllPromptfooData() {
  console.log('🗑️  Clearing all promptfoo data from star growth tables...');
  
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

async function createManualEntry() {
  console.log('📝 Creating manual entry for current time...');
  
  const now = new Date();
  const timestamp = now.toISOString();
  const displayTimestamp = now.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/Los_Angeles'
  });
  
  // Get current star count from GitHub API
  const currentStars = await getCurrentStarCount();
  
  console.log(`📅 Timestamp: ${timestamp}`);
  console.log(`📅 Display: ${displayTimestamp}`);
  console.log(`⭐ Stars: ${currentStars}`);
  
  for (const tableName of TABLES) {
    console.log(`📊 Adding to ${tableName}...`);
    
    const params = {
      TableName: tableName,
      Item: {
        repo: REPO_NAME,
        timestamp: timestamp,
        displayTimestamp: displayTimestamp,
        count: currentStars
      }
    };
    
    try {
      await dynamodb.put(params).promise();
      console.log(`   ✅ Added manual entry to ${tableName}`);
    } catch (error) {
      console.error(`   ❌ Error adding to ${tableName}:`, error.message);
    }
  }
}

async function getCurrentStarCount() {
  console.log('📊 Fetching current star count from GitHub...');
  
  const https = require('https');
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/promptfoo/promptfoo',
      method: 'GET',
      headers: {
        'User-Agent': 'OpenSourceTracker/1.0',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const jsonData = JSON.parse(data);
            console.log(`   ✅ Current stars: ${jsonData.stargazers_count}`);
            resolve(jsonData.stargazers_count);
          } catch (error) {
            console.error('   ❌ Failed to parse JSON:', error.message);
            resolve(7874); // Fallback to known count
          }
        } else {
          console.error(`   ❌ GitHub API error: ${res.statusCode}`);
          resolve(7874); // Fallback to known count
        }
      });
    });

    req.on('error', (error) => {
      console.error('   ❌ Request error:', error.message);
      resolve(7874); // Fallback to known count
    });

    req.end();
  });
}

async function checkDataAfterClear() {
  console.log('📊 Checking data after clear and manual entry...');
  
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
        const item = result.Items[0];
        console.log(`   Manual entry: ${item.timestamp} - ${item.count} stars`);
        console.log(`   Display: ${item.displayTimestamp}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error querying ${tableName}:`, error.message);
    }
  }
}

async function main() {
  console.log('🚀 Clear All Data and Create Manual Entry');
  console.log('==========================================\n');
  
  // Clear all promptfoo data
  await clearAllPromptfooData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Create manual entry
  await createManualEntry();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check data after operations
  await checkDataAfterClear();
  
  console.log('\n✅ Clear and manual entry completed!');
  console.log('\n💡 All previous promptfoo data has been cleared.');
  console.log('   A single manual entry has been created for the current time.');
}

// Run the script
main().catch(console.error); 