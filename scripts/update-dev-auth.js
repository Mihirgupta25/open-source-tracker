#!/usr/bin/env node

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const secretsManager = new AWS.SecretsManager();

const AUTH_FILE = path.join(__dirname, '../infrastructure/lambda-edge/auth-function.js');
const DEFAULT_PASSWORD = 'tracker2024';

async function updateDevAuth() {
  try {
    console.log('🔐 Updating staging environment authentication...');
    
    // Get credentials from AWS Secrets Manager
    let credentials;
    try {
      const secretData = await secretsManager.getSecretValue({ SecretId: 'staging-credentials' }).promise();
      credentials = JSON.parse(secretData.SecretString);
      console.log('✅ Retrieved credentials from AWS Secrets Manager');
    } catch (error) {
      console.log('⚠️  Could not retrieve from Secrets Manager, using default credentials');
      credentials = {
        username: 'dev',
        password: DEFAULT_PASSWORD
      };
    }

    // Read the current auth function
    let authFunctionContent = fs.readFileSync(AUTH_FILE, 'utf8');
    
    // Update the credentials in the function
    const updatedContent = authFunctionContent.replace(
      /username: process\.env\.DEV_USERNAME \|\| 'dev',\s+password: process\.env\.DEV_PASSWORD \|\| 'default_password'/,
      `username: '${credentials.username}',\n    password: '${credentials.password}'`
    );
    
    // Write the updated content back
    fs.writeFileSync(AUTH_FILE, updatedContent);
    
    console.log('✅ Updated auth function with credentials');
    console.log(`📝 Username: ${credentials.username}`);
    console.log(`🔑 Password: ${credentials.password}`);
    
  } catch (error) {
    console.error('❌ Error updating dev auth:', error);
    process.exit(1);
  }
}

// Run the update
updateDevAuth(); 