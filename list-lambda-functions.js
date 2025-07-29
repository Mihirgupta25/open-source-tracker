const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const lambda = new AWS.Lambda();

async function listLambdaFunctions() {
  try {
    console.log('🔍 Listing all Lambda functions...\n');
    
    const functions = await lambda.listFunctions().promise();
    
    console.log(`📊 Found ${functions.Functions.length} Lambda functions:\n`);
    
    for (const func of functions.Functions) {
      console.log(`📋 Function: ${func.FunctionName}`);
      console.log(`   Runtime: ${func.Runtime}`);
      console.log(`   Handler: ${func.Handler}`);
      console.log(`   Description: ${func.Description || 'No description'}`);
      console.log(`   Last modified: ${func.LastModified}`);
      
      // Check if this looks like an API function
      if (func.FunctionName.includes('API') || func.FunctionName.includes('Function')) {
        console.log(`   🎯 This looks like an API function!`);
      }
      
      console.log('');
    }
    
    // Look for functions that might be the API handler
    console.log('🎯 Potential API functions:');
    const apiFunctions = functions.Functions.filter(func => 
      func.FunctionName.includes('API') || 
      func.FunctionName.includes('Function') ||
      func.FunctionName.includes('prod') ||
      func.FunctionName.includes('staging')
    );
    
    for (const func of apiFunctions) {
      console.log(`   - ${func.FunctionName} (${func.Handler})`);
    }
    
  } catch (error) {
    console.error('❌ Error listing Lambda functions:', error);
  }
}

listLambdaFunctions(); 