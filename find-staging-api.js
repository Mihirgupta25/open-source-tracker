const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

async function findStagingAPI() {
  console.log('🔍 Finding staging API Lambda function...\n');

  const lambda = new AWS.Lambda();

  try {
    // List all Lambda functions
    console.log('📋 Listing all Lambda functions...');
    const functions = await lambda.listFunctions().promise();
    
    // Filter for staging API functions
    const stagingFunctions = functions.Functions.filter(func => 
      func.FunctionName.includes('Staging') && 
      (func.FunctionName.includes('API') || func.FunctionName.includes('Function'))
    );
    
    console.log(`📊 Found ${stagingFunctions.length} staging API functions:`);
    
    stagingFunctions.forEach((func, index) => {
      console.log(`\n${index + 1}. Function: ${func.FunctionName}`);
      console.log(`   Runtime: ${func.Runtime}`);
      console.log(`   Description: ${func.Description || 'No description'}`);
      console.log(`   Last Modified: ${func.LastModified}`);
    });

    // Also check for any functions with 'staging' in the name
    const allStagingFunctions = functions.Functions.filter(func => 
      func.FunctionName.toLowerCase().includes('staging')
    );
    
    console.log(`\n📊 All functions with 'staging' in name (${allStagingFunctions.length}):`);
    allStagingFunctions.forEach((func, index) => {
      console.log(`\n${index + 1}. Function: ${func.FunctionName}`);
      console.log(`   Runtime: ${func.Runtime}`);
      console.log(`   Description: ${func.Description || 'No description'}`);
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

findStagingAPI().catch(console.error); 