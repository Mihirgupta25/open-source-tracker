const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

async function checkStarCollection() {
  console.log('🔍 Checking star collection status...\n');

  try {
    // Check EventBridge rules
    console.log('📅 Checking EventBridge rules...');
    const events = new AWS.CloudWatchEvents();
    const rules = await events.listRules({ NamePrefix: 'OpenSourceTracker' }).promise();
    
    rules.Rules.forEach(rule => {
      if (rule.Name.includes('StarGrowth') || rule.Name.includes('FrequentDataCollection')) {
        console.log(`✅ Found rule: ${rule.Name}`);
        console.log(`   Schedule: ${rule.ScheduleExpression}`);
        console.log(`   State: ${rule.State}`);
        console.log('');
      }
    });

    // Check Lambda functions
    console.log('🔧 Checking Lambda functions...');
    const lambda = new AWS.Lambda();
    const functions = await lambda.listFunctions({ MaxItems: 50 }).promise();
    
    functions.Functions.forEach(func => {
      if (func.FunctionName.includes('StarGrowthCollector')) {
        console.log(`✅ Found Lambda: ${func.FunctionName}`);
        console.log(`   Runtime: ${func.Runtime}`);
        console.log(`   Handler: ${func.Handler}`);
        console.log(`   Last Modified: ${func.LastModified}`);
        console.log('');
      }
    });

    // Check DynamoDB data
    console.log('📊 Checking DynamoDB data...');
    const dynamodb = new AWS.DynamoDB.DocumentClient();
    
    // Check production table
    const prodData = await dynamodb.scan({
      TableName: 'prod-star-growth',
      Limit: 5
    }).promise();
    
    console.log(`📈 Production star growth data points: ${prodData.Items.length}`);
    if (prodData.Items.length > 0) {
      const latest = prodData.Items.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
      console.log(`   Latest entry: ${latest.timestamp} - ${latest.star_count} stars`);
    }

    // Check staging table
    const stagingData = await dynamodb.scan({
      TableName: 'staging-star-growth',
      Limit: 5
    }).promise();
    
    console.log(`📈 Staging star growth data points: ${stagingData.Items.length}`);
    if (stagingData.Items.length > 0) {
      const latest = stagingData.Items.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
      console.log(`   Latest entry: ${latest.timestamp} - ${latest.star_count} stars`);
    }

    // Check CloudWatch logs
    console.log('\n📋 Checking recent CloudWatch logs...');
    const logs = new AWS.CloudWatchLogs();
    
    try {
      const logGroups = await logs.describeLogGroups({
        logGroupNamePrefix: '/aws/lambda/OpenSourceTrackerProdV2-StarGrowthCollector'
      }).promise();
      
      if (logGroups.logGroups.length > 0) {
        const logGroup = logGroups.logGroups[0];
        console.log(`✅ Found log group: ${logGroup.logGroupName}`);
        
        // Get recent log streams
        const logStreams = await logs.describeLogStreams({
          logGroupName: logGroup.logGroupName,
          orderBy: 'LastEventTime',
          descending: true,
          maxItems: 3
        }).promise();
        
        console.log(`   Recent log streams: ${logStreams.logStreams.length}`);
        logStreams.logStreams.forEach(stream => {
          console.log(`   - ${stream.logStreamName} (${stream.lastEventTimestamp})`);
        });
      }
    } catch (err) {
      console.log(`❌ Error checking logs: ${err.message}`);
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkStarCollection().catch(console.error); 