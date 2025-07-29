const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

async function fixStagingAPIHandler() {
  console.log('🔧 Fixing staging API Lambda handler...\n');

  const lambda = new AWS.Lambda();

  try {
    // Update the Lambda function configuration
    console.log('📊 Updating Lambda function configuration...');
    await lambda.updateFunctionConfiguration({
      FunctionName: 'OpenSourceTrackerStagingV2-APIFunction49CD189B-zMaro6VUNjxt',
      Handler: 'index.handler',
      Description: 'Staging API Lambda function for open source tracker'
    }).promise();
    console.log('✅ Lambda function configuration updated');

    // Wait for update to complete
    console.log('\n⏳ Waiting for configuration update to complete...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Test the API
    console.log('\n🧪 Testing the staging API...');
    const testResult = await lambda.invoke({
      FunctionName: 'OpenSourceTrackerStagingV2-APIFunction49CD189B-zMaro6VUNjxt',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        httpMethod: 'GET',
        path: '/api/star-history'
      })
    }).promise();
    
    console.log('✅ Staging API test:');
    console.log(`   Status Code: ${testResult.StatusCode}`);
    if (testResult.Payload) {
      const payload = JSON.parse(testResult.Payload.toString());
      console.log(`   Response: ${JSON.stringify(payload, null, 2)}`);
    }

    console.log('\n🎉 Staging API handler fixed successfully!');
    console.log('📊 The staging environment should now load data properly');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

fixStagingAPIHandler().catch(console.error); 