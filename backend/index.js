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
  // Convert to PST timezone
  const now = new Date();
  const pstOffset = -8 * 60; // PST is UTC-8
  const pstTime = new Date(now.getTime() + (pstOffset * 60 * 1000));
  const date = pstTime.toISOString().split('T')[0]; // YYYY-MM-DD format
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

// Trigger PR velocity collection
async function triggerPRVelocityCollection(targetRepo = REPO) {
  try {
    console.log(`Starting PR velocity collection for ${targetRepo} in ${ENVIRONMENT} environment`);
    
    // Get GitHub token
    const githubToken = await getGitHubToken();
    
    // Fetch PR data
    const { openCount, mergedCount } = await fetchPRData(targetRepo, githubToken);
    
    // Store in DynamoDB
    await storePRVelocity(targetRepo, openCount, mergedCount);
    
    console.log(`Successfully collected PR velocity data for ${targetRepo}`);
    
    return {
      success: true,
      message: 'PR velocity collection completed successfully',
      repo: targetRepo,
      openCount: openCount,
      mergedCount: mergedCount,
      ratio: openCount > 0 ? (mergedCount / openCount).toFixed(2) : 0,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error in PR velocity collection:', error);
    
    return {
      success: false,
      error: 'PR velocity collection failed',
      message: error.message
    };
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

// Reset staging data function
async function resetStagingData() {
  try {
    // Only allow reset in staging environment
    if (ENVIRONMENT !== 'staging') {
      throw new Error('Reset only allowed in staging environment');
    }

    const repo = 'promptfoo/promptfoo';
    let itemsCopied = 0;

    // Get production data from prod tables
    const prodStarHistory = await queryStarHistoryFromTable('prod-star-growth', repo);
    const prodPRVelocity = await queryPRVelocityFromTable('prod-pr-velocity', repo);
    const prodIssueHealth = await queryIssueHealthFromTable('prod-issue-health', repo);
    const prodPackageDownloads = await queryPackageDownloadsFromTable('prod-package-downloads', repo);

    // Clear staging tables
    await clearTable(STAR_GROWTH_TABLE, repo);
    await clearTable(PR_VELOCITY_TABLE, repo);
    await clearTable(ISSUE_HEALTH_TABLE, repo);
    await clearTable(PACKAGE_DOWNLOADS_TABLE, repo);

    // Copy production data to staging tables
    if (prodStarHistory.length > 0) {
      await batchWriteItems(STAR_GROWTH_TABLE, prodStarHistory);
      itemsCopied += prodStarHistory.length;
    }

    if (prodPRVelocity.length > 0) {
      await batchWriteItems(PR_VELOCITY_TABLE, prodPRVelocity);
      itemsCopied += prodPRVelocity.length;
    }

    if (prodIssueHealth.length > 0) {
      await batchWriteItems(ISSUE_HEALTH_TABLE, prodIssueHealth);
      itemsCopied += prodIssueHealth.length;
    }

    if (prodPackageDownloads.length > 0) {
      await batchWriteItems(PACKAGE_DOWNLOADS_TABLE, prodPackageDownloads);
      itemsCopied += prodPackageDownloads.length;
    }

    return { success: true, itemsCopied };
  } catch (error) {
    console.error('Error resetting staging data:', error);
    throw error;
  }
}

// Helper functions for reset
async function queryStarHistoryFromTable(tableName, repo) {
  const params = {
    TableName: tableName,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': repo
    },
    ScanIndexForward: true
  };
  
  const result = await dynamodb.query(params).promise();
  return result.Items;
}

async function queryPRVelocityFromTable(tableName, repo) {
  const params = {
    TableName: tableName,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': repo
    },
    ScanIndexForward: true
  };
  
  const result = await dynamodb.query(params).promise();
  return result.Items;
}

async function queryIssueHealthFromTable(tableName, repo) {
  const params = {
    TableName: tableName,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': repo
    },
    ScanIndexForward: true
  };
  
  const result = await dynamodb.query(params).promise();
  return result.Items;
}

async function queryPackageDownloadsFromTable(tableName, repo) {
  const params = {
    TableName: tableName,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': repo
    },
    ScanIndexForward: true
  };
  
  const result = await dynamodb.query(params).promise();
  return result.Items;
}

async function clearTable(tableName, repo) {
  // Get all items to delete
  const params = {
    TableName: tableName,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': repo
    }
  };
  
  const result = await dynamodb.query(params).promise();
  
  // Delete items in batches
  if (result.Items.length > 0) {
    const deleteRequests = result.Items.map(item => {
      // Determine the correct sort key based on table name
      let sortKeyName;
      if (tableName.includes('star-growth')) {
        sortKeyName = 'timestamp';
      } else if (tableName.includes('pr-velocity') || tableName.includes('issue-health')) {
        sortKeyName = 'date';
      } else if (tableName.includes('package-downloads')) {
        sortKeyName = 'week_start';
      } else {
        // Default fallback
        sortKeyName = 'timestamp';
      }
      
      return {
        DeleteRequest: {
          Key: {
            repo: item.repo,
            [sortKeyName]: item[sortKeyName]
          }
        }
      };
    });

    // DynamoDB batch write can handle up to 25 items per request
    const batchSize = 25;
    for (let i = 0; i < deleteRequests.length; i += batchSize) {
      const batch = deleteRequests.slice(i, i + batchSize);
      await dynamodb.batchWrite({
        RequestItems: {
          [tableName]: batch
        }
      }).promise();
    }
  }
}

async function batchWriteItems(tableName, items) {
  if (items.length === 0) return;

  // DynamoDB batch write can handle up to 25 items per request
  const batchSize = 25;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize).map(item => ({
      PutRequest: {
        Item: item
      }
    }));

    await dynamodb.batchWrite({
      RequestItems: {
        [tableName]: batch
      }
    }).promise();
  }
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
      const { repo } = queryStringParameters || {};
      const targetRepo = repo || 'promptfoo/promptfoo';
      const data = await queryStarHistory(targetRepo);
      response = data;

    } else if (path === '/api/pr-velocity' && httpMethod === 'GET') {
      const { repo } = queryStringParameters || {};
      const targetRepo = repo || 'promptfoo/promptfoo';
      const data = await queryPRVelocity(targetRepo);
      response = data;

    } else if (path === '/api/issue-health' && httpMethod === 'GET') {
      const { repo } = queryStringParameters || {};
      const targetRepo = repo || 'promptfoo/promptfoo';
      const data = await queryIssueHealth(targetRepo);
      response = data;

    } else if (path === '/api/package-downloads' && httpMethod === 'GET') {
      const { repo } = queryStringParameters || {};
      const targetRepo = repo || 'promptfoo/promptfoo';
      const data = await queryPackageDownloads(targetRepo);
      response = data;

    } else if (path === '/api/reset-staging-data' && httpMethod === 'POST') {
      const resetResult = await resetStagingData();
      response = resetResult;

    } else if (path === '/api/trigger-pr-velocity' && httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const { repo } = body;
      const targetRepo = repo || REPO;
      const prVelocityResult = await triggerPRVelocityCollection(targetRepo);
      response = prVelocityResult;

    } else if (path === '/api/initialize-repo' && httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const { repo } = body;
      
      if (!repo) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing repo parameter' })
        };
      }

      try {
        // Validate the repository exists by making a GitHub API call
        const githubToken = await getGitHubToken();
        const headers = githubToken
          ? { Authorization: `token ${githubToken}` }
          : {};
        
        const githubResponse = await axios.get(`https://api.github.com/repos/${repo}`, { headers });
        
        if (githubResponse.status === 200) {
          // Repository exists, initialize with current data
          const now = new Date();
          const pstOffset = -8 * 60;
          const pstTime = new Date(now.getTime() + (pstOffset * 60 * 1000));
          const date = pstTime.toISOString().split('T')[0];
          
          // Initialize with current star count
          const starCount = githubResponse.data.stargazers_count;
          const starParams = {
            TableName: STAR_GROWTH_TABLE,
            Item: {
              repo: repo,
              timestamp: now.toISOString(),
              count: starCount
            }
          };
          await dynamodb.put(starParams).promise();
          
          // Initialize with current PR data
          const { openCount, mergedCount } = await fetchPRData(repo, githubToken);
          await storePRVelocity(repo, openCount, mergedCount);
          
          // Initialize with current issue data
          const issueResponse = await axios.get(`https://api.github.com/repos/${repo}/issues?state=all&per_page=100`, { headers });
          const closedIssues = issueResponse.data.filter(issue => issue.state === 'closed').length;
          const openIssues = issueResponse.data.filter(issue => issue.state === 'open').length;
          
          const issueParams = {
            TableName: ISSUE_HEALTH_TABLE,
            Item: {
              repo: repo,
              date: date,
              closed_count: closedIssues,
              open_count: openIssues,
              ratio: openIssues > 0 ? parseFloat((closedIssues / openIssues).toFixed(2)) : 0
            }
          };
          await dynamodb.put(issueParams).promise();
          
          response = {
            success: true,
            message: `Repository ${repo} initialized successfully`,
            repo: repo,
            starCount: starCount,
            openPRs: openCount,
            mergedPRs: mergedCount,
            openIssues: openIssues,
            closedIssues: closedIssues
          };
        } else {
          response = {
            success: false,
            error: 'Repository not found or not accessible'
          };
        }
      } catch (error) {
        console.error('Error initializing repository:', error);
        response = {
          success: false,
          error: 'Failed to initialize repository: ' + error.message
        };
      }

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