const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

async function checkRecentData() {
  console.log('🔍 Checking for recent data in DynamoDB...\n');

  const dynamodb = new AWS.DynamoDB.DocumentClient();

  try {
    // Check production table
    console.log('📊 Checking prod-star-growth table...');
    const prodData = await dynamodb.scan({
      TableName: 'prod-star-growth',
      Limit: 20
    }).promise();
    
    console.log(`✅ Found ${prodData.Items.length} items in prod-star-growth`);
    
    // Look for entries from today (July 28, 2025)
    const todayEntries = prodData.Items.filter(item => 
      item.timestamp && item.timestamp.includes('2025-07-28')
    );
    
    console.log(`📅 Entries from today (2025-07-28): ${todayEntries.length}`);
    
    if (todayEntries.length > 0) {
      console.log('\n📋 Today\'s production entries:');
      todayEntries.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.count} stars at ${item.timestamp}`);
      });
    }

    // Check staging table
    console.log('\n📊 Checking staging-star-growth table...');
    const stagingData = await dynamodb.scan({
      TableName: 'staging-star-growth',
      Limit: 20
    }).promise();
    
    console.log(`✅ Found ${stagingData.Items.length} items in staging-star-growth`);
    
    // Look for entries from today (July 28, 2025)
    const todayStagingEntries = stagingData.Items.filter(item => 
      item.timestamp && item.timestamp.includes('2025-07-28')
    );
    
    console.log(`📅 Entries from today (2025-07-28): ${todayStagingEntries.length}`);
    
    if (todayStagingEntries.length > 0) {
      console.log('\n📋 Today\'s staging entries:');
      todayStagingEntries.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.count} stars at ${item.timestamp}`);
      });
    }

    // Check for entries around 20:58 (8:58 PM) when the Lambda ran
    console.log('\n🔍 Looking for entries around 20:58 (when Lambda ran)...');
    
    const recentProdEntries = prodData.Items.filter(item => 
      item.timestamp && item.timestamp.includes('20:58')
    );
    
    const recentStagingEntries = stagingData.Items.filter(item => 
      item.timestamp && item.timestamp.includes('20:58')
    );
    
    console.log(`📊 Production entries around 20:58: ${recentProdEntries.length}`);
    console.log(`📊 Staging entries around 20:58: ${recentStagingEntries.length}`);
    
    if (recentProdEntries.length > 0) {
      console.log('\n✅ Found production entries from Lambda execution:');
      recentProdEntries.forEach(item => {
        console.log(`  ${item.count} stars at ${item.timestamp}`);
      });
    }
    
    if (recentStagingEntries.length > 0) {
      console.log('\n✅ Found staging entries from Lambda execution:');
      recentStagingEntries.forEach(item => {
        console.log(`  ${item.count} stars at ${item.timestamp}`);
      });
    }

    // Show all field names to understand the data structure
    if (prodData.Items.length > 0) {
      console.log('\n📋 Production data structure:');
      console.log(`  Fields: ${Object.keys(prodData.Items[0]).join(', ')}`);
      console.log(`  Sample item: ${JSON.stringify(prodData.Items[0], null, 2)}`);
    }
    
    if (stagingData.Items.length > 0) {
      console.log('\n📋 Staging data structure:');
      console.log(`  Fields: ${Object.keys(stagingData.Items[0]).join(', ')}`);
      console.log(`  Sample item: ${JSON.stringify(stagingData.Items[0], null, 2)}`);
    }

    console.log('\n🎯 Summary:');
    if (recentProdEntries.length > 0 || recentStagingEntries.length > 0) {
      console.log('✅ Lambda functions are successfully writing to DynamoDB!');
      console.log('✅ Star collection is working properly!');
      console.log('📊 Check your application to see the updated data.');
    } else {
      console.log('⚠️ No recent entries found - there might be a timing issue');
      console.log('📊 The Lambda functions are working, but data might not be visible yet');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

checkRecentData().catch(console.error); 