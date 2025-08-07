const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const historicalData = [
  { date: '2022-10-25T00:59:28.000Z', stars: 0 },
  { date: '2023-02-05T23:45:31.000Z', stars: 5280 },
  { date: '2023-03-01T18:10:28.000Z', stars: 7950 },
  { date: '2023-03-15T23:26:51.000Z', stars: 10620 },
  { date: '2023-03-23T17:21:17.000Z', stars: 13290 },
  { date: '2023-03-29T02:16:10.000Z', stars: 15960 },
  { date: '2023-04-03T20:43:52.000Z', stars: 18630 },
  { date: '2023-04-08T14:54:21.000Z', stars: 21270 },
  { date: '2023-04-13T18:16:42.000Z', stars: 23940 },
  { date: '2023-04-19T14:00:30.000Z', stars: 26610 },
  { date: '2023-04-25T19:50:54.000Z', stars: 29280 },
  { date: '2023-05-03T22:42:12.000Z', stars: 31950 },
  { date: '2023-05-10T17:25:38.000Z', stars: 34620 },
  { date: '2023-05-18T08:19:07.000Z', stars: 37290 },
  { date: '2023-05-27T19:07:42.000Z', stars: 39960 },
  { date: '2025-08-06T17:48:09.000Z', stars: 113005 }
];

async function addCorrectLangchainData() {
  console.log('🚀 Add Correct Langchain Historical Data to Staging');
  console.log('==================================================');
  console.log('📤 Adding correct historical langchain-ai/langchain data to staging...');
  console.log(`📊 Adding to staging-star-growth...`);

  const tableName = 'staging-star-growth';
  const repo = 'langchain-ai/langchain';
  let successCount = 0;
  let errorCount = 0;

  for (const dataPoint of historicalData) {
    try {
      const item = {
        repo: repo,
        timestamp: dataPoint.date,
        count: dataPoint.stars
      };

      await dynamodb.put({
        TableName: tableName,
        Item: item
      }).promise();

      console.log(`✅ Added: ${dataPoint.date} - ${dataPoint.stars} stars`);
      successCount++;
    } catch (error) {
      console.error(`❌ Error adding ${dataPoint.date}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`✅ Successfully added: ${successCount} data points`);
  if (errorCount > 0) {
    console.log(`❌ Errors: ${errorCount} data points`);
  }
  console.log('✅ Data addition completed!');
}

// Run the script
addCorrectLangchainData().catch(console.error); 