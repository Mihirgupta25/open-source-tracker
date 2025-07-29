const AWS = require('aws-sdk');
const fs = require('fs');
const archiver = require('archiver');
const path = require('path');

AWS.config.update({ region: 'us-east-1' });

async function deployStarCollectorFix() {
  console.log('🔧 Deploying star collector fix...\n');

  try {
    // Create deployment package
    console.log('📦 Creating deployment package...');
    const output = fs.createWriteStream('star-collector-fix.zip');
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', async () => {
      console.log('✅ Deployment package created');
      
      // Read the package
      const code = fs.readFileSync('star-collector-fix.zip');
      
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
          Handler: 'star-collector.handler'
        }).promise();

        await lambda.updateFunctionConfiguration({
          FunctionName: 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc',
          Handler: 'star-collector.handler'
        }).promise();
        console.log('✅ Handlers updated to star-collector.handler');

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

        console.log('\n🎉 Star collector fix deployed successfully!');
        console.log('📊 Check the application in a few minutes to see updated data.');

      } catch (err) {
        console.error('❌ Error updating Lambda:', err.message);
      }
    });

    archive.pipe(output);
    
    // Add the star collector file as index.js
    const starCollectorCode = fs.readFileSync('backend/scripts/star-collector.js', 'utf8');
    archive.append(starCollectorCode, { name: 'star-collector.js' });
    
    // Add package.json for dependencies
    const packageJson = {
      "name": "star-collector",
      "version": "1.0.0",
      "dependencies": {
        "@aws-sdk/client-dynamodb": "^3.0.0",
        "@aws-sdk/client-secrets-manager": "^3.0.0"
      }
    };
    archive.append(JSON.stringify(packageJson, null, 2), { name: 'package.json' });
    
    archive.finalize();

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

deployStarCollectorFix().catch(console.error); 