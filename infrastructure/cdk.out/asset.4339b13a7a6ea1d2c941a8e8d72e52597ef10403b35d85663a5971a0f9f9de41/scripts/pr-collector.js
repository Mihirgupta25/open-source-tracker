const AWS = require('aws-sdk');
const axios = require('axios');

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const secretsManager = new AWS.SecretsManager();

// Environment variables
const ENVIRONMENT = process.env.ENVIRONMENT;
const PR_VELOCITY_TABLE = process.env.PR_VELOCITY_TABLE;
const GITHUB_TOKEN_SECRET_NAME = process.env.GITHUB_TOKEN_SECRET_NAME;
const REPO = process.env.REPO || 'promptfoo/promptfoo';

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

// Fetch PR data from GitHub API
async function fetchPRData(repo, githubToken) {
  try {
    const headers = githubToken
      ? { Authorization: `token ${githubToken}` }
      : {};
    
    // Fetch open PRs
    const openResponse = await axios.get(`https://api.github.com/repos/${repo}/pulls?state=open`, { headers });
    const openCount = openResponse.data.length;
    
    // Fetch merged PRs (closed but merged)
    const mergedResponse = await axios.get(`https://api.github.com/repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100`, { headers });
    const mergedCount = mergedResponse.data.filter(pr => pr.merged_at).length;
    
    return { openCount, mergedCount };
  } catch (error) {
    console.error('Error fetching PR data:', error);
    throw error;
  }
}

// Store PR velocity data in DynamoDB
async function storePRVelocity(repo, openCount, mergedCount) {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const ratio = openCount > 0 ? (mergedCount / openCount).toFixed(2) : 0;
  
  const params = {
    TableName: PR_VELOCITY_TABLE,
    Item: {
      repo: repo,
      date: date,
      open_count: openCount,
      merged_count: mergedCount,
      ratio: parseFloat(ratio)
    }
  };

  try {
    await dynamodb.put(params).promise();
    console.log(`Stored PR velocity for ${repo}: ${mergedCount} merged, ${openCount} open, ratio: ${ratio}`);
  } catch (error) {
    console.error('Error storing PR velocity:', error);
    throw error;
  }
}

// Lambda handler
exports.handler = async (event) => {
  try {
    console.log(`Starting PR velocity collection for ${REPO} in ${ENVIRONMENT} environment`);
    
    // Get GitHub token
    const githubToken = await getGitHubToken();
    
    // Fetch PR data
    const { openCount, mergedCount } = await fetchPRData(REPO, githubToken);
    
    // Store in DynamoDB
    await storePRVelocity(REPO, openCount, mergedCount);
    
    console.log(`Successfully collected PR velocity data for ${REPO}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'PR velocity collection completed successfully',
        repo: REPO,
        openCount: openCount,
        mergedCount: mergedCount,
        ratio: openCount > 0 ? (mergedCount / openCount).toFixed(2) : 0,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Error in PR velocity collection:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'PR velocity collection failed',
        message: error.message
      })
    };
  }
}; 