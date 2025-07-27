const AWS = require('aws-sdk');
const axios = require('axios');

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const secretsManager = new AWS.SecretsManager();

// Environment variables
const ENVIRONMENT = process.env.ENVIRONMENT;
const ISSUE_HEALTH_TABLE = process.env.ISSUE_HEALTH_TABLE;
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

// Fetch issue data from GitHub API
async function fetchIssueData(repo, githubToken) {
  try {
    const headers = githubToken
      ? { Authorization: `token ${githubToken}` }
      : {};
    
    // Fetch open issues
    const openResponse = await axios.get(`https://api.github.com/repos/${repo}/issues?state=open&per_page=100`, { headers });
    const openCount = openResponse.data.length;
    
    // Fetch closed issues
    const closedResponse = await axios.get(`https://api.github.com/repos/${repo}/issues?state=closed&sort=updated&direction=desc&per_page=100`, { headers });
    const closedCount = closedResponse.data.length;
    
    return { openCount, closedCount };
  } catch (error) {
    console.error('Error fetching issue data:', error);
    throw error;
  }
}

// Store issue health data in DynamoDB
async function storeIssueHealth(repo, openCount, closedCount) {
  // Convert to PST timezone
  const now = new Date();
  const pstOffset = -8 * 60; // PST is UTC-8
  const pstTime = new Date(now.getTime() + (pstOffset * 60 * 1000));
  const date = pstTime.toISOString().split('T')[0]; // YYYY-MM-DD format
  const ratio = openCount > 0 ? (closedCount / openCount).toFixed(2) : 0;
  
  const params = {
    TableName: ISSUE_HEALTH_TABLE,
    Item: {
      repo: repo,
      date: date,
      open_count: openCount,
      closed_count: closedCount,
      ratio: parseFloat(ratio)
    }
  };

  try {
    await dynamodb.put(params).promise();
    console.log(`Stored issue health for ${repo}: ${closedCount} closed, ${openCount} open, ratio: ${ratio}`);
  } catch (error) {
    console.error('Error storing issue health:', error);
    throw error;
  }
}

// Lambda handler
exports.handler = async (event) => {
  try {
    console.log(`Starting issue health collection for ${REPO} in ${ENVIRONMENT} environment`);
    
    // Get GitHub token
    const githubToken = await getGitHubToken();
    
    // Fetch issue data
    const { openCount, closedCount } = await fetchIssueData(REPO, githubToken);
    
    // Store in DynamoDB
    await storeIssueHealth(REPO, openCount, closedCount);
    
    console.log(`Successfully collected issue health data for ${REPO}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Issue health collection completed successfully',
        repo: REPO,
        openCount: openCount,
        closedCount: closedCount,
        ratio: openCount > 0 ? (closedCount / openCount).toFixed(2) : 0,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Error in issue health collection:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Issue health collection failed',
        message: error.message
      })
    };
  }
}; 