const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const apigateway = new AWS.APIGateway();
const lambda = new AWS.Lambda();

async function findProductionAPI() {
  try {
    console.log('🔍 Finding production API Lambda function...');
    
    // Get the API Gateway
    const apis = await apigateway.getRestApis().promise();
    const productionAPI = apis.items.find(api => api.id === 'fwaonagbbh');
    
    if (!productionAPI) {
      console.log('❌ Could not find API Gateway with ID: fwaonagbbh');
      return;
    }
    
    console.log(`✅ Found API Gateway: ${productionAPI.name} (${productionAPI.id})`);
    
    // Get the resources for this API
    const resources = await apigateway.getResources({ restApiId: 'fwaonagbbh' }).promise();
    
    // Find the Lambda integration
    for (const resource of resources.items) {
      if (resource.resourceMethods) {
        for (const [method, methodData] of Object.entries(resource.resourceMethods)) {
          if (methodData.methodIntegration && methodData.methodIntegration.uri) {
            const uri = methodData.methodIntegration.uri;
            if (uri.includes('lambda')) {
              // Extract Lambda function ARN from URI
              const lambdaArn = uri.match(/arn:aws:lambda:[^:]+:[^:]+:function:([^\/]+)/);
              if (lambdaArn) {
                const functionName = lambdaArn[1];
                console.log(`🎯 Found Lambda function: ${functionName}`);
                
                // Get function details
                try {
                  const functionDetails = await lambda.getFunction({ FunctionName: functionName }).promise();
                  console.log(`📊 Function details:`);
                  console.log(`   Runtime: ${functionDetails.Configuration.Runtime}`);
                  console.log(`   Handler: ${functionDetails.Configuration.Handler}`);
                  console.log(`   Description: ${functionDetails.Configuration.Description || 'No description'}`);
                  console.log(`   Last modified: ${functionDetails.Configuration.LastModified}`);
                  
                  return functionName;
                } catch (err) {
                  console.log(`❌ Could not get details for function: ${functionName}`);
                }
              }
            }
          }
        }
      }
    }
    
    console.log('❌ Could not find Lambda function integration');
    
  } catch (error) {
    console.error('❌ Error finding production API:', error);
  }
}

findProductionAPI(); 