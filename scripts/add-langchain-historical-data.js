const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

const historicalData = [
  { date: '1969-12-31T16:00:00.000Z', stars: 0 },
  { date: '1970-04-14T15:46:03.000Z', stars: 5280 },
  { date: '1970-05-08T11:11:00.000Z', stars: 7950 },
  { date: '1970-05-22T15:27:23.000Z', stars: 10620 },
  { date: '1970-05-30T09:21:49.000Z', stars: 13290 },
  { date: '1970-06-04T18:16:42.000Z', stars: 15960 },
  { date: '1970-06-10T12:44:24.000Z', stars: 18630 },
  { date: '1970-06-15T06:54:53.000Z', stars: 21270 },
  { date: '1970-06-20T10:17:14.000Z', stars: 23940 },
  { date: '1970-06-26T06:01:02.000Z', stars: 26610 },
  { date: '1970-07-02T11:51:26.000Z', stars: 29280 },
  { date: '1970-07-10T14:42:44.000Z', stars: 31950 },
  { date: '1970-07-17T09:26:10.000Z', stars: 34620 },
  { date: '1970-07-25T00:19:39.000Z', stars: 37290 },
  { date: '1970-08-03T11:08:14.000Z', stars: 39960 },
  { date: '1972-10-13T09:48:41.000Z', stars: 113005 }
];

async function addLangchainHistoricalData() {
  console.log('🚀 Add Langchain Historical Data to Staging');
  console.log('==========================================');
  console.log('📤 Adding historical langchain-ai/langchain data to staging...');
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
addLangchainHistoricalData().catch(console.error); 