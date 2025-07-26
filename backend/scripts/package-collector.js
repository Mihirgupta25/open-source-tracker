const AWS = require('aws-sdk');
const axios = require('axios');

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const secretsManager = new AWS.SecretsManager();

// Environment variables
const ENVIRONMENT = process.env.ENVIRONMENT;
const PACKAGE_DOWNLOADS_TABLE = process.env.PACKAGE_DOWNLOADS_TABLE;
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

// Fetch package download data from npm API
async function fetchPackageDownloads(packageName) {
  try {
    // For promptfoo, the npm package name is likely "promptfoo"
    const npmPackageName = packageName.split('/')[1] || packageName.split('/')[0];
    
    // Get weekly downloads for the last 4 weeks
    const response = await axios.get(`https://api.npmjs.org/downloads/point/last-week/${npmPackageName}`);
    const downloads = response.data.downloads;
    
    return downloads;
  } catch (error) {
    console.error('Error fetching package downloads:', error);
    // Return 0 if package not found or error
    return 0;
  }
}

// Store package downloads data in DynamoDB
async function storePackageDownloads(repo, downloads) {
  const now = new Date();
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  const params = {
    TableName: PACKAGE_DOWNLOADS_TABLE,
    Item: {
      repo: repo,
      week_start: weekStartStr,
      downloads: downloads
    }
  };

  try {
    await dynamodb.put(params).promise();
    console.log(`Stored package downloads for ${repo}: ${downloads} downloads for week starting ${weekStartStr}`);
  } catch (error) {
    console.error('Error storing package downloads:', error);
    throw error;
  }
}

// Lambda handler
exports.handler = async (event) => {
  try {
    console.log(`Starting package downloads collection for ${REPO} in ${ENVIRONMENT} environment`);
    
    // Get GitHub token (not needed for npm API but keeping for consistency)
    const githubToken = await getGitHubToken();
    
    // Fetch package downloads data
    const downloads = await fetchPackageDownloads(REPO);
    
    // Store in DynamoDB
    await storePackageDownloads(REPO, downloads);
    
    console.log(`Successfully collected package downloads data for ${REPO}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Package downloads collection completed successfully',
        repo: REPO,
        downloads: downloads,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('Error in package downloads collection:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Package downloads collection failed',
        message: error.message
      })
    };
  }
}; 