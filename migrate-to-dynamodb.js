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

// DynamoDB table names (dev environment)
const tableNames = {
  starGrowth: 'dev-star-growth',
  prVelocity: 'dev-pr-velocity',
  issueHealth: 'dev-issue-health',
  packageDownloads: 'dev-package-downloads'
};

// Migration functions
async function migrateStarGrowth() {
  console.log('🔄 Migrating star growth data...');
  
  const db = new Database(dbPaths.starGrowth);
  const rows = db.prepare('SELECT * FROM stars ORDER BY timestamp ASC').all();
  
  console.log(`Found ${rows.length} star growth records`);
  
  for (const row of rows) {
    const params = {
      TableName: tableNames.starGrowth,
      Item: {
        repo: row.repo,
        timestamp: row.timestamp,
        count: row.count
      }
    };
    
    try {
      await dynamodb.put(params).promise();
      console.log(`✅ Migrated star record: ${row.repo} at ${row.timestamp} (${row.count} stars)`);
    } catch (error) {
      console.error(`❌ Failed to migrate star record: ${error.message}`);
    }
  }
  
  db.close();
  console.log('✅ Star growth migration complete');
}

async function migratePRVelocity() {
  console.log('🔄 Migrating PR velocity data...');
  
  const db = new Database(dbPaths.prVelocity);
  const rows = db.prepare('SELECT * FROM pr_ratios ORDER BY date ASC').all();
  
  console.log(`Found ${rows.length} PR velocity records`);
  
  for (const row of rows) {
    const params = {
      TableName: tableNames.prVelocity,
      Item: {
        repo: row.repo,
        date: row.date,
        open_count: row.open_count,
        merged_count: row.merged_count,
        ratio: row.ratio
      }
    };
    
    try {
      await dynamodb.put(params).promise();
      console.log(`✅ Migrated PR record: ${row.repo} on ${row.date} (ratio: ${row.ratio})`);
    } catch (error) {
      console.error(`❌ Failed to migrate PR record: ${error.message}`);
    }
  }
  
  db.close();
  console.log('✅ PR velocity migration complete');
}

async function migrateIssueHealth() {
  console.log('🔄 Migrating issue health data...');
  
  const db = new Database(dbPaths.issueHealth);
  const rows = db.prepare('SELECT * FROM issue_ratios ORDER BY date ASC').all();
  
  console.log(`Found ${rows.length} issue health records`);
  
  for (const row of rows) {
    const params = {
      TableName: tableNames.issueHealth,
      Item: {
        repo: row.repo,
        date: row.date,
        open_count: row.open_count,
        closed_count: row.closed_count,
        ratio: row.ratio
      }
    };
    
    try {
      await dynamodb.put(params).promise();
      console.log(`✅ Migrated issue record: ${row.repo} on ${row.date} (ratio: ${row.ratio})`);
    } catch (error) {
      console.error(`❌ Failed to migrate issue record: ${error.message}`);
    }
  }
  
  db.close();
  console.log('✅ Issue health migration complete');
}

async function migratePackageDownloads() {
  console.log('🔄 Migrating package downloads data...');
  
  const db = new Database(dbPaths.packageDownloads);
  const rows = db.prepare('SELECT * FROM package_downloads ORDER BY week_start ASC').all();
  
  console.log(`Found ${rows.length} package download records`);
  
  for (const row of rows) {
    const params = {
      TableName: tableNames.packageDownloads,
      Item: {
        repo: row.repo,
        week_start: row.week_start,
        downloads: row.downloads
      }
    };
    
    try {
      await dynamodb.put(params).promise();
      console.log(`✅ Migrated package record: ${row.repo} week of ${row.week_start} (${row.downloads} downloads)`);
    } catch (error) {
      console.error(`❌ Failed to migrate package record: ${error.message}`);
    }
  }
  
  db.close();
  console.log('✅ Package downloads migration complete');
}

// Verify data in DynamoDB
async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');
  
  try {
    // Check star growth
    const starResult = await dynamodb.scan({ TableName: tableNames.starGrowth, Limit: 5 }).promise();
    console.log(`✅ Star growth table: ${starResult.Items.length} items found`);
    
    // Check PR velocity
    const prResult = await dynamodb.scan({ TableName: tableNames.prVelocity, Limit: 5 }).promise();
    console.log(`✅ PR velocity table: ${prResult.Items.length} items found`);
    
    // Check issue health
    const issueResult = await dynamodb.scan({ TableName: tableNames.issueHealth, Limit: 5 }).promise();
    console.log(`✅ Issue health table: ${issueResult.Items.length} items found`);
    
    // Check package downloads
    const packageResult = await dynamodb.scan({ TableName: tableNames.packageDownloads, Limit: 5 }).promise();
    console.log(`✅ Package downloads table: ${packageResult.Items.length} items found`);
    
  } catch (error) {
    console.error(`❌ Verification failed: ${error.message}`);
  }
}

// Main migration function
async function migrateAllData() {
  console.log('🚀 Starting migration from SQLite to DynamoDB...\n');
  
  try {
    await migrateStarGrowth();
    console.log('');
    
    await migratePRVelocity();
    console.log('');
    
    await migrateIssueHealth();
    console.log('');
    
    await migratePackageDownloads();
    console.log('');
    
    await verifyMigration();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('Your data is now available in DynamoDB and will be accessible through your deployed application.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateAllData();
}

module.exports = { migrateAllData }; 