const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Environment variables (same as Lambda)
const ENVIRONMENT = 'dev';
const STAR_GROWTH_TABLE = 'dev-star-growth';
const PR_VELOCITY_TABLE = 'dev-pr-velocity';
const ISSUE_HEALTH_TABLE = 'dev-issue-health';
const PACKAGE_DOWNLOADS_TABLE = 'dev-package-downloads';
const GITHUB_TOKEN_SECRET_NAME = 'github-token-dev';

// DynamoDB helper functions (same as Lambda)
async function queryStarHistory(repo) {
  const params = {
    TableName: STAR_GROWTH_TABLE,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': repo
    },
    ScanIndexForward: true
  };
  
  console.log('Querying with params:', JSON.stringify(params, null, 2));
  
  const result = await dynamodb.query(params).promise();
  console.log('Query result:', JSON.stringify(result, null, 2));
  return result.Items;
}

async function queryPRVelocity(repo) {
  const params = {
    TableName: PR_VELOCITY_TABLE,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': repo
    },
    ScanIndexForward: true
  };
  
  const result = await dynamodb.query(params).promise();
  return result.Items;
}

async function queryIssueHealth(repo) {
  const params = {
    TableName: ISSUE_HEALTH_TABLE,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': repo
    },
    ScanIndexForward: true
  };
  
  const result = await dynamodb.query(params).promise();
  return result.Items;
}

async function queryPackageDownloads(repo) {
  const params = {
    TableName: PACKAGE_DOWNLOADS_TABLE,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': repo
    },
    ScanIndexForward: true
  };
  
  const result = await dynamodb.query(params).promise();
  return result.Items;
}

// Test the functions
async function testFunctions() {
  console.log('🧪 Testing Lambda functions locally...\n');
  
  try {
    console.log('📊 Testing star history query...');
    const starData = await queryStarHistory('promptfoo/promptfoo');
    console.log(`Found ${starData.length} star records`);
    
    console.log('\n📈 Testing PR velocity query...');
    const prData = await queryPRVelocity('promptfoo/promptfoo');
    console.log(`Found ${prData.length} PR records`);
    
    console.log('\n🐛 Testing issue health query...');
    const issueData = await queryIssueHealth('promptfoo/promptfoo');
    console.log(`Found ${issueData.length} issue records`);
    
    console.log('\n📦 Testing package downloads query...');
    const packageData = await queryPackageDownloads('promptfoo/promptfoo');
    console.log(`Found ${packageData.length} package records`);
    
    console.log('\n✅ All queries successful!');
    
  } catch (error) {
    console.error('❌ Error testing functions:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testFunctions(); 