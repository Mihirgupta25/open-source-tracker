#!/usr/bin/env node

const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const secretsManager = new AWS.SecretsManager();

async function setupDevCredentials() {
  try {
    console.log('🔐 Setting up staging environment credentials in AWS Secrets Manager...');
    
    // Default credentials
    const credentials = {
      username: 'dev',
      password: 'tracker2024'
    };
    
    // Check if secret already exists
    try {
      await secretsManager.describeSecret({ SecretId: 'staging-credentials' }).promise();
      console.log('⚠️  Secret already exists, updating...');
      
      // Update existing secret
      await secretsManager.updateSecret({
        SecretId: 'staging-credentials',
        SecretString: JSON.stringify(credentials)
      }).promise();
      
      console.log('✅ Updated existing staging credentials secret');
    } catch (error) {
      if (error.code === 'ResourceNotFoundException') {
        console.log('📝 Creating new staging credentials secret...');
        
        // Create new secret
        await secretsManager.createSecret({
          Name: 'staging-credentials',
          Description: 'Staging environment credentials for Open Source Tracker',
          SecretString: JSON.stringify(credentials)
        }).promise();
        
        console.log('✅ Created new staging credentials secret');
      } else {
        throw error;
      }
    }
    
    console.log('📝 Credentials stored:');
    console.log(`   Username: ${credentials.username}`);
    console.log(`   Password: ${credentials.password}`);
    console.log('');
    console.log('🔄 Next steps:');
    console.log('   1. Deploy the staging environment: npm run cdk:staging');
    console.log('   2. The credentials will be automatically updated during deployment');
    
  } catch (error) {
    console.error('❌ Error setting up dev credentials:', error);
    process.exit(1);
  }
}

// Run the setup
setupDevCredentials(); 