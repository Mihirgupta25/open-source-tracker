#!/usr/bin/env node

const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();

// Configuration
const DEFAULT_USERNAME = 'dev';
const DEFAULT_PASSWORD = 'tracker2024';
const SECRET_NAME = 'dev-dev-auth-credentials';

async function updateCredentials(username = DEFAULT_USERNAME, password = DEFAULT_PASSWORD) {
  console.log('🔐 Updating Dev Environment Authentication in AWS Secrets Manager');
  console.log(`Username: ${username}`);
  console.log(`Password: ${password}`);
  
  try {
    // Update the secret in AWS Secrets Manager
    await secretsManager.updateSecret({
      SecretId: SECRET_NAME,
      SecretString: JSON.stringify({ username, password }),
    }).promise();
    
    console.log('✅ Authentication credentials updated in AWS Secrets Manager!');
    console.log('🔄 The changes will take effect immediately for new requests.');
    console.log('📝 Note: Existing browser sessions may need to re-authenticate.');
  } catch (error) {
    console.error('❌ Error updating credentials:', error.message);
    console.log('💡 Make sure the dev environment is deployed first: npm run cdk:dev');
  }
}

async function showCurrentCredentials() {
  try {
    const data = await secretsManager.getSecretValue({ SecretId: SECRET_NAME }).promise();
    const secret = JSON.parse(data.SecretString);
    
    console.log('🔐 Current Dev Environment Credentials:');
    console.log(`Username: ${secret.username}`);
    console.log(`Password: ${secret.password}`);
  } catch (error) {
    console.error('❌ Error fetching credentials:', error.message);
    console.log('💡 Make sure the dev environment is deployed first: npm run cdk:dev');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

(async () => {
  switch (command) {
    case 'update':
      const username = args[1] || DEFAULT_USERNAME;
      const password = args[2] || DEFAULT_PASSWORD;
      await updateCredentials(username, password);
      break;
      
    case 'show':
      await showCurrentCredentials();
      break;
      
    default:
      console.log('🔐 Dev Environment Authentication Manager');
      console.log('');
      console.log('Usage:');
      console.log('  node scripts/update-dev-auth.js show                    # Show current credentials');
      console.log('  node scripts/update-dev-auth.js update                 # Update with default credentials');
      console.log('  node scripts/update-dev-auth.js update <user> <pass>   # Update with custom credentials');
      console.log('');
      console.log('Default credentials:');
      console.log(`  Username: ${DEFAULT_USERNAME}`);
      console.log(`  Password: ${DEFAULT_PASSWORD}`);
      console.log('');
      console.log('🔒 Credentials are now stored securely in AWS Secrets Manager');
      break;
  }
})(); 