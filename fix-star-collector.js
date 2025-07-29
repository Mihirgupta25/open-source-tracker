const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

async function fixStarCollector() {
  console.log('🔧 Fixing star collector Lambda functions...\n');

  const lambda = new AWS.Lambda();

  try {
    // Fix production Lambda
    console.log('📈 Fixing production Lambda...');
    await lambda.updateFunctionConfiguration({
      FunctionName: 'OpenSourceTrackerProdV2-StarGrowthCollectorF1B47D4-ltunw4zCbymA',
      Handler: 'index.handler'
    }).promise();
    console.log('✅ Production Lambda handler updated to index.handler');

    // Fix staging Lambda
    console.log('📈 Fixing staging Lambda...');
    await lambda.updateFunctionConfiguration({
      FunctionName: 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc',
      Handler: 'index.handler'
    }).promise();
    console.log('✅ Staging Lambda handler updated to index.handler');

    // Trigger manual collection for production
    console.log('\n🚀 Triggering manual star collection for production...');
    await lambda.invoke({
      FunctionName: 'OpenSourceTrackerProdV2-StarGrowthCollectorF1B47D4-ltunw4zCbymA',
      InvocationType: 'Event'
    }).promise();
    console.log('✅ Manual collection triggered for production');

    // Trigger manual collection for staging
    console.log('🚀 Triggering manual star collection for staging...');
    await lambda.invoke({
      FunctionName: 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc',
      InvocationType: 'Event'
    }).promise();
    console.log('✅ Manual collection triggered for staging');

    console.log('\n🎉 Star collector fixes completed!');
    console.log('📊 Check the application in a few minutes to see updated data.');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

fixStarCollector().catch(console.error); 