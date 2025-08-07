#!/usr/bin/env node

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const TABLES = ['prod-star-growth', 'staging-star-growth'];

// Historical data from the image
const historicalData = [
  { repo: 'crewAi/crewAi', date: 'Wed Aug 06 2025 00:00:00 GMT-0700 (Pacific Daylight Time)', stars: 0 },
  { repo: 'crewAllnc/crewAI', date: 'Tue Nov 14 2023 08:23:29 GMT-0800 (Pacific Standard Time)', stars: 0 },
  { repo: 'crewAllnc/crewAI', date: 'Tue Jan 16 2024 16:36:12 GMT-0800 (Pacific Standard Time)', stars: 4650 },
  { repo: 'crewAllnc/crewAI', date: 'Mon Feb 12 2024 16:43:11 GMT-0800 (Pacific Standard Time)', stars: 7020 },
  { repo: 'crewAllnc/crewAI', date: 'Sun Mar 17 2024 23:58:59 GMT-0700 (Pacific Daylight Time)', stars: 9390 },
  { repo: 'crewAllnc/crewAI', date: 'Fri Apr 19 2024 10:47:09 GMT-0700 (Pacific Daylight Time)', stars: 11730 },
  { repo: 'crewAllnc/crewAI', date: 'Tue May 21 2024 06:40:39 GMT-0700 (Pacific Daylight Time)', stars: 14100 },
  { repo: 'crewAllnc/crewAI', date: 'Thu Jul 04 2024 18:58:16 GMT-0700 (Pacific Daylight Time)', stars: 16470 },
  { repo: 'crewAllnc/crewAI', date: 'Sun Sep 15 2024 21:24:51 GMT-0700 (Pacific Daylight Time)', stars: 18810 },
  { repo: 'crewAllnc/crewAI', date: 'Sat Nov 23 2024 09:26:12 GMT-0800 (Pacific Standard Time)', stars: 21180 },
  { repo: 'crewAllnc/crewAI', date: 'Sat Jan 04 2025 12:48:15 GMT-0800 (Pacific Standard Time)', stars: 23550 },
  { repo: 'crewAllnc/crewAI', date: 'Sun Feb 09 2025 10:11:32 GMT-0800 (Pacific Standard Time)', stars: 25890 },
  { repo: 'crewAllnc/crewAI', date: 'Sun Mar 16 2025 17:23:48 GMT-0700 (Pacific Daylight Time)', stars: 28260 },
  { repo: 'crewAllnc/crewAI', date: 'Thu May 01 2025 15:23:29 GMT-0700 (Pacific Daylight Time)', stars: 30630 },
  { repo: 'crewAllnc/crewAI', date: 'Wed Jun 18 2025 05:27:15 GMT-0700 (Pacific Daylight Time)', stars: 32970 },
  { repo: 'crewAllnc/crewAI', date: 'Wed Aug 06 2025 01:42:30 GMT-0700 (Pacific Daylight Time)', stars: 35340 },
  { repo: 'crewAllnc/crewAI', date: 'Wed Aug 06 2025 16:06:21 GMT-0700 (Pacific Daylight Time)', stars: 35379 }
];

async function clearExistingData() {
  console.log('🗑️  Clearing existing data for crewAi repositories...');
  const reposToClear = ['crewAi/crewAi', 'crewAllnc/crewAI'];

  for (const tableName of TABLES) {
    console.log(`📊 Clearing ${tableName}...`);
    for (const repoName of reposToClear) {
      try {
        // Get all items for the repo
        const params = {
          TableName: tableName,
          KeyConditionExpression: 'repo = :repo',
          ExpressionAttributeValues: {
            ':repo': repoName
          }
        };

        const result = await dynamodb.query(params).promise();
        console.log(`   Found ${result.Items.length} existing items for ${repoName}`);

        if (result.Items.length === 0) {
          console.log(`   No existing data to clear for ${repoName}`);
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

          console.log(`   Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(result.Items.length / batchSize)} for ${repoName}`);
        }
        console.log(`   ✅ Cleared data for ${repoName} from ${tableName}`);
      } catch (error) {
        console.error(`   ❌ Error clearing ${tableName} for ${repoName}:`, error.message);
      }
    }
  }
}

async function storeHistoricalData(data) {
  console.log('💾 Storing historical data in DynamoDB...');

  for (const tableName of TABLES) {
    console.log(`📊 Storing in ${tableName}...`);

    let storedCount = 0;
    for (const dataPoint of data) {
      const dateObj = new Date(dataPoint.date);
      const params = {
        TableName: tableName,
        Item: {
          repo: dataPoint.repo,
          timestamp: dateObj.toISOString(),
          displayTimestamp: dateObj.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'America/Los_Angeles'
          }),
          count: dataPoint.stars
        }
      };

      try {
        await dynamodb.put(params).promise();
        storedCount++;
        if (storedCount % 10 === 0) {
          console.log(`   ✅ Stored ${storedCount}/${data.length} data points`);
        }
      } catch (error) {
        console.error(`   ❌ Error storing ${dataPoint.date} for ${dataPoint.repo}:`, error.message);
      }
    }
    console.log(`   ✅ Completed: ${storedCount} data points stored in ${tableName}`);
  }
}

async function checkCurrentData() {
  console.log('📊 Checking current data in DynamoDB...');
  const reposToCheck = ['crewAi/crewAi', 'crewAllnc/crewAI'];

  for (const tableName of TABLES) {
    console.log(`\n📋 ${tableName}:`);
    for (const repoName of reposToCheck) {
      console.log(`   Repo: ${repoName}`);
      try {
        const params = {
          TableName: tableName,
          KeyConditionExpression: 'repo = :repo',
          ExpressionAttributeValues: {
            ':repo': repoName
          },
          ScanIndexForward: true
        };

        const result = await dynamodb.query(params).promise();
        console.log(`     Total entries: ${result.Items.length}`);

        if (result.Items.length > 0) {
          const first = result.Items[0];
          const last = result.Items[result.Items.length - 1];
          console.log(`     First: ${first.timestamp} - ${first.count} stars`);
          console.log(`     Last: ${last.timestamp} - ${last.count} stars`);

          // Show some sample data points
          console.log(`     Sample data points:`);
          const sampleSize = Math.min(5, result.Items.length);
          for (let i = 0; i < sampleSize; i++) {
            const item = result.Items[i];
            console.log(`       ${item.timestamp} - ${item.count} stars`);
          }

          if (result.Items.length > 5) {
            console.log(`       ... and ${result.Items.length - 5} more entries`);
          }
        }

      } catch (error) {
        console.error(`   ❌ Error querying ${tableName} for ${repoName}:`, error.message);
      }
    }
  }
}

async function main() {
  console.log('🚀 Uploading CrewAI Historical Star Growth Data');
  console.log('==============================================\n');

  // Check current data first
  await checkCurrentData();

  console.log('\n' + '='.repeat(50) + '\n');

  // Clear existing data for these repositories
  await clearExistingData();

  console.log('\n' + '='.repeat(50) + '\n');

  // Store historical data
  await storeHistoricalData(historicalData);

  console.log('\n' + '='.repeat(50) + '\n');

  // Check data after import
  await checkCurrentData();

  console.log('\n✅ CrewAI historical star growth data upload completed!');
  console.log('\n💡 Both prod-star-growth and staging-star-growth tables have been updated.');
}

// Run the script
main().catch(console.error); 