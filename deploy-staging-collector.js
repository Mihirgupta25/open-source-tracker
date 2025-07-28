const AWS = require('aws-sdk');
const fs = require('fs');
const archiver = require('archiver');

// Configure AWS
AWS.config.update({
  region: 'us-east-1'
});

// Initialize AWS services
const lambda = new AWS.Lambda();

// Configuration for staging
const FUNCTION_NAME = 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc';

// Create deployment package
async function createDeploymentPackage() {
  console.log('📦 Creating deployment package for staging...');
  
  const output = fs.createWriteStream('lambda-star-collector-staging.zip');
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  return new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log('✅ Staging deployment package created');
      resolve();
    });
    
    archive.on('error', (err) => {
      reject(err);
    });
    
    archive.pipe(output);
    
    // Add the Lambda function (no external dependencies needed)
    archive.file('lambda-star-collector-staging.js', { name: 'index.js' });
    
    archive.finalize();
  });
}

// Update Lambda function
async function updateLambdaFunction() {
  console.log('🚀 Updating staging Lambda function...');
  
  const zipBuffer = fs.readFileSync('lambda-star-collector-staging.zip');
  
  try {
    // Update function code
    await lambda.updateFunctionCode({
      FunctionName: FUNCTION_NAME,
      ZipFile: zipBuffer
    }).promise();
    
    console.log('✅ Staging Lambda function code updated');
    
    // Update function configuration
    await lambda.updateFunctionConfiguration({
      FunctionName: FUNCTION_NAME,
      Handler: 'index.handler',
      Description: 'Star collection Lambda function for staging - runs every 3 hours starting at 12:00 PM PDT',
      Timeout: 30,
      MemorySize: 256,
      Environment: {
        Variables: {
          ENVIRONMENT: 'staging',
          STAR_GROWTH_TABLE: 'dev-star-growth',
          GITHUB_TOKEN_SECRET_NAME: 'github-token-dev'
        }
      }
    }).promise();
    
    console.log('✅ Staging Lambda function configuration updated');
    
  } catch (error) {
    console.error('❌ Error updating staging Lambda function:', error);
    throw error;
  }
}

// Update EventBridge rule for staging
async function updateEventBridgeRule() {
  console.log('⏰ Updating EventBridge rule for staging...');
  
  const events = new AWS.EventBridge();
  const RULE_NAME = 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc';
  
  try {
    // Update rule with new schedule
    await events.putRule({
      Name: RULE_NAME,
      Description: 'Schedule for star collection every 3 hours starting at 12:00 PM PDT (staging)',
      ScheduleExpression: 'cron(0 12,15,18,21,0,3,6,9 * * ? *)',
      State: 'ENABLED'
    }).promise();
    
    console.log('✅ Staging EventBridge rule updated');
    
  } catch (error) {
    console.error('❌ Error updating staging EventBridge rule:', error);
    throw error;
  }
}

// Main deployment function
async function deploy() {
  try {
    console.log('🚀 Starting staging deployment for star collection...');
    
    // Create deployment package
    await createDeploymentPackage();
    
    // Update Lambda function
    await updateLambdaFunction();
    
    // Update EventBridge rule
    await updateEventBridgeRule();
    
    console.log('🎉 Staging deployment completed successfully!');
    console.log('📊 Staging Lambda function:', FUNCTION_NAME);
    console.log('💡 The staging star collection will now run every 3 hours starting at 12:00 PM PDT');
    
  } catch (error) {
    console.error('❌ Staging deployment failed:', error);
    throw error;
  }
}

// Run deployment
deploy()
  .then(() => {
    console.log('✅ Staging deployment completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Staging deployment failed:', error);
    process.exit(1);
  }); 