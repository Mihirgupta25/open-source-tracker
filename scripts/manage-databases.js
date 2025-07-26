#!/usr/bin/env node

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB();
const docClient = new AWS.DynamoDB.DocumentClient();

// Configuration
const TABLES = [
  'star-growth',
  'pr-velocity', 
  'issue-health',
  'package-downloads'
];

async function copyTableData(sourceEnv, targetEnv) {
  console.log(`🔄 Copying data from ${sourceEnv} to ${targetEnv} environment...`);
  
  for (const tableSuffix of TABLES) {
    const sourceTable = `${sourceEnv}-${tableSuffix}`;
    const targetTable = `${targetEnv}-${tableSuffix}`;
    
    console.log(`📋 Copying ${sourceTable} → ${targetTable}`);
    
    try {
      // Scan source table
      const scanParams = {
        TableName: sourceTable,
      };
      
      let items = [];
      let lastEvaluatedKey = undefined;
      
      do {
        if (lastEvaluatedKey) {
          scanParams.ExclusiveStartKey = lastEvaluatedKey;
        }
        
        const scanResult = await docClient.scan(scanParams).promise();
        items = items.concat(scanResult.Items);
        lastEvaluatedKey = scanResult.LastEvaluatedKey;
      } while (lastEvaluatedKey);
      
      console.log(`   Found ${items.length} items to copy`);
      
      if (items.length > 0) {
        // Write items to target table in batches
        const batchSize = 25; // DynamoDB batch write limit
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          const writeRequests = batch.map(item => ({
            PutRequest: { Item: item }
          }));
          
          await docClient.batchWrite({
            RequestItems: {
              [targetTable]: writeRequests
            }
          }).promise();
        }
        
        console.log(`   ✅ Copied ${items.length} items to ${targetTable}`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error copying ${sourceTable}:`, error.message);
    }
  }
  
  console.log('✅ Database copy completed!');
}

async function separateDatabases() {
  console.log('🔀 Separating dev and prod databases...');
  
  // First, copy dev data to prod tables
  await copyTableData('dev', 'prod');
  
  console.log('📝 Next steps:');
  console.log('1. Update infrastructure/bin/app.ts to set useSharedDatabase: false');
  console.log('2. Deploy both environments: npm run cdk:dev && npm run cdk:prod');
  console.log('3. Each environment will now use its own database tables');
}

async function showDatabaseStatus() {
  console.log('📊 Database Status:');
  
  for (const tableSuffix of TABLES) {
    for (const env of ['dev', 'prod']) {
      const tableName = `${env}-${tableSuffix}`;
      
      try {
        const result = await dynamodb.describeTable({ TableName: tableName }).promise();
        const itemCount = result.Table.ItemCount || 0;
        console.log(`   ${tableName}: ${itemCount} items`);
      } catch (error) {
        console.log(`   ${tableName}: ❌ Not found`);
      }
    }
  }
}

async function syncDatabases(sourceEnv = 'dev', targetEnv = 'prod') {
  console.log(`🔄 Syncing databases from ${sourceEnv} to ${targetEnv}...`);
  await copyTableData(sourceEnv, targetEnv);
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

(async () => {
  switch (command) {
    case 'status':
      await showDatabaseStatus();
      break;
      
    case 'separate':
      await separateDatabases();
      break;
      
    case 'sync':
      const sourceEnv = args[1] || 'dev';
      const targetEnv = args[2] || 'prod';
      await syncDatabases(sourceEnv, targetEnv);
      break;
      
    case 'copy':
      const fromEnv = args[1];
      const toEnv = args[2];
      if (!fromEnv || !toEnv) {
        console.log('Usage: node scripts/manage-databases.js copy <from-env> <to-env>');
        process.exit(1);
      }
      await copyTableData(fromEnv, toEnv);
      break;
      
    default:
      console.log('🗄️ Database Management Tool');
      console.log('');
      console.log('Usage:');
      console.log('  node scripts/manage-databases.js status                    # Show database status');
      console.log('  node scripts/manage-databases.js separate                  # Separate dev/prod databases');
      console.log('  node scripts/manage-databases.js sync [from] [to]         # Sync databases (default: dev→prod)');
      console.log('  node scripts/manage-databases.js copy <from> <to>         # Copy data between environments');
      console.log('');
      console.log('Examples:');
      console.log('  node scripts/manage-databases.js status');
      console.log('  node scripts/manage-databases.js separate');
      console.log('  node scripts/manage-databases.js sync dev prod');
      console.log('  node scripts/manage-databases.js copy prod dev');
      break;
  }
})(); 