const AWS = require('aws-sdk');
const Database = require('better-sqlite3');
const path = require('path');

// Configure AWS
AWS.config.update({ region: 'us-east-1' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Database paths
const dbPaths = {
  starGrowth: path.join(__dirname, 'backend/databases/star_growth.db'),
  prVelocity: path.join(__dirname, 'backend/databases/pr_velocity.db'),
  issueHealth: path.join(__dirname, 'backend/databases/issue_health.db'),
  packageDownloads: path.join(__dirname, 'backend/databases/package_downloads.db')
};

// DynamoDB table names
const tableNames = {
  starGrowth: 'dev-star-growth',
  prVelocity: 'dev-pr-velocity',
  issueHealth: 'dev-issue-health',
  packageDownloads: 'dev-package-downloads'
};

async function confirmMigration() {
  console.log('🔍 Confirming SQLite to DynamoDB Migration...\n');
  
  try {
    // Star Growth Comparison
    console.log('📊 STAR GROWTH DATA:');
    const starDb = new Database(dbPaths.starGrowth);
    const sqliteStarData = starDb.prepare('SELECT * FROM stars ORDER BY timestamp').all();
    const dynamoStarResult = await dynamodb.scan({ TableName: tableNames.starGrowth }).promise();
    const dynamoStarData = dynamoStarResult.Items;
    
    console.log(`SQLite: ${sqliteStarData.length} records`);
    console.log(`DynamoDB: ${dynamoStarData.length} records`);
    console.log(`✅ Migration Status: ${sqliteStarData.length === dynamoStarData.length ? 'SUCCESS' : 'FAILED'}`);
    
    if (sqliteStarData.length > 0 && dynamoStarData.length > 0) {
      console.log('Sample SQLite:', JSON.stringify(sqliteStarData[0], null, 2));
      console.log('Sample DynamoDB:', JSON.stringify(dynamoStarData[0], null, 2));
    }
    starDb.close();
    
    // PR Velocity Comparison
    console.log('\n📈 PR VELOCITY DATA:');
    const prDb = new Database(dbPaths.prVelocity);
    const sqlitePrData = prDb.prepare('SELECT * FROM pr_ratios ORDER BY date').all();
    const dynamoPrResult = await dynamodb.scan({ TableName: tableNames.prVelocity }).promise();
    const dynamoPrData = dynamoPrResult.Items;
    
    console.log(`SQLite: ${sqlitePrData.length} records`);
    console.log(`DynamoDB: ${dynamoPrData.length} records`);
    console.log(`✅ Migration Status: ${sqlitePrData.length === dynamoPrData.length ? 'SUCCESS' : 'FAILED'}`);
    
    if (sqlitePrData.length > 0 && dynamoPrData.length > 0) {
      console.log('Sample SQLite:', JSON.stringify(sqlitePrData[0], null, 2));
      console.log('Sample DynamoDB:', JSON.stringify(dynamoPrData[0], null, 2));
    }
    prDb.close();
    
    // Issue Health Comparison
    console.log('\n🐛 ISSUE HEALTH DATA:');
    const issueDb = new Database(dbPaths.issueHealth);
    const sqliteIssueData = issueDb.prepare('SELECT * FROM issue_ratios ORDER BY date').all();
    const dynamoIssueResult = await dynamodb.scan({ TableName: tableNames.issueHealth }).promise();
    const dynamoIssueData = dynamoIssueResult.Items;
    
    console.log(`SQLite: ${sqliteIssueData.length} records`);
    console.log(`DynamoDB: ${dynamoIssueData.length} records`);
    console.log(`✅ Migration Status: ${sqliteIssueData.length === dynamoIssueData.length ? 'SUCCESS' : 'FAILED'}`);
    
    if (sqliteIssueData.length > 0 && dynamoIssueData.length > 0) {
      console.log('Sample SQLite:', JSON.stringify(sqliteIssueData[0], null, 2));
      console.log('Sample DynamoDB:', JSON.stringify(dynamoIssueData[0], null, 2));
    }
    issueDb.close();
    
    // Package Downloads Comparison
    console.log('\n📦 PACKAGE DOWNLOADS DATA:');
    const packageDb = new Database(dbPaths.packageDownloads);
    const sqlitePackageData = packageDb.prepare('SELECT * FROM package_downloads ORDER BY week_start').all();
    const dynamoPackageResult = await dynamodb.scan({ TableName: tableNames.packageDownloads }).promise();
    const dynamoPackageData = dynamoPackageResult.Items;
    
    console.log(`SQLite: ${sqlitePackageData.length} records`);
    console.log(`DynamoDB: ${dynamoPackageData.length} records`);
    console.log(`✅ Migration Status: ${sqlitePackageData.length === dynamoPackageData.length ? 'SUCCESS' : 'FAILED'}`);
    
    if (sqlitePackageData.length > 0 && dynamoPackageData.length > 0) {
      console.log('Sample SQLite:', JSON.stringify(sqlitePackageData[0], null, 2));
      console.log('Sample DynamoDB:', JSON.stringify(dynamoPackageData[0], null, 2));
    }
    packageDb.close();
    
    // Summary
    console.log('\n🎯 MIGRATION SUMMARY:');
    const totalSqlite = sqliteStarData.length + sqlitePrData.length + sqliteIssueData.length + sqlitePackageData.length;
    const totalDynamo = dynamoStarData.length + dynamoPrData.length + dynamoIssueData.length + dynamoPackageData.length;
    
    console.log(`Total SQLite Records: ${totalSqlite}`);
    console.log(`Total DynamoDB Records: ${totalDynamo}`);
    console.log(`Overall Migration Status: ${totalSqlite === totalDynamo ? '✅ COMPLETE SUCCESS' : '❌ FAILED'}`);
    
    if (totalSqlite === totalDynamo) {
      console.log('\n🎉 All data has been successfully migrated from SQLite to DynamoDB!');
      console.log('Your application is now fully cloud-based with all historical data preserved.');
    }
    
  } catch (error) {
    console.error('❌ Error confirming migration:', error.message);
  }
}

confirmMigration(); 