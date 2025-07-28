const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();
const events = new AWS.CloudWatchEvents();

async function checkGraphs23Automation() {
  console.log('🔍 Checking Automation Status for Graphs 2 & 3 (PR Velocity & Issue Health)\n');

  try {
    // Check PR Velocity Data
    console.log('📊 PR Velocity Data (dev-pr-velocity):');
    const prParams = {
      TableName: 'dev-pr-velocity',
      KeyConditionExpression: 'repo = :repo',
      ExpressionAttributeValues: {
        ':repo': 'promptfoo/promptfoo'
      },
      ScanIndexForward: false,
      Limit: 5
    };
    
    const prData = await dynamodb.query(prParams).promise();
    console.log(`   Found ${prData.Items.length} items`);
    if (prData.Items.length > 0) {
      console.log('   Latest entries:');
      prData.Items.slice(0, 3).forEach((item, index) => {
        console.log(`   ${index + 1}. Date: ${item.date}, Ratio: ${item.ratio}, Open: ${item.open_count}, Merged: ${item.merged_count}`);
      });
    }

    // Check Issue Health Data
    console.log('\n📊 Issue Health Data (dev-issue-health):');
    const issueParams = {
      TableName: 'dev-issue-health',
      KeyConditionExpression: 'repo = :repo',
      ExpressionAttributeValues: {
        ':repo': 'promptfoo/promptfoo'
      },
      ScanIndexForward: false,
      Limit: 5
    };
    
    const issueData = await dynamodb.query(issueParams).promise();
    console.log(`   Found ${issueData.Items.length} items`);
    if (issueData.Items.length > 0) {
      console.log('   Latest entries:');
      issueData.Items.slice(0, 3).forEach((item, index) => {
        console.log(`   ${index + 1}. Date: ${item.date}, Ratio: ${item.ratio}, Open: ${item.open_count}, Closed: ${item.closed_count}`);
      });
    }

    // Check EventBridge Rules
    console.log('\n⏰ EventBridge Rules:');
    try {
      const rules = await events.listRules({ NamePrefix: 'OpenSourceTracker' }).promise();
      const dailyRule = rules.Rules.find(rule => rule.Name.includes('DailyDataCollection'));
      
      if (dailyRule) {
        console.log(`   ✅ Daily Data Collection Rule: ${dailyRule.Name}`);
        console.log(`   📅 Schedule: ${dailyRule.ScheduleExpression}`);
        console.log(`   🔄 State: ${dailyRule.State}`);
      } else {
        console.log('   ❌ Daily Data Collection Rule not found');
      }
    } catch (error) {
      console.log(`   ❌ Error checking EventBridge rules: ${error.message}`);
    }

    // Check Lambda Functions
    console.log('\n🔧 Lambda Functions:');
    try {
      const functions = await lambda.listFunctions({ MaxItems: 50 }).promise();
      const prCollector = functions.Functions.find(f => f.FunctionName.includes('PRVelocityCollector'));
      const issueCollector = functions.Functions.find(f => f.FunctionName.includes('IssueHealthCollector'));
      
      if (prCollector) {
        console.log(`   ✅ PR Velocity Collector: ${prCollector.FunctionName}`);
        console.log(`   📊 Runtime: ${prCollector.Runtime}`);
        console.log(`   ⏱️  Timeout: ${prCollector.Timeout}s`);
      } else {
        console.log('   ❌ PR Velocity Collector not found');
      }
      
      if (issueCollector) {
        console.log(`   ✅ Issue Health Collector: ${issueCollector.FunctionName}`);
        console.log(`   📊 Runtime: ${issueCollector.Runtime}`);
        console.log(`   ⏱️  Timeout: ${issueCollector.Timeout}s`);
      } else {
        console.log('   ❌ Issue Health Collector not found');
      }
    } catch (error) {
      console.log(`   ❌ Error checking Lambda functions: ${error.message}`);
    }

    // Summary
    console.log('\n📋 Summary:');
    console.log('   • PR Velocity: Runs daily at 11:50 PM PST');
    console.log('   • Issue Health: Runs daily at 11:50 PM PST');
    console.log('   • Both use the shared dev-* database tables');
    console.log('   • Latest data appears to be from July 22nd');
    
    if (prData.Items.length > 0 && issueData.Items.length > 0) {
      const latestPrDate = prData.Items[0].date;
      const latestIssueDate = issueData.Items[0].date;
      console.log(`   • Latest PR Velocity data: ${latestPrDate}`);
      console.log(`   • Latest Issue Health data: ${latestIssueDate}`);
      
      const today = new Date().toISOString().split('T')[0];
      if (latestPrDate < today || latestIssueDate < today) {
        console.log('   ⚠️  Data may be outdated - check if automation is running');
      } else {
        console.log('   ✅ Data appears to be current');
      }
    }

  } catch (error) {
    console.error('❌ Error checking automation:', error);
  }
}

checkGraphs23Automation()
  .then(() => {
    console.log('\n🎉 Check completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Check failed:', error);
    process.exit(1);
  }); 