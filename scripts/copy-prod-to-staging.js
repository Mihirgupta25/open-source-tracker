const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Table mappings with their sort key names
const tableMappings = {
  'prod-star-growth': { staging: 'staging-star-growth', sortKey: 'timestamp' },
  'prod-pr-velocity': { staging: 'staging-pr-velocity', sortKey: 'date' },
  'prod-issue-health': { staging: 'staging-issue-health', sortKey: 'date' },
  'prod-package-downloads': { staging: 'staging-package-downloads', sortKey: 'week_start' }
};

// Repositories to copy
const repositories = ['promptfoo/promptfoo', 'crewAIInc/crewAI', 'langchain-ai/langchain'];

async function clearStagingTable(tableName, sortKeyName) {
  console.log(`Clearing staging table: ${tableName}`);
  
  try {
    // Scan all items in the staging table
    const scanParams = {
      TableName: tableName
    };
    
    const scanResult = await dynamodb.scan(scanParams).promise();
    
    if (scanResult.Items.length === 0) {
      console.log(`  No items to delete in ${tableName}`);
      return 0;
    }
    
    // Delete items in batches of 25 (DynamoDB limit)
    const deletePromises = [];
    for (let i = 0; i < scanResult.Items.length; i += 25) {
      const batch = scanResult.Items.slice(i, i + 25);
      const deleteParams = {
        RequestItems: {
          [tableName]: batch.map(item => {
            const deleteRequest = {
              DeleteRequest: {
                Key: {
                  repo: item.repo
                }
              }
            };
            
            // Add sort key if it exists
            if (item[sortKeyName]) {
              deleteRequest.DeleteRequest.Key[sortKeyName] = item[sortKeyName];
            }
            
            return deleteRequest;
          })
        }
      };
      deletePromises.push(dynamodb.batchWrite(deleteParams).promise());
    }
    
    await Promise.all(deletePromises);
    console.log(`  Deleted ${scanResult.Items.length} items from ${tableName}`);
    return scanResult.Items.length;
  } catch (error) {
    console.error(`  Error clearing ${tableName}:`, error);
    throw error;
  }
}

async function copyFromProduction(prodTable, stagingTable, repo, sortKeyName) {
  console.log(`Copying data for ${repo} from ${prodTable} to ${stagingTable}`);
  
  try {
    // Query production table for this repository
    const queryParams = {
      TableName: prodTable,
      KeyConditionExpression: 'repo = :repo',
      ExpressionAttributeValues: {
        ':repo': repo
      }
    };
    
    const result = await dynamodb.query(queryParams).promise();
    
    if (result.Items.length === 0) {
      console.log(`  No data found for ${repo} in ${prodTable}`);
      return 0;
    }
    
    // Write items to staging table in batches
    const writePromises = [];
    for (let i = 0; i < result.Items.length; i += 25) {
      const batch = result.Items.slice(i, i + 25);
      const writeParams = {
        RequestItems: {
          [stagingTable]: batch.map(item => ({
            PutRequest: {
              Item: item
            }
          }))
        }
      };
      writePromises.push(dynamodb.batchWrite(writeParams).promise());
    }
    
    await Promise.all(writePromises);
    console.log(`  Copied ${result.Items.length} items for ${repo} from ${prodTable} to ${stagingTable}`);
    return result.Items.length;
  } catch (error) {
    console.error(`  Error copying data for ${repo} from ${prodTable}:`, error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting production to staging data copy...\n');
  
  let totalCleared = 0;
  let totalCopied = 0;
  
  try {
    // Step 1: Clear all staging tables
    console.log('📋 Step 1: Clearing staging tables...');
    for (const [prodTable, tableInfo] of Object.entries(tableMappings)) {
      const cleared = await clearStagingTable(tableInfo.staging, tableInfo.sortKey);
      totalCleared += cleared;
    }
    console.log(`✅ Cleared ${totalCleared} total items from staging tables\n`);
    
    // Step 2: Copy data from production to staging
    console.log('📋 Step 2: Copying data from production to staging...');
    for (const [prodTable, tableInfo] of Object.entries(tableMappings)) {
      for (const repo of repositories) {
        const copied = await copyFromProduction(prodTable, tableInfo.staging, repo, tableInfo.sortKey);
        totalCopied += copied;
      }
    }
    console.log(`✅ Copied ${totalCopied} total items from production to staging\n`);
    
    console.log('🎉 Data copy completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Items cleared from staging: ${totalCleared}`);
    console.log(`   - Items copied from production: ${totalCopied}`);
    console.log(`   - Repositories processed: ${repositories.join(', ')}`);
    
  } catch (error) {
    console.error('❌ Error during data copy:', error);
    process.exit(1);
  }
}

// Run the script
main(); 