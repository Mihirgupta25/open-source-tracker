#!/usr/bin/env node

const AWS = require('aws-sdk');
const { BigQuery } = require('@google-cloud/bigquery');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REPO_NAME = 'promptfoo/promptfoo';
const CREATION_DATE = '2023-04-28';
const TABLES = ['prod-star-growth', 'staging-star-growth'];

// BigQuery configuration - use our own project for running queries
const bigquery = new BigQuery({
  projectId: 'open-source-tracker-1754516518', // Our project
});

async function queryWeeklyStarGrowth() {
  console.log('🔍 Querying GitHub Archive for weekly star growth data...');
  console.log(`📊 Repository: ${REPO_NAME}`);
  console.log(`📅 Since: ${CREATION_DATE}`);
  
  // Query for weekly star growth using a more efficient approach
  // We'll query specific months to avoid quota issues
  const queries = [];
  
  // Create queries for each month from creation to now
  const startDate = new Date(CREATION_DATE);
  const endDate = new Date();
  
  for (let year = startDate.getFullYear(); year <= endDate.getFullYear(); year++) {
    for (let month = 1; month <= 12; month++) {
      // Skip months before creation
      if (year === startDate.getFullYear() && month < startDate.getMonth() + 1) {
        continue;
      }
      // Skip months after current date
      if (year === endDate.getFullYear() && month > endDate.getMonth() + 1) {
        continue;
      }
      
      const monthStr = month.toString().padStart(2, '0');
      const tableName = `githubarchive.day.${year}${monthStr}`;
      
      const query = `
        SELECT
          DATE(created_at) as date,
          COUNT(*) as daily_stars
        FROM \`${tableName}\`
        WHERE type = 'WatchEvent'
        AND JSON_EXTRACT_SCALAR(payload, '$.action') = 'started'
        AND repo.name = '${REPO_NAME}'
        AND created_at >= '${CREATION_DATE}'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;
      
      queries.push({ query, month: `${year}-${monthStr}` });
    }
  }
  
  console.log(`📊 Will execute ${queries.length} monthly queries to avoid quota limits`);
  
  const allResults = [];
  
  for (let i = 0; i < queries.length; i++) {
    const { query, month } = queries[i];
    console.log(`📅 Querying ${month}... (${i + 1}/${queries.length})`);
    
    try {
      const [rows] = await bigquery.query({ query });
      console.log(`   ✅ Found ${rows.length} days with star events`);
      
      if (rows.length > 0) {
        allResults.push(...rows);
      }
      
      // Add a small delay between queries to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`   ❌ Error querying ${month}:`, error.message);
      
      if (error.message.includes('quota')) {
        console.log('   ⚠️  Hit quota limit, stopping here');
        break;
      }
    }
  }
  
  console.log(`📈 Total daily records found: ${allResults.length}`);
  
  if (allResults.length === 0) {
    console.log('⚠️  No star events found. This could mean:');
    console.log('   - Repository is private');
    console.log('   - Repository has no stars');
    console.log('   - Data not available in GitHub Archive');
    console.log('   - Hit BigQuery quota limits');
    return [];
  }
  
  // Process the data to create weekly cumulative counts
  const weeklyData = processWeeklyData(allResults);
  
  console.log(`📈 Processed ${weeklyData.length} weekly data points`);
  
  return weeklyData;
}

function processWeeklyData(dailyResults) {
  console.log('🔄 Processing daily data into weekly cumulative counts...');
  
  // Sort by date
  dailyResults.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const weeklyData = [];
  let cumulativeStars = 0;
  let currentWeekStart = null;
  
  dailyResults.forEach(day => {
    const date = new Date(day.date);
    const weekStart = getWeekStart(date);
    
    if (currentWeekStart === null || weekStart.getTime() !== currentWeekStart.getTime()) {
      if (currentWeekStart !== null) {
        // Store the previous week's data
        weeklyData.push({
          weekStart: currentWeekStart.toISOString().split('T')[0],
          timestamp: currentWeekStart.toISOString(),
          count: cumulativeStars
        });
      }
      currentWeekStart = weekStart;
    }
    
    cumulativeStars += parseInt(day.daily_stars) || 0;
  });
  
  // Add the last week if we have data
  if (currentWeekStart !== null) {
    weeklyData.push({
      weekStart: currentWeekStart.toISOString().split('T')[0],
      timestamp: currentWeekStart.toISOString(),
      count: cumulativeStars
    });
  }
  
  return weeklyData;
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

async function storeWeeklyData(weeklyData) {
  console.log('💾 Storing weekly data in DynamoDB...');
  
  for (const tableName of TABLES) {
    console.log(`📊 Storing in ${tableName}...`);
    
    let storedCount = 0;
    for (const dataPoint of weeklyData) {
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
          console.log(`   ✅ Stored ${storedCount}/${weeklyData.length} weekly data points`);
        }
      } catch (error) {
        console.error(`   ❌ Error storing ${dataPoint.weekStart}:`, error.message);
      }
    }
    console.log(`   ✅ Completed: ${storedCount} weekly data points stored in ${tableName}`);
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
  console.log('🚀 GitHub Archive Weekly Star Growth Importer');
  console.log('=============================================\n');
  
  // Check current data first
  await checkCurrentData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Query GitHub Archive for weekly data
  const weeklyData = await queryWeeklyStarGrowth();
  
  if (weeklyData.length === 0) {
    console.log('❌ No weekly data found');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  console.log('⚠️  This will replace existing star data with weekly data from GitHub Archive.');
  console.log('📊 Weekly data points:', weeklyData.length);
  console.log('📅 Date range:', weeklyData[0]?.weekStart, 'to', weeklyData[weeklyData.length - 1]?.weekStart);
  console.log('⭐ Final stars:', weeklyData[weeklyData.length - 1]?.count);
  
  // Clear existing data
  await clearExistingData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Store weekly data
  await storeWeeklyData(weeklyData);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check data after import
  await checkCurrentData();
  
  console.log('\n✅ Weekly star growth data import completed!');
  console.log('\n💡 This data comes from GitHub Archive, showing weekly cumulative star counts.');
  console.log('   Note: This uses BigQuery which may have quota limits.');
}

// Run the script
main().catch(console.error); 