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

async function queryLastYearData() {
  console.log('🔍 Querying GitHub Archive for last year of star growth...');
  console.log(`📊 Repository: ${REPO_NAME}`);
  
  // Calculate date range for last year
  const today = new Date();
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  
  console.log(`📅 Date range: ${oneYearAgo.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}`);
  
  // Try different table naming patterns
  const tablePatterns = [
    'githubarchive.githubarchive.day',
    'githubarchive.day',
    'bigquery-public-data.githubarchive.day'
  ];
  
  let successfulQuery = null;
  
  for (const pattern of tablePatterns) {
    console.log(`\n🔍 Trying pattern: ${pattern}`);
    
    try {
      // First, let's try to list available tables
      const listQuery = `
        SELECT table_id 
        FROM \`${pattern.replace('.day', '')}.__TABLES__\`
        WHERE table_id >= '20240701'
        ORDER BY table_id DESC 
        LIMIT 5
      `;
      
      console.log('📋 Checking available tables...');
      const [tables] = await bigquery.query({ query: listQuery });
      console.log(`✅ Found ${tables.length} recent tables`);
      
      if (tables.length > 0) {
        console.log('📋 Available tables:');
        tables.forEach(table => console.log(`   - ${table.table_id}`));
        
        // Try to query the most recent table
        const recentTable = tables[0].table_id;
        const testQuery = `
          SELECT
            DATE(created_at) as date,
            COUNT(*) as daily_stars
          FROM \`${pattern}.${recentTable}\`
          WHERE type = 'WatchEvent'
          AND JSON_EXTRACT_SCALAR(payload, '$.action') = 'started'
          AND repo.name = '${REPO_NAME}'
          GROUP BY DATE(created_at)
          ORDER BY date ASC
          LIMIT 10
        `;
        
        console.log(`📊 Testing query on table: ${recentTable}`);
        const [testResults] = await bigquery.query({ query: testQuery });
        
        if (testResults.length > 0) {
          console.log(`✅ Found ${testResults.length} star events in test query`);
          successfulQuery = { pattern, recentTable };
          break;
        } else {
          console.log('⚠️  No star events found in test query');
        }
      }
      
    } catch (error) {
      console.log(`❌ Error with pattern ${pattern}:`, error.message);
    }
  }
  
  if (!successfulQuery) {
    console.log('\n❌ Could not find accessible GitHub Archive data');
    console.log('💡 This might be because:');
    console.log('   - The dataset requires different access permissions');
    console.log('   - The dataset structure has changed');
    console.log('   - Recent data is not available in this format');
    return [];
  }
  
  console.log(`\n✅ Using pattern: ${successfulQuery.pattern}`);
  console.log(`📊 Querying table: ${successfulQuery.recentTable}`);
  
  // Now query for the full last year
  const fullQuery = `
    SELECT
      DATE(created_at) as date,
      COUNT(*) as daily_stars
    FROM \`${successfulQuery.pattern}.${successfulQuery.recentTable}\`
    WHERE type = 'WatchEvent'
    AND JSON_EXTRACT_SCALAR(payload, '$.action') = 'started'
    AND repo.name = '${REPO_NAME}'
    AND created_at >= '${oneYearAgo.toISOString()}'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;
  
  try {
    console.log('📊 Executing full query for last year...');
    const [job] = await bigquery.createQueryJob({
      query: fullQuery,
      useLegacySql: false,
    });
    
    const [rows] = await job.getQueryResults();
    
    // Get job statistics
    const metadata = job.metadata;
    const stats = metadata.statistics;
    const bytesProcessed = parseInt(stats.totalBytesProcessed);
    
    console.log(`\n📈 Query Results:`);
    console.log(`   Found ${rows.length} days with star events`);
    console.log(`   Bytes processed: ${(bytesProcessed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Estimated cost: $${(bytesProcessed / 1024 / 1024 / 1024 / 1024 * 5).toFixed(4)}`);
    
    if (rows.length === 0) {
      console.log('⚠️  No star events found for the last year');
      return [];
    }
    
    // Process the data to create cumulative counts
    const processedData = processLastYearData(rows);
    
    console.log(`📈 Processed ${processedData.length} data points`);
    
    return processedData;
    
  } catch (error) {
    console.error('❌ Error executing full query:', error.message);
    return [];
  }
}

function processLastYearData(dailyResults) {
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

async function storeLastYearData(processedData) {
  console.log('💾 Storing last year data in DynamoDB...');
  
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
  console.log('🚀 GitHub Archive Last Year Query');
  console.log('==================================\n');
  
  // Check current data first
  await checkCurrentData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Query for last year data
  const lastYearData = await queryLastYearData();
  
  if (lastYearData.length === 0) {
    console.log('❌ No last year data found');
    console.log('\n💡 This could mean:');
    console.log('   - The GitHub Archive dataset is not accessible');
    console.log('   - Recent data is not available in this format');
    console.log('   - The repository has no star events in the last year');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  console.log('⚠️  This will replace existing star data with last year data from GitHub Archive.');
  console.log('📊 Last year data points:', lastYearData.length);
  console.log('📅 Date range:', lastYearData[0]?.date, 'to', lastYearData[lastYearData.length - 1]?.date);
  console.log('⭐ Final stars:', lastYearData[lastYearData.length - 1]?.count);
  
  // Store last year data
  await storeLastYearData(lastYearData);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check data after import
  await checkCurrentData();
  
  console.log('\n✅ Last year data import completed!');
  console.log('\n💡 This data comes from GitHub Archive, showing real historical star events.');
}

// Run the script
main().catch(console.error); 