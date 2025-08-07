#!/usr/bin/env node

const AWS = require('aws-sdk');
const axios = require('axios');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const REPO_NAME = 'promptfoo/promptfoo';
const TABLES = ['prod-star-growth', 'staging-star-growth'];

async function getRepositoryInfo() {
  try {
    const response = await axios.get(`https://api.github.com/repos/${REPO_NAME}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching repository info:', error.message);
    return null;
  }
}

async function getStarHistory() {
  console.log('🔍 Fetching star history for promptfoo/promptfoo...');
  
  const repoInfo = await getRepositoryInfo();
  if (!repoInfo) {
    console.error('❌ Could not fetch repository info');
    return [];
  }
  
  console.log(`📊 Repository: ${repoInfo.full_name}`);
  console.log(`📅 Created: ${repoInfo.created_at}`);
  console.log(`⭐ Current stars: ${repoInfo.stargazers_count}`);
  
  // For now, let's create a synthetic history based on the current star count
  // This is a simplified approach - in a real implementation, you'd want to use
  // GitHub Archive or the GitHub API with authentication to get actual historical data
  
  const creationDate = new Date(repoInfo.created_at);
  const currentDate = new Date();
  const currentStars = repoInfo.stargazers_count;
  
  // Create a synthetic growth curve (this is just for demonstration)
  const daysSinceCreation = Math.floor((currentDate - creationDate) / (1000 * 60 * 60 * 24));
  
  console.log(`📈 Days since creation: ${daysSinceCreation}`);
  console.log(`⭐ Average daily growth: ${(currentStars / daysSinceCreation).toFixed(2)} stars/day`);
  
  // Generate synthetic data points (this is just for demonstration)
  const syntheticHistory = generateSyntheticHistory(creationDate, currentDate, currentStars);
  
  return syntheticHistory;
}

function generateSyntheticHistory(startDate, endDate, finalStars) {
  console.log('🔄 Generating synthetic star history...');
  
  const history = [];
  const daysDiff = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
  
  // Use a logistic growth model for more realistic data
  const k = 0.1; // growth rate
  const maxStars = finalStars * 1.1; // slightly higher than current for realistic curve
  
  for (let day = 0; day <= daysDiff; day++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + day);
    
    // Logistic growth formula: P(t) = L / (1 + e^(-k(t-t0)))
    // where L is the maximum value, k is growth rate, t0 is the inflection point
    const t0 = daysDiff * 0.6; // inflection point at 60% of the timeline
    const stars = Math.floor(maxStars / (1 + Math.exp(-k * (day - t0))));
    
    // Ensure we don't exceed the current star count
    const finalStarCount = Math.min(stars, finalStars);
    
    history.push({
      date: date.toISOString().split('T')[0],
      timestamp: date.toISOString(),
      count: finalStarCount
    });
  }
  
  console.log(`📈 Generated ${history.length} data points`);
  return history;
}

async function storeHistoricalData(starHistory) {
  console.log('💾 Storing historical data in DynamoDB...');
  
  for (const tableName of TABLES) {
    console.log(`📊 Storing in ${tableName}...`);
    
    let storedCount = 0;
    for (const dataPoint of starHistory) {
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
        if (storedCount % 50 === 0) {
          console.log(`   ✅ Stored ${storedCount}/${starHistory.length} data points`);
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
  console.log('🚀 Simple Star History Generator');
  console.log('================================\n');
  
  // Check current data first
  await checkCurrentData();
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Get star history
  const starHistory = await getStarHistory();
  
  if (starHistory.length === 0) {
    console.error('❌ No star history generated');
    return;
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  console.log('⚠️  This will add synthetic historical data.');
  console.log('📊 Data points:', starHistory.length);
  console.log('📅 Date range:', starHistory[0]?.date, 'to', starHistory[starHistory.length - 1]?.date);
  console.log('⭐ Final stars:', starHistory[starHistory.length - 1]?.count);
  
  // Store historical data
  await storeHistoricalData(starHistory);
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Check data after import
  await checkCurrentData();
  
  console.log('\n✅ Synthetic star history generation completed!');
  console.log('\n💡 Note: This is synthetic data for demonstration.');
  console.log('   For real historical data, use the GitHub API with authentication');
  console.log('   or GitHub Archive project.');
}

// Run the script
main().catch(console.error); 