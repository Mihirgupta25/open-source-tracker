const AWS = require('aws-sdk');
const fs = require('fs');
const archiver = require('archiver');
AWS.config.update({ region: 'us-east-1' });

async function createTriggerLambda() {
  console.log('🚀 Creating separate trigger Lambda function...\n');

  try {
    // Create deployment package
    console.log('📦 Creating deployment package...');
    const output = fs.createWriteStream('trigger-lambda.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', async () => {
      console.log('✅ Deployment package created');
      
      const code = fs.readFileSync('trigger-lambda.zip');
      const lambda = new AWS.Lambda();
      const iam = new AWS.IAM();

      // Create IAM role for the trigger Lambda
      console.log('\n📊 Creating IAM role for trigger Lambda...');
      const roleName = 'trigger-star-collection-role';
      
      try {
        await iam.createRole({
          RoleName: roleName,
          AssumeRolePolicyDocument: JSON.stringify({
            Version: '2012-10-17',
            Statement: [{
              Effect: 'Allow',
              Principal: { Service: 'lambda.amazonaws.com' },
              Action: 'sts:AssumeRole'
            }]
          }),
          Description: 'Role for trigger star collection Lambda'
        }).promise();
        console.log('✅ IAM role created');
      } catch (err) {
        if (err.code === 'EntityAlreadyExists') {
          console.log('✅ IAM role already exists');
        } else {
          throw err;
        }
      }

      // Attach policies to the role
      console.log('\n📊 Attaching policies to role...');
      await iam.attachRolePolicy({
        RoleName: roleName,
        PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
      }).promise();
      console.log('✅ Basic execution role attached');

      // Create DynamoDB and Lambda permissions policy
      const triggerPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'lambda:InvokeFunction'
            ],
            Resource: [
              'arn:aws:lambda:us-east-1:071493677444:function:OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc'
            ]
          },
          {
            Effect: 'Allow',
            Action: [
              'dynamodb:GetItem',
              'dynamodb:Query',
              'dynamodb:Scan'
            ],
            Resource: [
              'arn:aws:dynamodb:us-east-1:071493677444:table/staging-star-growth'
            ]
          }
        ]
      };

      await iam.putRolePolicy({
        RoleName: roleName,
        PolicyName: 'TriggerPermissions',
        PolicyDocument: JSON.stringify(triggerPolicy)
      }).promise();
      console.log('✅ Trigger permissions policy attached');

      // Wait for IAM changes to propagate
      console.log('\n⏳ Waiting for IAM changes to propagate...');
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Create the Lambda function
      console.log('\n📊 Creating trigger Lambda function...');
      const functionName = 'trigger-star-collection-staging';
      
      try {
        await lambda.createFunction({
          FunctionName: functionName,
          Runtime: 'nodejs18.x',
          Role: `arn:aws:iam::071493677444:role/${roleName}`,
          Handler: 'index.handler',
          Code: { ZipFile: code },
          Description: 'Trigger immediate star collection for staging environment',
          Timeout: 30,
          MemorySize: 256,
          Environment: {
            Variables: {
              STAGING_LAMBDA: 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc',
              STAGING_TABLE: 'staging-star-growth'
            }
          }
        }).promise();
        console.log('✅ Trigger Lambda function created');
      } catch (err) {
        if (err.code === 'ResourceConflictException') {
          console.log('✅ Trigger Lambda function already exists, updating...');
          await lambda.updateFunctionCode({
            FunctionName: functionName,
            ZipFile: code
          }).promise();
          console.log('✅ Trigger Lambda function updated');
        } else {
          throw err;
        }
      }

      // Wait for function to be ready
      console.log('\n⏳ Waiting for function to be ready...');
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Test the function
      console.log('\n🧪 Testing the trigger function...');
      const testResult = await lambda.invoke({
        FunctionName: functionName,
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({})
      }).promise();
      
      console.log('✅ Trigger function test:');
      console.log(`   Status Code: ${testResult.StatusCode}`);
      if (testResult.Payload) {
        const payload = JSON.parse(testResult.Payload.toString());
        console.log(`   Response: ${JSON.stringify(payload, null, 2)}`);
      }

      console.log('\n🎉 Trigger Lambda function created successfully!');
      console.log(`📊 Function name: ${functionName}`);
      console.log('📊 You can now call this function to trigger immediate star collection');
      console.log('⏰ The frontend button will call this function');

    });

    archive.pipe(output);
    
    // Add the trigger function code
    const triggerCode = `
const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

exports.handler = async (event) => {
  console.log('🚀 Triggering immediate star collection...');
  
  const lambda = new AWS.Lambda();
  const dynamodb = new AWS.DynamoDB.DocumentClient();
  
  try {
    // Trigger staging star collector Lambda
    console.log('📊 Invoking staging star collector...');
    const result = await lambda.invoke({
      FunctionName: process.env.STAGING_LAMBDA,
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({})
    }).promise();
    
    console.log(\`✅ Lambda Status Code: \${result.StatusCode}\`);
    
    if (result.Payload) {
      const payload = JSON.parse(result.Payload.toString());
      console.log('📝 Lambda Response:', JSON.stringify(payload, null, 2));
    }

    // Wait a moment for data to be written
    console.log('⏳ Waiting for data to be written...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify the new data was written
    console.log('🔍 Checking for new data...');
    const data = await dynamodb.scan({
      TableName: process.env.STAGING_TABLE,
      Limit: 5
    }).promise();
    
    console.log(\`📊 Found \${data.Items.length} items in staging-star-growth\`);
    
    if (data.Items.length > 0) {
      const latestEntry = data.Items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      console.log(\`📈 Latest entry: \${latestEntry.count} stars at \${latestEntry.timestamp}\`);
      
      // Check if this is a recent entry (last 10 minutes)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const isRecent = new Date(latestEntry.timestamp) > tenMinutesAgo;
      
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

createTriggerLambda().catch(console.error); 