const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

async function checkLambdaCode() {
  console.log('🔍 Checking Lambda function code...\n');

  const lambda = new AWS.Lambda();

  try {
    // Check production Lambda code
    console.log('📈 Checking production Lambda code...');
    const prodCode = await lambda.getFunction({
      FunctionName: 'OpenSourceTrackerProdV2-StarGrowthCollectorF1B47D4-ltunw4zCbymA'
    }).promise();
    
    console.log(`✅ Production Lambda found`);
    console.log(`   Handler: ${prodCode.Configuration.Handler}`);
    console.log(`   Runtime: ${prodCode.Configuration.Runtime}`);
    console.log(`   Code Size: ${prodCode.Configuration.CodeSize} bytes`);
    console.log(`   Last Modified: ${prodCode.Configuration.LastModified}`);
    
    // Get the actual code
    const prodCodeData = await lambda.getFunctionCode({
      FunctionName: 'OpenSourceTrackerProdV2-StarGrowthCollectorF1B47D4-ltunw4zCbymA'
    }).promise();
    
    console.log(`   Code Location: ${prodCodeData.Location}`);
    console.log('');

    // Check staging Lambda code
    console.log('📈 Checking staging Lambda code...');
    const stagingCode = await lambda.getFunction({
      FunctionName: 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc'
    }).promise();
    
    console.log(`✅ Staging Lambda found`);
    console.log(`   Handler: ${stagingCode.Configuration.Handler}`);
    console.log(`   Runtime: ${stagingCode.Configuration.Runtime}`);
    console.log(`   Code Size: ${stagingCode.Configuration.CodeSize} bytes`);
    console.log(`   Last Modified: ${stagingCode.Configuration.LastModified}`);
    
    const stagingCodeData = await lambda.getFunctionCode({
      FunctionName: 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc'
    }).promise();
    
    console.log(`   Code Location: ${stagingCodeData.Location}`);
    console.log('');

    // Test the Lambda functions
    console.log('🧪 Testing Lambda functions...');
    
    try {
      const prodResult = await lambda.invoke({
        FunctionName: 'OpenSourceTrackerProdV2-StarGrowthCollectorF1B47D4-ltunw4zCbymA',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({})
      }).promise();
      
      console.log('✅ Production Lambda test result:');
      console.log(`   Status Code: ${prodResult.StatusCode}`);
      if (prodResult.Payload) {
        const payload = JSON.parse(prodResult.Payload.toString());
        console.log(`   Response: ${JSON.stringify(payload, null, 2)}`);
      }
    } catch (err) {
      console.log(`❌ Production Lambda test failed: ${err.message}`);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkLambdaCode().catch(console.error); 