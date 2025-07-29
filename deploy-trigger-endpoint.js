const AWS = require('aws-sdk');
const fs = require('fs');
const archiver = require('archiver');
AWS.config.update({ region: 'us-east-1' });

async function deployTriggerEndpoint() {
  console.log('🚀 Deploying trigger star collection endpoint...\n');

  try {
    // Create deployment package
    console.log('📦 Creating deployment package...');
    const output = fs.createWriteStream('trigger-endpoint.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', async () => {
      console.log('✅ Deployment package created');
      
      const code = fs.readFileSync('trigger-endpoint.zip');
      const lambda = new AWS.Lambda();

      // Update the staging API Lambda function
      console.log('\n📊 Updating staging API Lambda...');
      await lambda.updateFunctionCode({
        FunctionName: 'OpenSourceTrackerStagingV2-APIFunction49CD189B-zMaro6VUNjxt',
        ZipFile: code
      }).promise();
      console.log('✅ Staging API Lambda code updated');

      // Wait for update to complete
      console.log('\n⏳ Waiting for Lambda update to complete...');
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Test the endpoint
      console.log('\n🧪 Testing the trigger endpoint...');
      const testResult = await lambda.invoke({
        FunctionName: 'OpenSourceTrackerStagingV2-APIFunction49CD189B-zMaro6VUNjxt',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({
          httpMethod: 'POST',
          path: '/api/trigger-star-collection',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        })
      }).promise();
      
      console.log('✅ Trigger endpoint test:');
      console.log(`   Status Code: ${testResult.StatusCode}`);
      if (testResult.Payload) {
        const payload = JSON.parse(testResult.Payload.toString());
        console.log(`   Response: ${JSON.stringify(payload, null, 2)}`);
      }

      console.log('\n🎉 Trigger endpoint deployed successfully!');
      console.log('📊 The button in the staging environment should now work');
      console.log('⏰ Test it by clicking the "Create New Data Point" button');

    });

    archive.pipe(output);
    
    // Add the trigger function
    archive.append(fs.readFileSync('backend/trigger-star-collection.js', 'utf8'), { name: 'trigger-star-collection.js' });
    
    // Add a simple router to handle the new endpoint
    const routerCode = `
const AWS = require('aws-sdk');
const triggerStarCollection = require('./trigger-star-collection');

exports.handler = async (event) => {
  const { httpMethod, path } = event;
  
  // Handle CORS preflight
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }
  
  // Route to trigger star collection
  if (httpMethod === 'POST' && path === '/api/trigger-star-collection') {
    return await triggerStarCollection.handler(event);
  }
  
  // Default API routes (existing functionality)
  if (httpMethod === 'GET') {
    if (path === '/api/star-history') {
      // Existing star history logic
      const dynamodb = new AWS.DynamoDB.DocumentClient();
      const data = await dynamodb.scan({ TableName: 'staging-star-growth' }).promise();
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(data.Items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)))
      };
    }
    
    if (path === '/api/pr-velocity') {
      // Existing PR velocity logic
      const dynamodb = new AWS.DynamoDB.DocumentClient();
      const data = await dynamodb.scan({ TableName: 'staging-pr-velocity' }).promise();
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(data.Items.sort((a, b) => new Date(a.date) - new Date(b.date)))
      };
    }
    
    if (path === '/api/issue-health') {
      // Existing issue health logic
      const dynamodb = new AWS.DynamoDB.DocumentClient();
      const data = await dynamodb.scan({ TableName: 'staging-issue-health' }).promise();
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(data.Items.sort((a, b) => new Date(a.date) - new Date(b.date)))
      };
    }
    
    if (path === '/api/package-downloads') {
      // Existing package downloads logic
      const dynamodb = new AWS.DynamoDB.DocumentClient();
      const data = await dynamodb.scan({ TableName: 'staging-package-downloads' }).promise();
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(data.Items.sort((a, b) => new Date(a.week_start) - new Date(b.week_start)))
      };
    }
  }
  
  return {
    statusCode: 404,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ error: 'Not found' })
  };
};
`;
    
    archive.append(routerCode, { name: 'index.js' });
    archive.finalize();

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

deployTriggerEndpoint().catch(console.error); 