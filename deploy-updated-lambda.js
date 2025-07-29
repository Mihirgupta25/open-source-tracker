const AWS = require('aws-sdk');
const fs = require('fs');
const archiver = require('archiver');
AWS.config.update({ region: 'us-east-1' });

async function deployUpdatedLambda() {
  console.log('🚀 Deploying updated Lambda code...\n');

  try {
    // Create deployment package
    console.log('📦 Creating deployment package...');
    const output = fs.createWriteStream('updated-lambda.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', async () => {
      console.log('✅ Deployment package created');
      
      const code = fs.readFileSync('updated-lambda.zip');
      const lambda = new AWS.Lambda();

      // Update production Lambda
      console.log('\n📊 Updating production Lambda...');
      await lambda.updateFunctionCode({
        FunctionName: 'OpenSourceTrackerProdV2-StarGrowthCollectorF1B47D4-ltunw4zCbymA',
        ZipFile: code
      }).promise();
      console.log('✅ Production Lambda code updated');

      // Update staging Lambda
      console.log('\n📊 Updating staging Lambda...');
      await lambda.updateFunctionCode({
        FunctionName: 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc',
        ZipFile: code
      }).promise();
      console.log('✅ Staging Lambda code updated');

      // Wait for updates to complete
      console.log('\n⏳ Waiting for Lambda updates to complete...');
      await new Promise(resolve => setTimeout(resolve, 30000));

      // Test the functions
      console.log('\n🧪 Testing updated Lambda functions...');
      
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

      // Wait for data to be written
      console.log('\n⏳ Waiting for data to be written...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Check DynamoDB
      console.log('\n🔍 Checking DynamoDB for new data...');
      const dynamodb = new AWS.DynamoDB.DocumentClient();
      
      const prodData = await dynamodb.scan({
        TableName: 'prod-star-growth',
        Limit: 5
      }).promise();
      
      const stagingData = await dynamodb.scan({
        TableName: 'staging-star-growth',
        Limit: 5
      }).promise();
      
      console.log(`📊 prod-star-growth items: ${prodData.Items.length}`);
      if (prodData.Items.length > 0) {
        const latestProd = prodData.Items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        console.log(`📈 Latest production entry: ${latestProd.count} stars at ${latestProd.timestamp}`);
      }
      
      console.log(`📊 staging-star-growth items: ${stagingData.Items.length}`);
      if (stagingData.Items.length > 0) {
        const latestStaging = stagingData.Items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
        console.log(`📈 Latest staging entry: ${latestStaging.count} stars at ${latestStaging.timestamp}`);
      }

      // Check for recent entries
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      
      const recentProdEntries = prodData.Items.filter(item => 
        new Date(item.timestamp) > tenMinutesAgo
      );
      
      const recentStagingEntries = stagingData.Items.filter(item => 
        new Date(item.timestamp) > tenMinutesAgo
      );
      
      console.log(`\n📊 Recent production entries (last 10 min): ${recentProdEntries.length}`);
      console.log(`📊 Recent staging entries (last 10 min): ${recentStagingEntries.length}`);
      
      if (recentProdEntries.length > 0) {
        console.log('✅ Production Lambda successfully wrote to DynamoDB!');
      } else {
        console.log('⚠️ No recent production entries found');
      }
      
      if (recentStagingEntries.length > 0) {
        console.log('✅ Staging Lambda successfully wrote to DynamoDB!');
      } else {
        console.log('⚠️ No recent staging entries found');
      }

      console.log('\n🎉 Lambda code updated successfully!');
      console.log('📊 Star collection should now work with environment variables.');
      console.log('⏰ Check your application to see the updated data.');

    });

    archive.pipe(output);
    archive.append(fs.readFileSync('lambda-star-collector-fixed.js', 'utf8'), { name: 'index.js' });
    archive.finalize();

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

deployUpdatedLambda().catch(console.error); 