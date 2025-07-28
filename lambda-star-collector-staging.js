const https = require('https');

// Use AWS SDK v3 (built into Lambda)
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

// Initialize AWS clients
const dynamodb = new DynamoDBClient({ region: 'us-east-1' });
const secretsManager = new SecretsManagerClient({ region: 'us-east-1' });

// Configuration for staging environment
const ENVIRONMENT = 'staging';
const STAR_GROWTH_TABLE = 'dev-star-growth';
const GITHUB_TOKEN_SECRET_NAME = 'github-token-dev';
const REPO = 'promptfoo/promptfoo';

// Get GitHub token from Secrets Manager
async function getGitHubToken() {
  try {
    const command = new GetSecretValueCommand({ SecretId: GITHUB_TOKEN_SECRET_NAME });
    const data = await secretsManager.send(command);
    const secret = JSON.parse(data.SecretString);
    return secret.token;
  } catch (error) {
    console.error('Error getting GitHub token:', error);
    return null;
  }
}

// Fetch star count from GitHub API using built-in https module
async function fetchStarCount(repo, githubToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: `/repos/${repo}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Star-Collector-Lambda-Staging',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    if (githubToken) {
      options.headers['Authorization'] = `token ${githubToken}`;
    }

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response.stargazers_count);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.end();
  });
}

// Store star count in DynamoDB
async function storeStarCount(repo, starCount) {
  // Get current time in PDT
  const now = new Date();
  const pdtTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  
  // Format as "month day, year" (e.g., "July 28, 2025")
  const timestamp = pdtTime.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const params = {
    TableName: STAR_GROWTH_TABLE,
    Item: {
      repo: { S: repo },
      timestamp: { S: timestamp },
      count: { N: starCount.toString() }
    }
  };

  try {
    const command = new PutItemCommand(params);
    await dynamodb.send(command);
    console.log(`✅ Stored star count for ${repo}: ${starCount} at ${timestamp}`);
    console.log(`📊 Current PDT time: ${pdtTime.toLocaleString("en-US", {timeZone: "America/Los_Angeles"})}`);
  } catch (error) {
    console.error('❌ Error storing star count:', error);
    throw error;
  }
}

// Lambda handler
exports.handler = async (event) => {
  try {
    console.log(`🔄 Starting star collection for ${REPO} in ${ENVIRONMENT} environment`);
    console.log(`⏰ Collection interval: Every 3 hours starting at 12:00 PM PDT`);
    
    // Get GitHub token
    const githubToken = await getGitHubToken();
    
    // Fetch current star count
    const starCount = await fetchStarCount(REPO, githubToken);
    console.log(`⭐ Current star count for ${REPO}: ${starCount}`);
    
    // Store in DynamoDB
    await storeStarCount(REPO, starCount);
    
    console.log(`🎉 Successfully collected star data for ${REPO}: ${starCount} stars`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Star collection completed successfully',
        repo: REPO,
        starCount: starCount,
        timestamp: new Date().toLocaleString("en-US", {timeZone: "America/Los_Angeles"})
      })
    };
    
  } catch (error) {
    console.error('❌ Error in star collection:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Star collection failed',
        message: error.message
      })
    };
  }
}; 