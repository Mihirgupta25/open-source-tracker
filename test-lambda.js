const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const lambda = new AWS.Lambda();

async function testLambda() {
  console.log('🧪 Testing Lambda function directly...\n');
  
  const event = {
    httpMethod: 'GET',
    path: '/api/star-history',
    queryStringParameters: null
  };
  
  try {
    // Get the Lambda function name from CloudFormation
    const cloudformation = new AWS.CloudFormation();
    const stackResources = await cloudformation.listStackResources({
      StackName: 'OpenSourceTrackerDev'
    }).promise();
    
    const apiFunction = stackResources.StackResourceSummaries.find(
      resource => resource.LogicalResourceId === 'APIFunction49CD189B'
    );
    
    if (!apiFunction) {
      console.error('❌ Could not find APIFunction in CloudFormation stack');
      return;
    }
    
    console.log('Found Lambda function:', apiFunction.PhysicalResourceId);
    
    // Invoke the Lambda function
    const result = await lambda.invoke({
      FunctionName: apiFunction.PhysicalResourceId,
      Payload: JSON.stringify(event),
      LogType: 'Tail'
    }).promise();
    
    console.log('Lambda response:', result.Payload.toString());
    
    if (result.LogResult) {
      console.log('Lambda logs:', Buffer.from(result.LogResult, 'base64').toString());
    }
    
  } catch (error) {
    console.error('❌ Error testing Lambda:', error.message);
  }
}

testLambda(); 