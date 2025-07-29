const https = require('https');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const dynamodb = new DynamoDBClient({ region: 'us-east-1' });
const secretsManager = new SecretsManagerClient({ region: 'us-east-1' });

// Read from environment variables
const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';
const STAR_GROWTH_TABLE = process.env.STAR_GROWTH_TABLE || 'prod-star-growth';
const GITHUB_TOKEN_SECRET_NAME = process.env.GITHUB_TOKEN_SECRET_NAME || 'prod-github-token';
const REPO = process.env.REPO || 'promptfoo/promptfoo';

// Get GitHub token from Secrets Manager
async function getGitHubToken() {
  try {
    const command = new GetSecretValueCommand({ SecretId: GITHUB_TOKEN_SECRET_NAME });
    const response = await secretsManager.send(command);
    const secret = JSON.parse(response.SecretString);
    return secret.token;
  } catch (error) {
    console.error('Error getting GitHub token:', error);
    return null;
  }
}

// Fetch star count from GitHub API
async function fetchStarCount(repo, githubToken) {
  return new Promise((resolve, reject) => {
    const headers = githubToken
      ? { 'Authorization': `token ${githubToken}`, 'User-Agent': 'OpenSourceTracker' }
      : { 'User-Agent': 'OpenSourceTracker' };
    
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${repo}`,
      method: 'GET',
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.stargazers_count !== undefined) {
            resolve(response.stargazers_count);
          } else {
            reject(new Error('Star count not found in response'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

// Store star count in DynamoDB
async function storeStarCount(repo, starCount) {
  // Convert to PST timezone
  const now = new Date();
  const pstOffset = -8 * 60; // PST is UTC-8
  const pstTime = new Date(now.getTime() + (pstOffset * 60 * 1000));
  
  // Format as "YYYY-MM-DD HH:MM:SS" for consistency
  const timestamp = pstTime.toISOString().replace('T', ' ').substring(0, 19);
  
  const params = {
    TableName: STAR_GROWTH_TABLE,
    Item: {
      repo: { S: repo },
      timestamp: { S: timestamp },
      count: { N: starCount.toString() } // Changed from star_count to count to match existing data structure
    }
  };

  try {
    const command = new PutItemCommand(params);
    await dynamodb.send(command);
    console.log(`Stored star count for ${repo}: ${starCount} at ${timestamp} in table ${STAR_GROWTH_TABLE}`);
  } catch (error) {
    console.error('Error storing star count:', error);
    throw error;
  }
}

// Lambda handler
exports.handler = async (event) => {
  try {
    console.log(`Starting star collection for ${REPO} in ${ENVIRONMENT} environment`);
    console.log(`Using table: ${STAR_GROWTH_TABLE}`);
    console.log(`Using secret: ${GITHUB_TOKEN_SECRET_NAME}`);
    
    // Get GitHub token
    const githubToken = await getGitHubToken();
    
    // Fetch current star count
    const starCount = await fetchStarCount(REPO, githubToken);
    
    // Store in DynamoDB
    await storeStarCount(REPO, starCount);
    
    console.log(`Successfully collected star data for ${REPO}: ${starCount} stars`);
    
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
    console.error('Error in star collection:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Star collection failed',
        message: error.message
      })
    };
  }
}; 