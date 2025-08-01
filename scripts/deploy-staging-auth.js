#!/usr/bin/env node

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const secretsManager = new AWS.SecretsManager();
const lambda = new AWS.Lambda();

const AUTH_FUNCTION_NAME = 'OpenSourceTrackerStagingV3-AuthFunctionA1CD5E0F-9CvCUUBy2Hkn';

async function deployStagingAuth() {
  try {
    console.log('🔐 Deploying staging authentication with secure credentials...');
    
    // Get credentials from AWS Secrets Manager
    const secretData = await secretsManager.getSecretValue({ SecretId: 'staging-credentials' }).promise();
    const credentials = JSON.parse(secretData.SecretString);
    
    console.log('✅ Retrieved credentials from AWS Secrets Manager');
    console.log(`📝 Username: ${credentials.username}`);
    console.log(`🔑 Password: ${credentials.password.replace(/./g, '*')}`);
    
    // Create zip file with updated auth function
    const authFunctionPath = path.join(__dirname, '../infrastructure/lambda-edge/auth-function.js');
    const zipPath = path.join(__dirname, 'auth-function.zip');
    
    // Create zip file
    const archiver = require('archiver');
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', async () => {
      console.log('📦 Created auth function zip file');
      
      try {
        // Update Lambda function code
        const zipBuffer = fs.readFileSync(zipPath);
        await lambda.updateFunctionCode({
          FunctionName: AUTH_FUNCTION_NAME,
          ZipFile: zipBuffer
        }).promise();
        
        console.log('✅ Updated Lambda function code');
        
        // Wait a moment for the code update to complete
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Update Lambda function configuration with environment variables
        try {
          await lambda.updateFunctionConfiguration({
            FunctionName: AUTH_FUNCTION_NAME,
            Environment: {
              Variables: {
                STAGING_USERNAME: credentials.username,
                STAGING_PASSWORD: credentials.password
              }
            }
          }).promise();
          
          console.log('✅ Updated Lambda function environment variables');
        } catch (configError) {
          console.log('⚠️  Could not update environment variables immediately, will retry...');
          await new Promise(resolve => setTimeout(resolve, 30000));
          
          await lambda.updateFunctionConfiguration({
            FunctionName: AUTH_FUNCTION_NAME,
            Environment: {
              Variables: {
                STAGING_USERNAME: credentials.username,
                STAGING_PASSWORD: credentials.password
              }
            }
          }).promise();
          
          console.log('✅ Updated Lambda function environment variables (retry successful)');
        }
        
        // Publish new version
        const versionResponse = await lambda.publishVersion({
          FunctionName: AUTH_FUNCTION_NAME,
          Description: 'Secure credentials from Secrets Manager'
        }).promise();
        
        console.log(`✅ Published new version: ${versionResponse.Version}`);
        
        // Update CloudFront distribution
        await updateCloudFrontDistribution(versionResponse.FunctionArn);
        
        // Clean up
        fs.unlinkSync(zipPath);
        console.log('🧹 Cleaned up temporary files');
        
        console.log('🎉 Staging authentication deployed successfully!');
        console.log('🌐 Staging URL: https://d1j9ixntt6x51n.cloudfront.net');
        console.log(`🔐 Username: ${credentials.username}`);
        console.log(`🔑 Password: ${credentials.password.replace(/./g, '*')}`);
        
      } catch (error) {
        console.error('❌ Error updating Lambda function:', error);
        process.exit(1);
      }
    });
    
    archive.pipe(output);
    archive.file(authFunctionPath, { name: 'auth-function.js' });
    archive.finalize();
    
  } catch (error) {
    console.error('❌ Error deploying staging auth:', error);
    process.exit(1);
  }
}

async function updateCloudFrontDistribution(functionArn) {
  try {
    console.log('🌐 Updating CloudFront distribution...');
    
    // Get current distribution config
    const cloudfront = new AWS.CloudFront();
    const distributionId = 'E2ZUSLRM9KYVOO';
    
    const configResponse = await cloudfront.getDistributionConfig({ Id: distributionId }).promise();
    const config = configResponse.DistributionConfig;
    const etag = configResponse.ETag;
    
    // Update Lambda function ARN
    config.DefaultCacheBehavior.LambdaFunctionAssociations.Items[0].LambdaFunctionARN = functionArn;
    
    // Update distribution
    await cloudfront.updateDistribution({
      Id: distributionId,
      DistributionConfig: config,
      IfMatch: etag
    }).promise();
    
    console.log('✅ Updated CloudFront distribution');
    
  } catch (error) {
    console.error('❌ Error updating CloudFront distribution:', error);
    throw error;
  }
}

// Run the deployment
deployStagingAuth(); 