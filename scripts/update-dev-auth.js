#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const AUTH_FILE = path.join(__dirname, '../infrastructure/lambda-edge/auth-function.js');
const DEFAULT_USERNAME = 'dev';
const DEFAULT_PASSWORD = 'tracker2024';

function updateCredentials(username = DEFAULT_USERNAME, password = DEFAULT_PASSWORD) {
  console.log('🔐 Updating Dev Environment Authentication');
  console.log(`Username: ${username}`);
  console.log(`Password: ${password}`);
  
  // Read the current auth function
  let authCode = fs.readFileSync(AUTH_FILE, 'utf8');
  
  // Update the credentials in the code
  authCode = authCode.replace(
    /username === '([^']+)'/,
    `username === '${username}'`
  );
  authCode = authCode.replace(
    /password === '([^']+)'/,
    `password === '${password}'`
  );
  
  // Update the comment
  authCode = authCode.replace(
    /\/\/ Username: [^\n]+/,
    `// Username: ${username}`
  );
  authCode = authCode.replace(
    /\/\/ Password: [^\n]+/,
    `// Password: ${password}`
  );
  
  // Write the updated code
  fs.writeFileSync(AUTH_FILE, authCode);
  
  console.log('✅ Authentication credentials updated!');
  console.log('🔄 You need to redeploy the dev environment for changes to take effect:');
  console.log('   npm run cdk:dev');
}

function showCurrentCredentials() {
  const authCode = fs.readFileSync(AUTH_FILE, 'utf8');
  const usernameMatch = authCode.match(/username === '([^']+)'/);
  const passwordMatch = authCode.match(/password === '([^']+)'/);
  
  if (usernameMatch && passwordMatch) {
    console.log('🔐 Current Dev Environment Credentials:');
    console.log(`Username: ${usernameMatch[1]}`);
    console.log(`Password: ${passwordMatch[1]}`);
  } else {
    console.log('❌ Could not find current credentials');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'update':
    const username = args[1] || DEFAULT_USERNAME;
    const password = args[2] || DEFAULT_PASSWORD;
    updateCredentials(username, password);
    break;
    
  case 'show':
    showCurrentCredentials();
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
    break;
} 