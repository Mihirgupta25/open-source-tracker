const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

async function clearLangchainData() {
  console.log('🗑️  Clear Langchain Data from Staging');
  console.log('=====================================');
  console.log('📤 Clearing existing langchain-ai/langchain data from staging...');
  console.log(`📊 Clearing from staging-star-growth...`);

  const tableName = 'staging-star-growth';
  const repo = 'langchain-ai/langchain';

  try {
    // Query all items for langchain-ai/langchain
    const params = {
      TableName: tableName,
      KeyConditionExpression: 'repo = :repo',
      ExpressionAttributeValues: {
        ':repo': repo
      }
    };

    const result = await dynamodb.query(params).promise();
    const items = result.Items;

    console.log(`Found ${items.length} existing data points to delete`);

    // Delete each item
    let deletedCount = 0;
    for (const item of items) {
      try {
        await dynamodb.delete({
          TableName: tableName,
          Key: {
            repo: item.repo,
            timestamp: item.timestamp
          }
        }).promise();
        
        console.log(`✅ Deleted: ${item.timestamp} - ${item.count} stars`);
        deletedCount++;
      } catch (error) {
        console.error(`❌ Error deleting ${item.timestamp}:`, error.message);
      }
    }

    console.log('\n📊 Summary:');
    console.log(`✅ Successfully deleted: ${deletedCount} data points`);
    console.log('✅ Data clearing completed!');
  } catch (error) {
    console.error('❌ Error querying data:', error.message);
  }
}

// Run the script
clearLangchainData().catch(console.error); 