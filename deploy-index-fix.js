const AWS = require('aws-sdk');
const fs = require('fs');
const archiver = require('archiver');

AWS.config.update({ region: 'us-east-1' });

async function deployIndexFix() {
  console.log('🔧 Deploying index.js fix...\n');

  try {
    // Create deployment package
    console.log('📦 Creating deployment package...');
    const output = fs.createWriteStream('index-fix.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', async () => {
      console.log('✅ Deployment package created');
      
      // Read the package
      const code = fs.readFileSync('index-fix.zip');
      
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

        // Update handlers to index.handler
        console.log('🔧 Updating handlers...');
        await lambda.updateFunctionConfiguration({
          FunctionName: 'OpenSourceTrackerProdV2-StarGrowthCollectorF1B47D4-ltunw4zCbymA',
          Handler: 'index.handler'
        }).promise();

        await lambda.updateFunctionConfiguration({
          FunctionName: 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc',
          Handler: 'index.handler'
        }).promise();
        console.log('✅ Handlers updated to index.handler');

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

        console.log('\n🎉 Index.js fix deployed successfully!');
        console.log('📊 Check the application in a few minutes to see updated data.');

      } catch (err) {
        console.error('❌ Error updating Lambda:', err.message);
      }
    });

    archive.pipe(output);
    
    // Add the index.js file
    const indexCode = fs.readFileSync('index.js', 'utf8');
    archive.append(indexCode, { name: 'index.js' });
    
    archive.finalize();

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

deployIndexFix().catch(console.error); 