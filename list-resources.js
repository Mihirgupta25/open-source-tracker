const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const cloudformation = new AWS.CloudFormation();

async function listResources() {
  console.log('📋 Listing CloudFormation resources...\n');
  
  try {
    const stackResources = await cloudformation.listStackResources({
      StackName: 'OpenSourceTrackerDev'
    }).promise();
    
    console.log('All resources:');
    stackResources.StackResourceSummaries.forEach(resource => {
      console.log(`- ${resource.LogicalResourceId} (${resource.ResourceType}): ${resource.PhysicalResourceId}`);
    });
    
  } catch (error) {
    console.error('❌ Error listing resources:', error.message);
  }
}

listResources(); 