const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

async function createTriggerAPI() {
  console.log('🚀 Creating API Gateway endpoint for trigger Lambda...\n');

  const apigateway = new AWS.APIGateway();
  const lambda = new AWS.Lambda();

  try {
    // Create REST API
    console.log('📊 Creating REST API...');
    const api = await apigateway.createRestApi({
      name: 'trigger-star-collection-api',
      description: 'API for triggering immediate star collection'
    }).promise();
    
    console.log(`✅ REST API created: ${api.id}`);

    // Get the root resource
    console.log('\n📊 Getting root resource...');
    const resources = await apigateway.getResources({
      restApiId: api.id
    }).promise();
    
    const rootResource = resources.items.find(resource => resource.path === '/');
    console.log(`✅ Root resource: ${rootResource.id}`);

    // Create trigger resource
    console.log('\n📊 Creating trigger resource...');
    const triggerResource = await apigateway.createResource({
      restApiId: api.id,
      parentId: rootResource.id,
      pathPart: 'trigger-star-collection'
    }).promise();
    
    console.log(`✅ Trigger resource created: ${triggerResource.id}`);

    // Create POST method
    console.log('\n📊 Creating POST method...');
    await apigateway.putMethod({
      restApiId: api.id,
      resourceId: triggerResource.id,
      httpMethod: 'POST',
      authorizationType: 'NONE'
    }).promise();
    
    console.log('✅ POST method created');

    // Set up Lambda integration
    console.log('\n📊 Setting up Lambda integration...');
    await apigateway.putIntegration({
      restApiId: api.id,
      resourceId: triggerResource.id,
      httpMethod: 'POST',
      type: 'AWS_PROXY',
      integrationHttpMethod: 'POST',
      uri: `arn:aws:apigateway:us-east-1:lambda:path/2015-03-31/functions/arn:aws:lambda:us-east-1:071493677444:function:trigger-star-collection-staging/invocations`
    }).promise();
    
    console.log('✅ Lambda integration set up');

    // Add Lambda permission for API Gateway
    console.log('\n📊 Adding Lambda permission...');
    try {
      await lambda.addPermission({
        FunctionName: 'trigger-star-collection-staging',
        StatementId: 'api-gateway-permission',
        Action: 'lambda:InvokeFunction',
        Principal: 'apigateway.amazonaws.com',
        SourceArn: `arn:aws:execute-api:us-east-1:071493677444:${api.id}/*/*/trigger-star-collection`
      }).promise();
      console.log('✅ Lambda permission added');
    } catch (err) {
      if (err.code === 'ResourceConflictException') {
        console.log('✅ Lambda permission already exists');
      } else {
        throw err;
      }
    }

    // Deploy the API
    console.log('\n📊 Deploying API...');
    await apigateway.createDeployment({
      restApiId: api.id,
      stageName: 'prod'
    }).promise();
    
    console.log('✅ API deployed');

    // Get the API URL
    const apiUrl = `https://${api.id}.execute-api.us-east-1.amazonaws.com/prod/trigger-star-collection`;
    console.log(`\n🎉 API Gateway endpoint created successfully!`);
    console.log(`📊 API URL: ${apiUrl}`);
    console.log('📊 You can now call this endpoint from the frontend');

    // Test the endpoint
    console.log('\n🧪 Testing the API endpoint...');
    const https = require('https');
    
    const testRequest = () => {
      return new Promise((resolve, reject) => {
        const postData = JSON.stringify({});
        
        const options = {
          hostname: `${api.id}.execute-api.us-east-1.amazonaws.com`,
          port: 443,
          path: '/prod/trigger-star-collection',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
          }
        };
        
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            resolve({ statusCode: res.statusCode, data: data });
          });
        });
        
        req.on('error', (err) => {
          reject(err);
        });
        
        req.write(postData);
        req.end();
      });
    };
    
    try {
      const testResult = await testRequest();
      console.log('✅ API test successful:');
      console.log(`   Status Code: ${testResult.statusCode}`);
      console.log(`   Response: ${testResult.data}`);
    } catch (error) {
      console.log('⚠️ API test failed:', error.message);
    }

    // Update the frontend to use this new URL
    console.log('\n📝 Update the frontend to use this URL:');
    console.log(`   ${apiUrl}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

createTriggerAPI().catch(console.error); 