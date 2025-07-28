const AWS = require('aws-sdk');
const axios = require('axios');

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const secretsManager = new AWS.SecretsManager();

// Configuration
const ENVIRONMENT = 'prod';
const STAR_GROWTH_TABLE = 'prod-star-growth';
const GITHUB_TOKEN_SECRET_NAME = 'prod-github-token';
const REPO = 'promptfoo/promptfoo';

// Get GitHub token from Secrets Manager
async function getGitHubToken() {
  try {
    const data = await secretsManager.getSecretValue({ SecretId: GITHUB_TOKEN_SECRET_NAME }).promise();
    const secret = JSON.parse(data.SecretString);
    return secret.token;
  } catch (error) {
    console.error('Error getting GitHub token:', error);
    return null;
  }
}

// Fetch star count from GitHub API
async function fetchStarCount(repo, githubToken) {
  try {
    const headers = githubToken
      ? { Authorization: `token ${githubToken}` }
      : {};
    
    const response = await axios.get(`https://api.github.com/repos/${repo}`, { headers });
    return response.data.stargazers_count;
  } catch (error) {
    console.error('Error fetching star count:', error);
    throw error;
  }
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
      repo: repo,
      timestamp: timestamp,
      count: starCount
    }
  };

  try {
    await dynamodb.put(params).promise();
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
    console.log(`⏰ Collection interval: Every 3 hours starting at 6:00 AM PDT`);
    
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