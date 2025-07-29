const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

async function triggerStarCollection() {
  console.log('🚀 Triggering immediate star collection for staging...\n');

  const lambda = new AWS.Lambda();

  try {
    // Trigger staging Lambda function
    console.log('📊 Invoking staging star collector Lambda...');
    const result = await lambda.invoke({
      FunctionName: 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({})
    }).promise();
    
    console.log(`✅ Lambda Status Code: ${result.StatusCode}`);
    
    if (result.Payload) {
      const payload = JSON.parse(result.Payload.toString());
      console.log('📝 Lambda Response:');
      console.log(JSON.stringify(payload, null, 2));
    }

    // Wait a moment for data to be written
    console.log('\n⏳ Waiting for data to be written...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify the new data was written
    console.log('\n🔍 Checking for new data...');
    const dynamodb = new AWS.DynamoDB.DocumentClient();
    
    const stagingData = await dynamodb.scan({
      TableName: 'staging-star-growth',
      Limit: 5
    }).promise();
    
    console.log(`📊 Found ${stagingData.Items.length} items in staging-star-growth`);
    
    if (stagingData.Items.length > 0) {
      const latestEntry = stagingData.Items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      console.log(`📈 Latest entry: ${latestEntry.count} stars at ${latestEntry.timestamp}`);
      
      // Check if this is a recent entry (last 10 minutes)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const isRecent = new Date(latestEntry.timestamp) > tenMinutesAgo;
      
      if (isRecent) {
        console.log('✅ New data point successfully created!');
      } else {
        console.log('⚠️ Latest entry is not recent - may be from previous collection');
      }
    }

    console.log('\n🎉 Star collection triggered successfully!');
    console.log('📊 New data point should now be available in the staging environment');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

// Export for use as Lambda function
exports.handler = async (event) => {
  try {
    await triggerStarCollection();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        message: 'Star collection triggered successfully',
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({
        error: 'Failed to trigger star collection',
        message: error.message
      })
    };
  }
};

// Run directly if called from command line
if (require.main === module) {
  triggerStarCollection().catch(console.error);
} 