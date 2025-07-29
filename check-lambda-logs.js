const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

async function checkLambdaLogs() {
  console.log('📋 Checking CloudWatch logs for Lambda functions...\n');

  const cloudwatch = new AWS.CloudWatchLogs();
  const lambda = new AWS.Lambda();

  try {
    // Get function details to find log group names
    console.log('🔍 Getting Lambda function details...');
    
    const prodFunction = await lambda.getFunction({
      FunctionName: 'OpenSourceTrackerProdV2-StarGrowthCollectorF1B47D4-ltunw4zCbymA'
    }).promise();
    
    const stagingFunction = await lambda.getFunction({
      FunctionName: 'OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc'
    }).promise();

    // Extract log group names
    const prodLogGroup = `/aws/lambda/${prodFunction.Configuration.FunctionName}`;
    const stagingLogGroup = `/aws/lambda/${stagingFunction.Configuration.FunctionName}`;
    
    console.log(`📊 Production log group: ${prodLogGroup}`);
    console.log(`📊 Staging log group: ${stagingLogGroup}`);

    // Get recent log streams for production
    console.log('\n📋 Getting recent production logs...');
    const prodLogStreams = await cloudwatch.describeLogStreams({
      logGroupName: prodLogGroup,
      orderBy: 'LastEventTime',
      descending: true,
      limit: 5
    }).promise();

    if (prodLogStreams.logStreams.length > 0) {
      const latestProdStream = prodLogStreams.logStreams[0];
      console.log(`📝 Latest production log stream: ${latestProdStream.logStreamName}`);
      
      const prodLogs = await cloudwatch.getLogEvents({
        logGroupName: prodLogGroup,
        logStreamName: latestProdStream.logStreamName,
        startTime: Date.now() - 10 * 60 * 1000, // Last 10 minutes
        limit: 50
      }).promise();
      
      console.log('\n📋 Recent production logs:');
      prodLogs.events.forEach(event => {
        console.log(`[${new Date(event.timestamp).toLocaleString()}] ${event.message}`);
      });
    } else {
      console.log('⚠️ No production log streams found');
    }

    // Get recent log streams for staging
    console.log('\n📋 Getting recent staging logs...');
    const stagingLogStreams = await cloudwatch.describeLogStreams({
      logGroupName: stagingLogGroup,
      orderBy: 'LastEventTime',
      descending: true,
      limit: 5
    }).promise();

    if (stagingLogStreams.logStreams.length > 0) {
      const latestStagingStream = stagingLogStreams.logStreams[0];
      console.log(`📝 Latest staging log stream: ${latestStagingStream.logStreamName}`);
      
      const stagingLogs = await cloudwatch.getLogEvents({
        logGroupName: stagingLogGroup,
        logStreamName: latestStagingStream.logStreamName,
        startTime: Date.now() - 10 * 60 * 1000, // Last 10 minutes
        limit: 50
      }).promise();
      
      console.log('\n📋 Recent staging logs:');
      stagingLogs.events.forEach(event => {
        console.log(`[${new Date(event.timestamp).toLocaleString()}] ${event.message}`);
      });
    } else {
      console.log('⚠️ No staging log streams found');
    }

    // Also check if log groups exist
    console.log('\n🔍 Checking if log groups exist...');
    try {
      await cloudwatch.describeLogGroups({
        logGroupNamePrefix: prodLogGroup
      }).promise();
      console.log('✅ Production log group exists');
    } catch (err) {
      console.log('❌ Production log group not found:', err.message);
    }

    try {
      await cloudwatch.describeLogGroups({
        logGroupNamePrefix: stagingLogGroup
      }).promise();
      console.log('✅ Staging log group exists');
    } catch (err) {
      console.log('❌ Staging log group not found:', err.message);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

checkLambdaLogs().catch(console.error); 