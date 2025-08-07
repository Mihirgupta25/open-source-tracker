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

async function queryMonthlyStarData() {
  console.log('🔍 Querying GitHub Archive for monthly star data...');
  console.log(`📊 Repository: ${REPO_NAME}`);
  
  // Try different table patterns for GitHub Archive
  const tablePatterns = [
    'githubarchive.githubarchive.month_*',
    'githubarchive.month_*',
    'bigquery-public-data.githubarchive.month_*'
  ];
  
  for (const pattern of tablePatterns) {
    console.log(`\n🔍 Trying pattern: ${pattern}`);
    
    const query = `
      SELECT
        DATE_TRUNC(DATE(created_at), WEEK(MONDAY)) AS week_start,
        COUNT(*) AS stars_gained
      FROM \`${pattern}\`
      WHERE
        _TABLE_SUFFIX BETWEEN '202304' AND FORMAT_DATE('%Y%m', CURRENT_DATE())
        AND type = 'WatchEvent'
        AND JSON_EXTRACT_SCALAR(payload, '$.action') = 'started'
        AND repo.name = '${REPO_NAME}'
      GROUP BY week_start
      ORDER BY week_start
    `;
    
    try {
      console.log('📊 Executing BigQuery query...');
      console.log('⏳ This may take a few minutes for large datasets...');
      
      const [job] = await bigquery.createQueryJob({
        query: query,
        useLegacySql: false,
      });
      
      const [rows] = await job.getQueryResults();
      
      // Get job statistics
      const metadata = job.metadata;
      const stats = metadata.statistics;
      const bytesProcessed = parseInt(stats.totalBytesProcessed);
      
      console.log(`\n📈 Query Results:`);
      console.log(`   Found ${rows.length} weeks with star events`);
      console.log(`   Bytes processed: ${(bytesProcessed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   Estimated cost: $${(bytesProcessed / 1024 / 1024 / 1024 / 1024 * 5).toFixed(4)}`);
      
      if (rows.length === 0) {
        console.log('⚠️  No star events found with this pattern');
        continue;
      }
      
      // Show sample data
      console.log('\n📋 Sample data:');
      rows.slice(0, 10).forEach(row => {
        console.log(`   ${row.week_start}: ${row.stars_gained} stars gained`);
      });
      
      if (rows.length > 10) {
        console.log(`   ... and ${rows.length - 10} more weeks`);
      }
      
      return rows;
      
    } catch (error) {
      console.error(`❌ Error with pattern ${pattern}:`, error.message);
      
      if (error.message.includes('quota')) {
        console.log('💡 Try enabling billing for BigQuery to avoid quota limits');
        return [];
      }
      
      if (error.message.includes('Not found') || error.message.includes('Access Denied')) {
        console.log('💡 Table pattern not accessible, trying next...');
        continue;
      }
    }
  }
  
  console.log('\n❌ All table patterns failed');
  console.log('💡 This could mean:');
  console.log('   - The GitHub Archive dataset structure has changed');
  console.log('   - Recent data is not available in this format');
  console.log('   - The repository has no star events');
  console.log('   - BigQuery quota limits were hit');
  
  return [];
}

function processMonthlyData(weeklyResults) {
  console.log('🔄 Processing weekly data into cumulative counts...');
  
  const processedData = [];
  let cumulativeStars = 0;
  
  weeklyResults.forEach(week => {
    cumulativeStars += parseInt(week.stars_gained) || 0;
    
    processedData.push({
      weekStart: week.week_start,
      timestamp: new Date(week.week_start).toISOString(),
      count: cumulativeStars
    });
  });
  
  console.log(`📈 Processed ${processedData.length} weekly data points`);
  return processedData;
}

async function storeMonthlyData(processedData) {
  console.log('💾 Storing monthly data in DynamoDB...');
  
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
        console.error(`   ❌ Error storing ${dataPoint.weekStart}:`, error.message);
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
  console.log('🚀 GitHub Archive Monthly Star Growth');
  console.log('=====================================\n');
  
  // Check current data first
  await checkCurrentData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Query for monthly data
  const monthlyData = await queryMonthlyStarData();
  
  if (monthlyData.length === 0) {
    console.log('❌ No monthly data found');
    console.log('\n💡 This could mean:');
    console.log('   - The GitHub Archive dataset is not accessible');
    console.log('   - Recent data is not available in this format');
    console.log('   - The repository has no star events');
    console.log('   - BigQuery quota limits were hit');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Process the monthly data
  const processedData = processMonthlyData(monthlyData);
  
  if (processedData.length === 0) {
    console.log('❌ No processed data available');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  console.log('⚠️  This will replace existing star data with monthly data from GitHub Archive.');
  console.log('📊 Monthly data points:', processedData.length);
  console.log('📅 Date range:', processedData[0]?.weekStart, 'to', processedData[processedData.length - 1]?.weekStart);
  console.log('⭐ Final stars:', processedData[processedData.length - 1]?.count);
  
  // Clear existing data
  await clearExistingData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Store monthly data
  await storeMonthlyData(processedData);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check data after import
  await checkCurrentData();
  
  console.log('\n✅ Monthly star growth data import completed!');
  console.log('\n💡 This data comes from GitHub Archive, showing real historical star events.');
  console.log('   The query uses your SQL with corrections for table references.');
}

// Run the script
main().catch(console.error); 