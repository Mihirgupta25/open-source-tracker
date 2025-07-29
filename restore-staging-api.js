const AWS = require('aws-sdk');
const fs = require('fs');
const archiver = require('archiver');
AWS.config.update({ region: 'us-east-1' });

async function restoreStagingAPI() {
  console.log('🔄 Restoring staging API Lambda function...\n');

  try {
    // Create deployment package
    console.log('📦 Creating deployment package...');
    const output = fs.createWriteStream('staging-api-restore.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', async () => {
      console.log('✅ Deployment package created');
      
      const code = fs.readFileSync('staging-api-restore.zip');
      const lambda = new AWS.Lambda();

      // Update the staging API Lambda function
      console.log('\n📊 Updating staging API Lambda...');
      await lambda.updateFunctionCode({
        FunctionName: 'OpenSourceTrackerStagingV2-APIFunction49CD189B-zMaro6VUNjxt',
        ZipFile: code
      }).promise();
      console.log('✅ Staging API Lambda updated');

      // Wait for update to complete
      console.log('\n⏳ Waiting for Lambda update to complete...');
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

      console.log('\n🎉 Staging API restored successfully!');
      console.log('📊 The staging environment should now load data properly');

    });

    archive.pipe(output);
    
    // Add the original staging API code
    const apiCode = `
const AWS = require('aws-sdk');

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
  
  // Default API routes
  if (httpMethod === 'GET') {
    if (path === '/api/star-history') {
      // Star history logic
      const dynamodb = new AWS.DynamoDB.DocumentClient();
      try {
        const data = await dynamodb.scan({ TableName: 'staging-star-growth' }).promise();
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify(data.Items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)))
        };
      } catch (error) {
        console.error('Error fetching star history:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Failed to fetch star history' })
        };
      }
    }
    
    if (path === '/api/pr-velocity') {
      // PR velocity logic
      const dynamodb = new AWS.DynamoDB.DocumentClient();
      try {
        const data = await dynamodb.scan({ TableName: 'staging-pr-velocity' }).promise();
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify(data.Items.sort((a, b) => new Date(a.date) - new Date(b.date)))
        };
      } catch (error) {
        console.error('Error fetching PR velocity:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Failed to fetch PR velocity' })
        };
      }
    }
    
    if (path === '/api/issue-health') {
      // Issue health logic
      const dynamodb = new AWS.DynamoDB.DocumentClient();
      try {
        const data = await dynamodb.scan({ TableName: 'staging-issue-health' }).promise();
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify(data.Items.sort((a, b) => new Date(a.date) - new Date(b.date)))
        };
      } catch (error) {
        console.error('Error fetching issue health:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Failed to fetch issue health' })
        };
      }
    }
    
    if (path === '/api/package-downloads') {
      // Package downloads logic
      const dynamodb = new AWS.DynamoDB.DocumentClient();
      try {
        const data = await dynamodb.scan({ TableName: 'staging-package-downloads' }).promise();
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify(data.Items.sort((a, b) => new Date(a.week_start) - new Date(b.week_start)))
        };
      } catch (error) {
        console.error('Error fetching package downloads:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Failed to fetch package downloads' })
        };
      }
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
    
    archive.append(apiCode, { name: 'index.js' });
    archive.finalize();

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

restoreStagingAPI().catch(console.error); 