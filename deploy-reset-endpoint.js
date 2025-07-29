const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const lambda = new AWS.Lambda();

async function deployResetEndpoint() {
  try {
    console.log('🚀 Deploying updated Lambda function with reset endpoint...');
    
    // Create deployment package
    console.log('📦 Creating deployment package...');
    const output = fs.createWriteStream('lambda-deployment.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', async () => {
      console.log('✅ Deployment package created');
      
      const code = fs.readFileSync('lambda-deployment.zip');
      
      // Update the Lambda function
      const updateParams = {
        FunctionName: 'OpenSourceTrackerProdV2-APIFunction49CD189B-LbGDRrjsshUt',
        ZipFile: code
      };
      
      const result = await lambda.updateFunctionCode(updateParams).promise();
      console.log('✅ Lambda function updated successfully!');
      console.log('Function ARN:', result.FunctionArn);
      console.log('Last modified:', result.LastModified);
      
      // Wait a moment for the update to propagate
      console.log('⏳ Waiting for update to propagate...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      console.log('🎉 Reset endpoint is now available at:');
      console.log('POST https://fwaonagbbh.execute-api.us-east-1.amazonaws.com/prod/api/reset-staging-data');
      
      // Clean up
      fs.unlinkSync('lambda-deployment.zip');
      console.log('🧹 Cleaned up deployment package');
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);
    
    // Add the Lambda function code
    archive.file(path.join(__dirname, 'backend', 'lambda-index.js'), { name: 'lambda-index.js' });
    
    // Add package.json if it exists
    const packageJsonPath = path.join(__dirname, 'backend', 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      archive.file(packageJsonPath, { name: 'package.json' });
    }
    
    // Add node_modules if it exists
    const nodeModulesPath = path.join(__dirname, 'backend', 'node_modules');
    if (fs.existsSync(nodeModulesPath)) {
      archive.directory(nodeModulesPath, 'node_modules');
    }
    
    archive.finalize();
    
  } catch (error) {
    console.error('❌ Error deploying reset endpoint:', error);
    if (error.code === 'ResourceNotFoundException') {
      console.log('💡 Make sure the Lambda function name is correct');
    }
  }
}

deployResetEndpoint(); 