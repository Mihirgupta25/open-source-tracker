const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

async function testDynamoDB() {
  console.log('🔍 Testing DynamoDB data...\n');
  
  try {
    // Test star growth table
    console.log('📊 Star Growth Data:');
    const starResult = await dynamodb.scan({ 
      TableName: 'dev-star-growth', 
      Limit: 5 
    }).promise();
    console.log(`Found ${starResult.Items.length} items`);
    if (starResult.Items.length > 0) {
      console.log('Sample data:', JSON.stringify(starResult.Items[0], null, 2));
    }
    
    // Test PR velocity table
    console.log('\n📈 PR Velocity Data:');
    const prResult = await dynamodb.scan({ 
      TableName: 'dev-pr-velocity', 
      Limit: 5 
    }).promise();
    console.log(`Found ${prResult.Items.length} items`);
    if (prResult.Items.length > 0) {
      console.log('Sample data:', JSON.stringify(prResult.Items[0], null, 2));
    }
    
    // Test issue health table
    console.log('\n🐛 Issue Health Data:');
    const issueResult = await dynamodb.scan({ 
      TableName: 'dev-issue-health', 
      Limit: 5 
    }).promise();
    console.log(`Found ${issueResult.Items.length} items`);
    if (issueResult.Items.length > 0) {
      console.log('Sample data:', JSON.stringify(issueResult.Items[0], null, 2));
    }
    
    // Test package downloads table
    console.log('\n📦 Package Downloads Data:');
    const packageResult = await dynamodb.scan({ 
      TableName: 'dev-package-downloads', 
      Limit: 5 
    }).promise();
    console.log(`Found ${packageResult.Items.length} items`);
    if (packageResult.Items.length > 0) {
      console.log('Sample data:', JSON.stringify(packageResult.Items[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error testing DynamoDB:', error.message);
  }
}

async function testAPI() {
  console.log('\n🌐 Testing API endpoints...\n');
  
  const apiUrl = 'https://l97n7ozrb0.execute-api.us-east-1.amazonaws.com/prod';
  
  try {
    // Test star history endpoint
    console.log('Testing /api/star-history...');
    const response = await fetch(`${apiUrl}/api/star-history`);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

// Run tests
async function runTests() {
  await testDynamoDB();
  await testAPI();
}

runTests(); 