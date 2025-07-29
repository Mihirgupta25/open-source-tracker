const AWS = require('aws-sdk');
const fs = require('fs');
const archiver = require('archiver');
AWS.config.update({ region: 'us-east-1' });

async function updateTriggerLambda() {
  console.log('🔄 Updating trigger Lambda with AWS SDK v3...\n');

  try {
    // Create deployment package
    console.log('📦 Creating deployment package...');
    const output = fs.createWriteStream('trigger-lambda-v3.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', async () => {
      console.log('✅ Deployment package created');
      
      const code = fs.readFileSync('trigger-lambda-v3.zip');
      const lambda = new AWS.Lambda();

      // Update the trigger Lambda function
      console.log('\n📊 Updating trigger Lambda function...');
      await lambda.updateFunctionCode({
        FunctionName: 'trigger-star-collection-staging',
        ZipFile: code
      }).promise();
      console.log('✅ Trigger Lambda function updated');

      // Wait for update to complete
      console.log('\n⏳ Waiting for Lambda update to complete...');
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Test the function
      console.log('\n🧪 Testing the updated trigger function...');
      const testResult = await lambda.invoke({
        FunctionName: 'trigger-star-collection-staging',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({})
      }).promise();
      
      console.log('✅ Trigger function test:');
      console.log(`   Status Code: ${testResult.StatusCode}`);
      if (testResult.Payload) {
        const payload = JSON.parse(testResult.Payload.toString());
        console.log(`   Response: ${JSON.stringify(payload, null, 2)}`);
      }

      console.log('\n🎉 Trigger Lambda function updated successfully!');
      console.log('📊 The function should now work with AWS SDK v3');
      console.log('⏰ Test it by clicking the "Create New Data Point" button');

    });

    archive.pipe(output);
    
    // Add the trigger function code with AWS SDK v3
    const triggerCode = `
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');

const lambda = new LambdaClient({ region: 'us-east-1' });
const dynamodb = new DynamoDBClient({ region: 'us-east-1' });

exports.handler = async (event) => {
  console.log('🚀 Triggering immediate star collection...');
  
  try {
    // Trigger staging star collector Lambda
    console.log('📊 Invoking staging star collector...');
    const invokeCommand = new InvokeCommand({
      FunctionName: process.env.STAGING_LAMBDA,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({})
    });
    
    const result = await lambda.send(invokeCommand);
    console.log(\`✅ Lambda Status Code: \${result.StatusCode}\`);
    
    if (result.Payload) {
      const payload = JSON.parse(Buffer.from(result.Payload).toString());
      console.log('📝 Lambda Response:', JSON.stringify(payload, null, 2));
    }

    // Wait a moment for data to be written
    console.log('⏳ Waiting for data to be written...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify the new data was written
    console.log('🔍 Checking for new data...');
    const scanCommand = new ScanCommand({
      TableName: process.env.STAGING_TABLE,
      Limit: 5
    });
    
    const data = await dynamodb.send(scanCommand);
    console.log(\`📊 Found \${data.Items.length} items in staging-star-growth\`);
    
    if (data.Items.length > 0) {
      const latestEntry = data.Items.sort((a, b) => new Date(b.timestamp.S) - new Date(a.timestamp.S))[0];
      console.log(\`📈 Latest entry: \${latestEntry.count.N} stars at \${latestEntry.timestamp.S}\`);
      
      // Check if this is a recent entry (last 10 minutes)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const isRecent = new Date(latestEntry.timestamp.S) > tenMinutesAgo;
      
      if (isRecent) {
        console.log('✅ New data point successfully created!');
      } else {
        console.log('⚠️ Latest entry is not recent - may be from previous collection');
      }
    }

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
        timestamp: new Date().toISOString(),
        success: true
      })
    };

  } catch (error) {
    console.error('❌ Error:', error);
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
        message: error.message,
        success: false
      })
    };
  }
};
`;
    
    archive.append(triggerCode, { name: 'index.js' });
    archive.finalize();

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

updateTriggerLambda().catch(console.error); 