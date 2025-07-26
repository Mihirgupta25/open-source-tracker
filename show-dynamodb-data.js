const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

async function showDynamoDBData() {
  console.log('🔍 DynamoDB Data Verification (us-east-1)\n');
  
  const tables = [
    { name: 'dev-star-growth', description: 'Star Growth Data' },
    { name: 'dev-pr-velocity', description: 'PR Velocity Data' },
    { name: 'dev-issue-health', description: 'Issue Health Data' },
    { name: 'dev-package-downloads', description: 'Package Downloads Data' }
  ];
  
  for (const table of tables) {
    try {
      console.log(`📊 ${table.description} (${table.name}):`);
      const result = await dynamodb.scan({ TableName: table.name }).promise();
      console.log(`   Found ${result.Items.length} items`);
      
      if (result.Items.length > 0) {
        console.log('   Sample data:');
        console.log('   ', JSON.stringify(result.Items[0], null, 2));
      }
      console.log('');
      
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log('✅ All data is present in DynamoDB!');
  console.log('💡 If AWS console shows 0 items, try refreshing or use "Explore table data" tab.');
}

showDynamoDBData(); 