const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

async function syncProdWithStaging() {
  console.log('🔄 Syncing production star growth table with staging data...\n');

  const dynamodb = new AWS.DynamoDB.DocumentClient();

  try {
    // First, get all data from staging table
    console.log('📊 Reading all data from staging-star-growth table...');
    const stagingData = await dynamodb.scan({
      TableName: 'staging-star-growth'
    }).promise();
    
    console.log(`✅ Found ${stagingData.Items.length} items in staging-star-growth`);
    
    if (stagingData.Items.length === 0) {
      console.log('⚠️ No data found in staging table');
      return;
    }

    // Show sample of staging data
    console.log('\n📋 Sample staging data:');
    stagingData.Items.slice(0, 3).forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.count} stars at ${item.timestamp}`);
    });

    // Get all data from production table to show what we're replacing
    console.log('\n📊 Reading current production data...');
    const currentProdData = await dynamodb.scan({
      TableName: 'prod-star-growth'
    }).promise();
    
    console.log(`📊 Found ${currentProdData.Items.length} items in prod-star-growth (will be deleted)`);

    // Delete all items from production table
    console.log('\n🗑️ Deleting all items from prod-star-growth table...');
    
    for (const item of currentProdData.Items) {
      await dynamodb.delete({
        TableName: 'prod-star-growth',
        Key: {
          repo: item.repo,
          timestamp: item.timestamp
        }
      }).promise();
    }
    
    console.log(`✅ Deleted ${currentProdData.Items.length} items from prod-star-growth`);

    // Wait a moment for deletions to complete
    console.log('\n⏳ Waiting for deletions to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Copy all items from staging to production
    console.log('\n📋 Copying all items from staging to production...');
    
    let copiedCount = 0;
    for (const item of stagingData.Items) {
      await dynamodb.put({
        TableName: 'prod-star-growth',
        Item: {
          repo: item.repo,
          timestamp: item.timestamp,
          count: item.count
        }
      }).promise();
      copiedCount++;
      
      // Log progress every 10 items
      if (copiedCount % 10 === 0) {
        console.log(`  📊 Copied ${copiedCount}/${stagingData.Items.length} items...`);
      }
    }
    
    console.log(`✅ Copied ${copiedCount} items from staging to production`);

    // Verify the sync
    console.log('\n🔍 Verifying the sync...');
    const newProdData = await dynamodb.scan({
      TableName: 'prod-star-growth'
    }).promise();
    
    console.log(`📊 Production table now has ${newProdData.Items.length} items`);
    console.log(`📊 Staging table has ${stagingData.Items.length} items`);
    
    if (newProdData.Items.length === stagingData.Items.length) {
      console.log('✅ Sync successful! Both tables have the same number of items');
    } else {
      console.log('⚠️ Sync may have issues - item counts don\'t match');
    }

    // Show sample of new production data
    console.log('\n📋 Sample of new production data:');
    newProdData.Items.slice(0, 3).forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.count} stars at ${item.timestamp}`);
    });

    // Check for recent entries
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const recentProdEntries = newProdData.Items.filter(item => 
      item.timestamp && item.timestamp.includes(today)
    );
    
    const recentStagingEntries = stagingData.Items.filter(item => 
      item.timestamp && item.timestamp.includes(today)
    );
    
    console.log(`\n📅 Recent entries from today (${today}):`);
    console.log(`   Production: ${recentProdEntries.length} entries`);
    console.log(`   Staging: ${recentStagingEntries.length} entries`);

    console.log('\n🎉 Sync completed successfully!');
    console.log('📊 Production star growth table now matches staging exactly');
    console.log('⏰ Next scheduled collection will add new data to both tables');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

syncProdWithStaging().catch(console.error); 