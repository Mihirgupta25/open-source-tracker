const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  region: 'us-east-1'
});

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Environment variables - you can change these as needed
const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
const STAR_GROWTH_TABLE = process.env.STAR_GROWTH_TABLE || `${ENVIRONMENT}-star-growth`;
const REPO = process.env.REPO || 'promptfoo/promptfoo';

// Manual entry data
const manualEntry = {
  repo: REPO,
  timestamp: 'July 28, 2025', // 12:00 AM PST on July 28th, 2025
  count: 7739 // Current star count as of July 28th, 2025
};

async function addManualEntry() {
  const params = {
    TableName: STAR_GROWTH_TABLE,
    Item: manualEntry
  };

  try {
    console.log(`Adding manual entry to ${STAR_GROWTH_TABLE}...`);
    console.log('Entry data:', manualEntry);
    
    await dynamodb.put(params).promise();
    
    console.log('✅ Successfully added manual entry!');
    console.log(`📊 Repository: ${manualEntry.repo}`);
    console.log(`📅 Timestamp: ${manualEntry.timestamp}`);
    console.log(`⭐ Star Count: ${manualEntry.count}`);
    
  } catch (error) {
    console.error('❌ Error adding manual entry:', error);
    throw error;
  }
}

// Run the function
addManualEntry()
  .then(() => {
    console.log('🎉 Manual entry completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Manual entry failed:', error);
    process.exit(1);
  }); 