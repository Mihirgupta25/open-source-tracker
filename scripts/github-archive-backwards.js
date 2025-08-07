#!/usr/bin/env node

const AWS = require('aws-sdk');
const { BigQuery } = require('@google-cloud/bigquery');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REPO_NAME = 'promptfoo/promptfoo';
const TABLES = ['prod-star-growth', 'staging-star-growth'];

// BigQuery configuration
const bigquery = new BigQuery({
  projectId: 'open-source-tracker-1754516518',
});

async function queryBackwardsFromToday() {
  console.log('🔍 Querying GitHub Archive backwards from today...');
  console.log(`📊 Repository: ${REPO_NAME}`);
  
  // Start from today and go backwards
  const today = new Date();
  const allResults = [];
  let totalBytesProcessed = 0;
  let monthCount = 0;
  
  // Go backwards month by month
  for (let year = today.getFullYear(); year >= 2023; year--) {
    for (let month = 12; month >= 1; month--) {
      // Skip future months
      if (year === today.getFullYear() && month > today.getMonth() + 1) {
        continue;
      }
      // Skip months before repository creation (April 2023)
      if (year === 2023 && month < 4) {
        continue;
      }
      
      const monthStr = month.toString().padStart(2, '0');
      const tableName = `githubarchive.day.${year}${monthStr}`;
      
      console.log(`📅 Querying ${year}-${monthStr}... (month ${++monthCount})`);
      
      const query = `
        SELECT
          DATE(created_at) as date,
          COUNT(*) as daily_stars
        FROM \`${tableName}\`
        WHERE type = 'WatchEvent'
        AND JSON_EXTRACT_SCALAR(payload, '$.action') = 'started'
        AND repo.name = '${REPO_NAME}'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;
      
      try {
        const [job] = await bigquery.createQueryJob({
          query: query,
          useLegacySql: false,
        });
        
        const [rows] = await job.getQueryResults();
        
        // Get job statistics
        const metadata = job.metadata;
        const stats = metadata.statistics;
        const bytesProcessed = parseInt(stats.totalBytesProcessed);
        totalBytesProcessed += bytesProcessed;
        
        console.log(`   ✅ Found ${rows.length} days with star events`);
        console.log(`   📊 Bytes processed: ${(bytesProcessed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   💰 Total bytes so far: ${(totalBytesProcessed / 1024 / 1024 / 1024).toFixed(3)} GB`);
        
        if (rows.length > 0) {
          allResults.push(...rows);
        }
        
        // Check if we're approaching free tier limit (1 TB = 1,073,741,824 bytes)
        const freeTierLimit = 1024 * 1024 * 1024; // 1 GB for testing
        if (totalBytesProcessed > freeTierLimit) {
          console.log(`⚠️  Approaching free tier limit (${(freeTierLimit / 1024 / 1024 / 1024).toFixed(1)} GB)`);
          console.log('🛑 Stopping to avoid costs');
          break;
        }
        
        // Add a small delay between queries
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`   ❌ Error querying ${year}-${monthStr}:`, error.message);
        
        if (error.message.includes('quota') || error.message.includes('limit')) {
          console.log('🛑 Hit quota limit, stopping');
          break;
        }
        
        if (error.message.includes('Not found')) {
          console.log('   ⚠️  Table not found, skipping');
          continue;
        }
      }
    }
    
    // Check if we should stop after this year
    if (totalBytesProcessed > 1024 * 1024 * 1024) {
      break;
    }
  }
  
  console.log(`\n📈 Query Summary:`);
  console.log(`   Total months queried: ${monthCount}`);
  console.log(`   Total bytes processed: ${(totalBytesProcessed / 1024 / 1024 / 1024).toFixed(3)} GB`);
  console.log(`   Total daily records found: ${allResults.length}`);
  console.log(`   Estimated cost: $${(totalBytesProcessed / 1024 / 1024 / 1024 / 1024 * 5).toFixed(4)}`);
  
  if (allResults.length === 0) {
    console.log('⚠️  No star events found. This could mean:');
    console.log('   - Repository is private');
    console.log('   - Repository has no stars');
    console.log('   - Data not available in GitHub Archive');
    console.log('   - Hit BigQuery quota limits');
    return [];
  }
  
  // Process the data to create cumulative counts
  const processedData = processBackwardsData(allResults);
  
  console.log(`📈 Processed ${processedData.length} data points`);
  
  return processedData;
}

function processBackwardsData(dailyResults) {
  console.log('🔄 Processing daily data into cumulative counts...');
  
  // Sort by date
  dailyResults.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const processedData = [];
  let cumulativeStars = 0;
  let currentDate = null;
  
  dailyResults.forEach(day => {
    const date = new Date(day.date);
    const dateKey = date.toISOString().split('T')[0];
    
    if (dateKey !== currentDate) {
      if (currentDate !== null) {
        // Store the previous day's data
        processedData.push({
          date: currentDate,
          timestamp: new Date(currentDate + 'T00:00:00Z').toISOString(),
          count: cumulativeStars
        });
      }
      currentDate = dateKey;
    }
    
    cumulativeStars += parseInt(day.daily_stars) || 0;
  });
  
  // Add the last day if we have data
  if (currentDate !== null) {
    processedData.push({
      date: currentDate,
      timestamp: new Date(currentDate + 'T00:00:00Z').toISOString(),
      count: cumulativeStars
    });
  }
  
  return processedData;
}

async function storeBackwardsData(processedData) {
  console.log('💾 Storing backwards data in DynamoDB...');
  
  for (const tableName of TABLES) {
    console.log(`📊 Storing in ${tableName}...`);
    
    let storedCount = 0;
    for (const dataPoint of processedData) {
      const params = {
        TableName: tableName,
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
        if (storedCount % 10 === 0) {
          console.log(`   ✅ Stored ${storedCount}/${processedData.length} data points`);
        }
      } catch (error) {
        console.error(`   ❌ Error storing ${dataPoint.date}:`, error.message);
      }
    }
    console.log(`   ✅ Completed: ${storedCount} data points stored in ${tableName}`);
  }
}

async function clearExistingData() {
  console.log('🗑️  Clearing existing data...');
  
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
      }
      
    } catch (error) {
      console.error(`   ❌ Error querying ${tableName}:`, error.message);
    }
  }
}

async function main() {
  console.log('🚀 GitHub Archive Backwards Query');
  console.log('==================================\n');
  
  // Check current data first
  await checkCurrentData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Query backwards from today
  const backwardsData = await queryBackwardsFromToday();
  
  if (backwardsData.length === 0) {
    console.log('❌ No backwards data found');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  console.log('⚠️  This will replace existing star data with real historical data from GitHub Archive.');
  console.log('📊 Historical data points:', backwardsData.length);
  console.log('📅 Date range:', backwardsData[0]?.date, 'to', backwardsData[backwardsData.length - 1]?.date);
  console.log('⭐ Final stars:', backwardsData[backwardsData.length - 1]?.count);
  
  // Clear existing data
  await clearExistingData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Store backwards data
  await storeBackwardsData(backwardsData);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check data after import
  await checkCurrentData();
  
  console.log('\n✅ Backwards data import completed!');
  console.log('\n💡 This data comes from GitHub Archive, showing real historical star events.');
  console.log('   The query stopped when approaching free tier limits to avoid costs.');
}

// Run the script
main().catch(console.error); 