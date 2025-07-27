#!/usr/bin/env node

const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB();
const lambda = new AWS.Lambda();
const events = new AWS.EventBridge();
const secretsManager = new AWS.SecretsManager();

async function checkAutomationStatus() {
  console.log('🤖 Checking Data Collection Automation Status...\n');

  // Check DynamoDB Tables
  console.log('📊 DynamoDB Tables:');
  const tables = [
    'dev-star-growth',
    'dev-pr-velocity', 
    'dev-issue-health',
    'dev-package-downloads'
  ];

  for (const tableName of tables) {
    try {
      const result = await dynamodb.describeTable({ TableName: tableName }).promise();
      const itemCount = result.Table.ItemCount || 0;
      console.log(`   ✅ ${tableName}: ${itemCount} items`);
    } catch (error) {
      console.log(`   ❌ ${tableName}: Not found`);
    }
  }

  // Check Lambda Functions
  console.log('\n🔧 Lambda Functions:');
  try {
    const functions = await lambda.listFunctions({}).promise();
    const collectorFunctions = functions.Functions.filter(func => 
      func.FunctionName.includes('OpenSourceTrackerDev') && 
      (func.FunctionName.includes('StarGrowth') || 
       func.FunctionName.includes('PRVelocity') || 
       func.FunctionName.includes('IssueHealth') || 
       func.FunctionName.includes('PackageDownloads'))
    );
    
    if (collectorFunctions.length > 0) {
      for (const func of collectorFunctions) {
        console.log(`   ✅ ${func.FunctionName}: Active`);
      }
    } else {
      console.log('   ❌ No collector functions found');
    }
  } catch (error) {
    console.log('   ❌ Error checking Lambda functions');
  }

  // Check EventBridge Rules
  console.log('\n⏰ EventBridge Rules:');
  try {
    const rules = await events.listRules({ NamePrefix: 'OpenSourceTracker' }).promise();
    if (rules.Rules.length > 0) {
      for (const rule of rules.Rules) {
        console.log(`   ✅ ${rule.Name}: ${rule.ScheduleExpression || 'Manual trigger'}`);
      }
    } else {
      console.log('   ❌ No EventBridge rules found');
    }
  } catch (error) {
    console.log('   ❌ Error checking EventBridge rules');
  }

  // Check GitHub Token
  console.log('\n🔑 GitHub Token:');
  try {
    const secrets = await secretsManager.listSecrets({}).promise();
    const githubToken = secrets.SecretList.find(secret => 
      secret.Name.includes('github-token')
    );
    
    if (githubToken) {
      console.log(`   ✅ ${githubToken.Name}: Available`);
    } else {
      console.log('   ❌ GitHub token not found');
    }
  } catch (error) {
    console.log('   ❌ Error checking GitHub token');
  }

  // Check CloudWatch Logs
  console.log('\n📝 Recent Logs:');
  try {
    const logs = new AWS.CloudWatchLogs();
    const logGroups = await logs.describeLogGroups({
      logGroupNamePrefix: '/aws/lambda/OpenSourceTracker'
    }).promise();

    if (logGroups.logGroups.length > 0) {
      for (const logGroup of logGroups.logGroups.slice(0, 3)) {
        console.log(`   📋 ${logGroup.logGroupName}`);
      }
    } else {
      console.log('   ❌ No CloudWatch log groups found');
    }
  } catch (error) {
    console.log('   ❌ Error checking CloudWatch logs');
  }

  console.log('\n🎯 Summary:');
  console.log('   • Data collection runs daily at 12 PM UTC');
  console.log('   • Collects: Star growth, PR velocity, Issue health, Package downloads');
  console.log('   • Repository: promptfoo/promptfoo');
  console.log('\n💡 If automation is not working:');
  console.log('   1. Ensure GitHub token is configured');
  console.log('   2. Check Lambda function logs for errors');
  console.log('   3. Verify EventBridge rules are active');
  console.log('   4. Run: npm run cdk:dev (to redeploy if needed)');
}

async function setupGitHubToken() {
  console.log('🔑 Setting up GitHub Token...\n');
  
  const tokenName = 'github-token-dev';
  
  try {
    // Check if token already exists
    await secretsManager.describeSecret({ SecretId: tokenName }).promise();
    console.log(`✅ GitHub token '${tokenName}' already exists`);
  } catch (error) {
    console.log(`❌ GitHub token '${tokenName}' not found`);
    console.log('\n📝 To create the GitHub token:');
    console.log('   1. Go to GitHub → Settings → Developer settings → Personal access tokens');
    console.log('   2. Generate a new token with repo scope');
    console.log('   3. Run: aws secretsmanager create-secret --name github-token-dev --secret-string "{\\"token\\":\\"YOUR_TOKEN_HERE\\"}"');
  }
}

async function testDataCollection() {
  console.log('🧪 Testing Data Collection...\n');
  
  try {
    // Find the star collector function
    const functions = await lambda.listFunctions({}).promise();
    const starCollector = functions.Functions.find(func => 
      func.FunctionName.includes('OpenSourceTrackerDev') && 
      func.FunctionName.includes('StarGrowth')
    );
    
    if (starCollector) {
      console.log(`Testing ${starCollector.FunctionName}...`);
      
      const result = await lambda.invoke({
        FunctionName: starCollector.FunctionName,
        InvocationType: 'RequestResponse'
      }).promise();
      
      console.log('✅ Star collector test completed');
      console.log('Response:', result.Payload.toString());
    } else {
      console.log('❌ Star collector function not found');
    }
  } catch (error) {
    console.log('❌ Error testing data collection:', error.message);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

(async () => {
  switch (command) {
    case 'status':
      await checkAutomationStatus();
      break;
      
    case 'setup-token':
      await setupGitHubToken();
      break;
      
    case 'test':
      await testDataCollection();
      break;
      
    default:
      console.log('🤖 Data Collection Automation Checker');
      console.log('');
      console.log('Usage:');
      console.log('  node scripts/check-automation.js status        # Check automation status');
      console.log('  node scripts/check-automation.js setup-token   # Setup GitHub token');
      console.log('  node scripts/check-automation.js test          # Test data collection');
      break;
  }
})(); 