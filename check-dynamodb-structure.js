const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

async function checkDynamoDBStructure() {
  console.log('🔍 Checking DynamoDB table structure and data...\n');

  const dynamodb = new AWS.DynamoDB.DocumentClient();

  try {
    // Check production table structure
    console.log('📊 Checking prod-star-growth table...');
    const prodData = await dynamodb.scan({
      TableName: 'prod-star-growth',
      Limit: 10
    }).promise();
    
    console.log(`✅ Found ${prodData.Items.length} items in prod-star-growth`);
    
    if (prodData.Items.length > 0) {
      console.log('\n📋 Sample production items:');
      prodData.Items.slice(0, 3).forEach((item, index) => {
        console.log(`\nItem ${index + 1}:`);
        console.log(`  Keys: ${Object.keys(item).join(', ')}`);
        console.log(`  Values: ${JSON.stringify(item, null, 2)}`);
      });
    }

    // Check staging table structure
    console.log('\n📊 Checking staging-star-growth table...');
    const stagingData = await dynamodb.scan({
      TableName: 'staging-star-growth',
      Limit: 10
    }).promise();
    
    console.log(`✅ Found ${stagingData.Items.length} items in staging-star-growth`);
    
    if (stagingData.Items.length > 0) {
      console.log('\n📋 Sample staging items:');
      stagingData.Items.slice(0, 3).forEach((item, index) => {
        console.log(`\nItem ${index + 1}:`);
        console.log(`  Keys: ${Object.keys(item).join(', ')}`);
        console.log(`  Values: ${JSON.stringify(item, null, 2)}`);
      });
    }

    // Check if there are any items with today's date
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    console.log(`\n🔍 Looking for items from today (${today})...`);
    
    const todayProdItems = prodData.Items.filter(item => 
      item.timestamp && item.timestamp.includes(today)
    );
    
    const todayStagingItems = stagingData.Items.filter(item => 
      item.timestamp && item.timestamp.includes(today)
    );
    
    console.log(`📊 Production items from today: ${todayProdItems.length}`);
    console.log(`📊 Staging items from today: ${todayStagingItems.length}`);
    
    if (todayProdItems.length > 0) {
      console.log('\n✅ Found production items from today:');
      todayProdItems.forEach(item => {
        console.log(`  ${item.timestamp}: ${item.starCount} stars`);
      });
    }
    
    if (todayStagingItems.length > 0) {
      console.log('\n✅ Found staging items from today:');
      todayStagingItems.forEach(item => {
        console.log(`  ${item.timestamp}: ${item.starCount} stars`);
      });
    }

    // Check the actual Lambda code to see what table it's writing to
    console.log('\n🔍 Checking Lambda environment variables...');
    const lambda = new AWS.Lambda();
    
    const prodConfig = await lambda.getFunctionConfiguration({
      FunctionName: 'OpenSourceTrackerProdV2-StarGrowthCollectorF1B47D4-ltunw4zCbymA'
    }).promise();
    
    const stagingConfig = await lambda.getFunctionConfiguration({
      FunctionName: 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc'
    }).promise();
    
    console.log('\n📋 Production Lambda Environment:');
    console.log(JSON.stringify(prodConfig.Environment, null, 2));
    
    console.log('\n📋 Staging Lambda Environment:');
    console.log(JSON.stringify(stagingConfig.Environment, null, 2));

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

checkDynamoDBStructure().catch(console.error); 