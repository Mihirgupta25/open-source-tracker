const AWS = require('aws-sdk');
const axios = require('axios');

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const secretsManager = new AWS.SecretsManager();

// Environment variables
const ENVIRONMENT = process.env.ENVIRONMENT;
const STAR_GROWTH_TABLE = process.env.STAR_GROWTH_TABLE;
const PR_VELOCITY_TABLE = process.env.PR_VELOCITY_TABLE;
const ISSUE_HEALTH_TABLE = process.env.ISSUE_HEALTH_TABLE;
const PACKAGE_DOWNLOADS_TABLE = process.env.PACKAGE_DOWNLOADS_TABLE;
const GITHUB_TOKEN_SECRET_NAME = process.env.GITHUB_TOKEN_SECRET_NAME;

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

// DynamoDB helper functions
async function queryStarHistory(repo) {
  const params = {
    TableName: STAR_GROWTH_TABLE,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': repo
    },
    ScanIndexForward: true
  };
  
  const result = await dynamodb.query(params).promise();
  return result.Items;
}

async function queryPRVelocity(repo) {
  const params = {
    TableName: PR_VELOCITY_TABLE,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': repo
    },
    ScanIndexForward: true
  };
  
  const result = await dynamodb.query(params).promise();
  return result.Items;
}

async function queryIssueHealth(repo) {
  const params = {
    TableName: ISSUE_HEALTH_TABLE,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': repo
    },
    ScanIndexForward: true
  };
  
  const result = await dynamodb.query(params).promise();
  return result.Items;
}

async function queryPackageDownloads(repo) {
  const params = {
    TableName: PACKAGE_DOWNLOADS_TABLE,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': repo
    },
    ScanIndexForward: true
  };
  
  const result = await dynamodb.query(params).promise();
  return result.Items;
}

// Lambda handler
exports.handler = async (event) => {
  console.log('Lambda function called with event:', JSON.stringify(event, null, 2));
  const { httpMethod, path, queryStringParameters } = event;
  
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS requests for CORS
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    let response;

    // Route handling
    if (path === '/api/stars' && httpMethod === 'GET') {
      const { repo } = queryStringParameters || {};
      if (!repo) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing repo parameter' })
        };
      }

      const githubToken = await getGitHubToken();
      const headers = githubToken
        ? { Authorization: `token ${githubToken}` }
        : {};
      
      const githubResponse = await axios.get(`https://api.github.com/repos/${repo}`, { headers });
      const starCount = githubResponse.data.stargazers_count;
      
      response = { count: starCount };

    } else if (path === '/api/star-history' && httpMethod === 'GET') {
      const data = await queryStarHistory('promptfoo/promptfoo');
      response = data;

    } else if (path === '/api/pr-velocity' && httpMethod === 'GET') {
      const data = await queryPRVelocity('promptfoo/promptfoo');
      response = data;

    } else if (path === '/api/issue-health' && httpMethod === 'GET') {
      const data = await queryIssueHealth('promptfoo/promptfoo');
      response = data;

    } else if (path === '/api/package-downloads' && httpMethod === 'GET') {
      const data = await queryPackageDownloads('promptfoo/promptfoo');
      response = data;

    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Endpoint not found' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
}; 