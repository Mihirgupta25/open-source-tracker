const AWS = require('aws-sdk');

const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-1' });

async function addCrewAIManualStar() {
  try {
    console.log('⭐ Adding manual star growth entry for crewAI...');
    
    const repo = 'crewAI/crewAI';
    const timestamp = new Date().toISOString();
    
    // You can modify these values as needed
    const starCount = 7815; // Current star count for crewAI
    const note = 'Manual entry added via script';
    
    const params = {
      TableName: 'staging-star-growth',
      Item: {
        repo: repo,
        timestamp: timestamp,
        starCount: starCount,
        note: note
      }
    };
    
    console.log(`📊 Adding entry:`);
    console.log(`   Repository: ${repo}`);
    console.log(`   Timestamp: ${timestamp}`);
    console.log(`   Star Count: ${starCount.toLocaleString()}`);
    console.log(`   Note: ${note}`);
    
    await dynamodb.put(params).promise();
    
    console.log('✅ Successfully added manual star growth entry for crewAI!');
    
    // Verify the entry was added
    console.log('\n🔍 Verifying entry...');
    
    const verifyParams = {
      TableName: 'staging-star-growth',
      KeyConditionExpression: 'repo = :repo',
      ExpressionAttributeValues: {
        ':repo': repo
      }
    };
    
    const result = await dynamodb.query(verifyParams).promise();
    
    if (result.Items && result.Items.length > 0) {
      console.log(`✅ Found ${result.Items.length} entries for crewAI:`);
      result.Items.forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.timestamp} - ${item.starCount.toLocaleString()} stars`);
      });
    } else {
      console.log('❌ No entries found for crewAI');
    }
    
  } catch (error) {
    console.error('❌ Error adding manual star entry:', error);
    throw error;
  }
}

addCrewAIManualStar();