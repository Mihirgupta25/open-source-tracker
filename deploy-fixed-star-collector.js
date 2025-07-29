const AWS = require('aws-sdk');
const fs = require('fs');
const archiver = require('archiver');

AWS.config.update({ region: 'us-east-1' });

async function deployFixedStarCollector() {
  console.log('🔧 Deploying fixed star collector...\n');

  try {
    // Create deployment package
    console.log('📦 Creating deployment package...');
    const output = fs.createWriteStream('fixed-star-collector.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', async () => {
      console.log('✅ Deployment package created');
      
      // Read the package
      const code = fs.readFileSync('fixed-star-collector.zip');
      
      const lambda = new AWS.Lambda();

      try {
        // Update production Lambda
        console.log('📈 Updating production Lambda...');
        await lambda.updateFunctionCode({
          FunctionName: 'OpenSourceTrackerProdV2-StarGrowthCollectorF1B47D4-ltunw4zCbymA',
          ZipFile: code
        }).promise();
        console.log('✅ Production Lambda code updated');

        // Update staging Lambda
        console.log('📈 Updating staging Lambda...');
        await lambda.updateFunctionCode({
          FunctionName: 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc',
          ZipFile: code
        }).promise();
        console.log('✅ Staging Lambda code updated');

        // Update handlers
        console.log('🔧 Updating handlers...');
        await lambda.updateFunctionConfiguration({
          FunctionName: 'OpenSourceTrackerProdV2-StarGrowthCollectorF1B47D4-ltunw4zCbymA',
          Handler: 'lambda-star-collector-fixed.handler'
        }).promise();

        await lambda.updateFunctionConfiguration({
          FunctionName: 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc',
          Handler: 'lambda-star-collector-fixed.handler'
        }).promise();
        console.log('✅ Handlers updated');

        // Wait for update to complete
        console.log('⏳ Waiting for updates to complete...');
        await new Promise(resolve => setTimeout(resolve, 30000));

        // Test the functions
        console.log('\n🧪 Testing updated functions...');
        
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

        console.log('\n🎉 Fixed star collector deployed successfully!');
        console.log('📊 Check the application in a few minutes to see updated data.');

      } catch (err) {
        console.error('❌ Error updating Lambda:', err.message);
      }
    });

    archive.pipe(output);
    
    // Add the fixed star collector file
    const starCollectorCode = fs.readFileSync('lambda-star-collector-fixed.js', 'utf8');
    archive.append(starCollectorCode, { name: 'lambda-star-collector-fixed.js' });
    
    archive.finalize();

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

deployFixedStarCollector().catch(console.error); 