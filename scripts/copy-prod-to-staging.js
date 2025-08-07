const AWS = require('aws-sdk');
const fs = require('fs');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Function to convert DynamoDB low-level format to plain objects
function convertDynamoDBItem(item) {
  const converted = {};
  
  for (const [key, value] of Object.entries(item)) {
    if (value.S) {
      converted[key] = value.S;
    } else if (value.N) {
      converted[key] = parseFloat(value.N);
    } else if (value.BOOL !== undefined) {
      converted[key] = value.BOOL;
    } else if (value.NULL) {
      converted[key] = null;
    } else if (value.L) {
      converted[key] = value.L.map(convertDynamoDBItem);
    } else if (value.M) {
      converted[key] = convertDynamoDBItem(value.M);
    } else {
      converted[key] = value;
    }
  }
  
  return converted;
}

async function copyTableData(sourceTable, targetTable, dataFile) {
  try {
    console.log(`📊 Copying data from ${sourceTable} to ${targetTable}...`);
    
    // Read the exported data
    const rawData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    console.log(`📊 Found ${rawData.length} items to copy`);
    
    if (rawData.length === 0) {
      console.log(`⚠️ No data found in ${sourceTable}`);
      return;
    }
    
    // Convert DynamoDB low-level format to plain objects
    const data = rawData.map(convertDynamoDBItem);
    console.log(`📊 Converted ${data.length} items to plain format`);
    
    // Process items in batches of 25 (DynamoDB batch limit)
    const batchSize = 25;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      const writeRequests = batch.map(item => ({
        PutRequest: {
          Item: item
        }
      }));
      
      const params = {
        RequestItems: {
          [targetTable]: writeRequests
        }
      };
      
      try {
        await dynamodb.batchWrite(params).promise();
        console.log(`✅ Copied batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(data.length / batchSize)} (${batch.length} items)`);
      } catch (error) {
        console.error(`❌ Error copying batch ${Math.floor(i / batchSize) + 1}:`, error);
        throw error;
      }
    }
    
    console.log(`✅ Successfully copied all data from ${sourceTable} to ${targetTable}`);
  } catch (error) {
    console.error(`❌ Error copying data from ${sourceTable} to ${targetTable}:`, error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting data copy from production to staging...');
    
    // Copy each table
    await copyTableData('prod-star-growth', 'staging-star-growth', 'prod-star-growth-data.json');
    await copyTableData('prod-pr-velocity', 'staging-pr-velocity', 'prod-pr-velocity-data.json');
    await copyTableData('prod-issue-health', 'staging-issue-health', 'prod-issue-health-data.json');
    await copyTableData('prod-package-downloads', 'staging-package-downloads', 'prod-package-downloads-data.json');
    await copyTableData('prod-repositories', 'staging-repositories', 'prod-repositories-data.json');
    
    console.log('🎉 All data successfully copied from production to staging!');
    
    // Clean up temporary files
    const files = [
      'prod-star-growth-data.json',
      'prod-pr-velocity-data.json', 
      'prod-issue-health-data.json',
      'prod-package-downloads-data.json',
      'prod-repositories-data.json'
    ];
    
    files.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`🗑️ Cleaned up ${file}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error in main:', error);
    process.exit(1);
  }
}

main(); 