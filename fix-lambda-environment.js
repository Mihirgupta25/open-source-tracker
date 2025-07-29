const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

async function fixLambdaEnvironment() {
  console.log('🔧 Fixing Lambda environment variables...\n');

  const lambda = new AWS.Lambda();

  try {
    // Fix production Lambda environment
    console.log('📊 Fixing Production Lambda environment...');
    await lambda.updateFunctionConfiguration({
      FunctionName: 'OpenSourceTrackerProdV2-StarGrowthCollectorF1B47D4-ltunw4zCbymA',
      Environment: {
        Variables: {
          REPO: 'promptfoo/promptfoo',
          GITHUB_TOKEN_SECRET_NAME: 'prod-github-token',
          ENVIRONMENT: 'prod',
          STAR_GROWTH_TABLE: 'prod-star-growth'
        }
      }
    }).promise();
    console.log('✅ Production Lambda environment updated');

    // Fix staging Lambda environment (only the secret name)
    console.log('\n📊 Fixing Staging Lambda environment...');
    await lambda.updateFunctionConfiguration({
      FunctionName: 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc',
      Environment: {
        Variables: {
          REPO: 'promptfoo/promptfoo',
          GITHUB_TOKEN_SECRET_NAME: 'github-token-dev',
          ENVIRONMENT: 'staging',
          STAR_GROWTH_TABLE: 'staging-star-growth'
        }
      }
    }).promise();
    console.log('✅ Staging Lambda environment updated');

    // Wait for changes to propagate
    console.log('\n⏳ Waiting for changes to propagate...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // Test the functions again
    console.log('\n🧪 Testing Lambda functions with corrected environment...');
    
    const prodResult = await lambda.invoke({
      FunctionName: 'OpenSourceTrackerProdV2-StarGrowthCollectorF1B47D4-ltunw4zCbymA',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({})
    }).promise();
    
    console.log('✅ Production Lambda test:');
    console.log(`   Status Code: ${prodResult.StatusCode}`);
    if (prodResult.Payload) {
      const payload = JSON.parse(prodResult.Payload.toString());
      console.log(`   Response: ${JSON.stringify(payload, null, 2)}`);
    }

    const stagingResult = await lambda.invoke({
      FunctionName: 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc',
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({})
    }).promise();
    
    console.log('\n✅ Staging Lambda test:');
    console.log(`   Status Code: ${stagingResult.StatusCode}`);
    if (stagingResult.Payload) {
      const payload = JSON.parse(stagingResult.Payload.toString());
      console.log(`   Response: ${JSON.stringify(payload, null, 2)}`);
    }

    // Wait a moment for data to be written
    console.log('\n⏳ Waiting for data to be written to correct tables...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check if data was written to the correct tables
    console.log('\n🔍 Checking if data was written to correct tables...');
    const dynamodb = new AWS.DynamoDB.DocumentClient();
    
    // Check production table
    const prodData = await dynamodb.scan({
      TableName: 'prod-star-growth',
      Limit: 5
    }).promise();
    
    console.log(`📊 prod-star-growth items: ${prodData.Items.length}`);
    if (prodData.Items.length > 0) {
      const latestProd = prodData.Items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      console.log(`📈 Latest production entry: ${latestProd.count} stars at ${latestProd.timestamp}`);
    }

    // Check staging table
    const stagingData = await dynamodb.scan({
      TableName: 'staging-star-growth',
      Limit: 5
    }).promise();
    
    console.log(`📊 staging-star-growth items: ${stagingData.Items.length}`);
    if (stagingData.Items.length > 0) {
      const latestStaging = stagingData.Items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      console.log(`📈 Latest staging entry: ${latestStaging.count} stars at ${latestStaging.timestamp}`);
    }

    // Check for recent entries (last 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    const recentProdEntries = prodData.Items.filter(item => 
      new Date(item.timestamp) > fifteenMinutesAgo
    );
    
    const recentStagingEntries = stagingData.Items.filter(item => 
      new Date(item.timestamp) > fifteenMinutesAgo
    );
    
    console.log(`\n📊 Recent production entries (last 15 min): ${recentProdEntries.length}`);
    console.log(`📊 Recent staging entries (last 15 min): ${recentStagingEntries.length}`);
    
    if (recentProdEntries.length > 0) {
      console.log('✅ Production Lambda successfully wrote to prod-star-growth!');
    } else {
      console.log('⚠️ No recent production entries found');
    }
    
    if (recentStagingEntries.length > 0) {
      console.log('✅ Staging Lambda successfully wrote to staging-star-growth!');
    } else {
      console.log('⚠️ No recent staging entries found');
    }

    console.log('\n🎉 Environment variables fixed!');
    console.log('📊 Star collection should now write to the correct tables.');
    console.log('⏰ Check your application to see the updated data.');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

fixLambdaEnvironment().catch(console.error); 