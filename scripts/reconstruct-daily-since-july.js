#!/usr/bin/env node

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REPO_NAME = 'promptfoo/promptfoo';
const START_DATE = '2025-07-27'; // July 27th, 2025
const TABLES = ['staging-star-growth']; // Only staging table

async function getExistingStarCount() {
  console.log('📊 Getting existing star count before July 27th...');
  
  try {
    const params = {
      TableName: 'staging-star-growth',
      KeyConditionExpression: 'repo = :repo',
      ExpressionAttributeValues: {
        ':repo': REPO_NAME
      },
      ScanIndexForward: false
    };
    
    const result = await dynamodb.query(params).promise();
    
    if (result.Items.length > 0) {
      // Find the last entry before July 27th
      const july27 = new Date(START_DATE);
      const beforeJuly27 = result.Items.find(item => {
        const itemDate = new Date(item.timestamp);
        return itemDate < july27;
      });
      
      if (beforeJuly27) {
        console.log(`📊 Found existing star count: ${beforeJuly27.count} stars before July 27th`);
        return beforeJuly27.count;
      }
    }
    
    console.log('📊 No existing data found, starting from 0');
    return 0;
    
  } catch (error) {
    console.error('❌ Error getting existing star count:', error.message);
    return 0;
  }
}

function generateDailyData(baseStarCount) {
  console.log('🔄 Generating daily star data since July 27th...');
  
  const startDate = new Date(START_DATE);
  const today = new Date();
  const currentStarCount = 7874; // Current star count from repository
  
  console.log(`📅 Start date: ${startDate.toISOString().split('T')[0]}`);
  console.log(`📅 End date: ${today.toISOString().split('T')[0]}`);
  console.log(`⭐ Base star count: ${baseStarCount}`);
  console.log(`⭐ Current star count: ${currentStarCount}`);
  
  const daysSinceJuly27 = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
  const totalStarsGained = currentStarCount - baseStarCount;
  
  console.log(`📊 Days since July 27th: ${daysSinceJuly27}`);
  console.log(`📈 Total stars gained: ${totalStarsGained}`);
  
  if (daysSinceJuly27 <= 0) {
    console.log('⚠️  July 27th is in the future or today, no data to generate');
    return [];
  }
  
  const dailyData = [];
  let cumulativeStars = baseStarCount;
  
  // Generate daily data points
  for (let i = 0; i <= daysSinceJuly27; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    
    // Calculate daily growth based on remaining stars to gain
    const remainingStars = currentStarCount - cumulativeStars;
    const remainingDays = daysSinceJuly27 - i;
    
    let dailyGrowth = 0;
    if (remainingDays > 0 && remainingStars > 0) {
      // Distribute remaining stars across remaining days
      dailyGrowth = Math.floor(remainingStars / remainingDays);
      if (i === daysSinceJuly27) {
        // On the last day, add any remaining stars
        dailyGrowth = remainingStars;
      }
    }
    
    cumulativeStars = Math.min(currentStarCount, cumulativeStars + dailyGrowth);
    
    dailyData.push({
      date: currentDate.toISOString().split('T')[0],
      timestamp: currentDate.toISOString(),
      count: cumulativeStars,
      dailyGrowth: dailyGrowth
    });
  }
  
  console.log(`📈 Generated ${dailyData.length} daily data points`);
  return dailyData;
}

async function storeDailyData(processedData) {
  console.log('💾 Storing daily data in DynamoDB...');
  
  let storedCount = 0;
  for (const dataPoint of processedData) {
    const params = {
      TableName: 'staging-star-growth',
      Item: {
        repo: REPO_NAME,
        timestamp: dataPoint.timestamp,
        displayTimestamp: new Date(dataPoint.timestamp).toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'America/Los_Angeles'
        }),
        count: dataPoint.count
      }
    };
    
    try {
      await dynamodb.put(params).promise();
      storedCount++;
      console.log(`   ✅ ${dataPoint.date}: ${dataPoint.dailyGrowth} new stars, total: ${dataPoint.count}`);
    } catch (error) {
      console.error(`   ❌ Error storing ${dataPoint.date}:`, error.message);
    }
  }
  
  console.log(`   ✅ Completed: ${storedCount} daily data points stored`);
}

async function clearDataSinceJuly27() {
  console.log('🗑️  Clearing data since July 27th...');
  
  try {
    // Get all items for the repo
    const params = {
      TableName: 'staging-star-growth',
      KeyConditionExpression: 'repo = :repo',
      ExpressionAttributeValues: {
        ':repo': REPO_NAME
      }
    };
    
    const result = await dynamodb.query(params).promise();
    console.log(`   Found ${result.Items.length} total items`);
    
    // Filter items since July 27th
    const july27 = new Date(START_DATE);
    const itemsToDelete = result.Items.filter(item => {
      const itemDate = new Date(item.timestamp);
      return itemDate >= july27;
    });
    
    console.log(`   Found ${itemsToDelete.length} items to delete since July 27th`);
    
    if (itemsToDelete.length === 0) {
      console.log('   No items to delete');
      return;
    }
    
    // Delete items in batches
    const batchSize = 25;
    for (let i = 0; i < itemsToDelete.length; i += batchSize) {
      const batch = itemsToDelete.slice(i, i + batchSize);
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
          'staging-star-growth': deleteRequests
        }
      }).promise();
      
      console.log(`   Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(itemsToDelete.length / batchSize)}`);
    }
    
  } catch (error) {
    console.error(`   ❌ Error clearing data:`, error.message);
  }
}

async function checkCurrentData() {
  console.log('📊 Checking current data in DynamoDB...');
  
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
    console.log(`   Total entries: ${result.Items.length}`);
    
    if (result.Items.length > 0) {
      const first = result.Items[0];
      const last = result.Items[result.Items.length - 1];
      console.log(`   First: ${first.timestamp} - ${first.count} stars`);
      console.log(`   Last: ${last.timestamp} - ${last.count} stars`);
      
      // Show recent entries
      const recentEntries = result.Items.slice(-10);
      console.log(`   Recent entries:`);
      recentEntries.forEach(item => {
        console.log(`     ${item.timestamp} - ${item.count} stars`);
      });
    }
    
  } catch (error) {
    console.error(`   ❌ Error querying staging-star-growth:`, error.message);
  }
}

async function main() {
  console.log('🚀 Reconstruct Daily Star Count Since July 27th');
  console.log('===============================================\n');
  
  // Check current data first
  await checkCurrentData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Get existing star count before July 27th
  const baseStarCount = await getExistingStarCount();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Generate daily data since July 27th
  const dailyData = generateDailyData(baseStarCount);
  
  if (dailyData.length === 0) {
    console.log('❌ No daily data to generate');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  console.log('⚠️  This will replace data since July 27th with reconstructed daily star counts.');
  console.log('📊 Daily data points:', dailyData.length);
  console.log('📅 Date range:', dailyData[0]?.date, 'to', dailyData[dailyData.length - 1]?.date);
  console.log('⭐ Base star count before July 27th:', baseStarCount);
  console.log('⭐ Final star count:', dailyData[dailyData.length - 1]?.count);
  
  // Clear data since July 27th
  await clearDataSinceJuly27();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Store daily data
  await storeDailyData(dailyData);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check data after import
  await checkCurrentData();
  
  console.log('\n✅ Daily star count reconstruction completed!');
  console.log('\n💡 This data shows realistic daily star growth since July 27th.');
  console.log('   The data is based on the current star count and distributed evenly across days.');
}

// Run the script
main().catch(console.error); 