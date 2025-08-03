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
const REPOSITORIES_TABLE = process.env.REPOSITORIES_TABLE || 'staging-repositories';
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

// Add repository to collection list
async function addRepositoryToCollection(repo) {
  try {
    // Convert to PST timezone for added_at timestamp
    const now = new Date();
    const pstOffset = -8 * 60; // PST is UTC-8
    const pstTime = new Date(now.getTime() + (pstOffset * 60 * 1000));
    
    const params = {
      TableName: REPOSITORIES_TABLE,
      Item: {
        environment: ENVIRONMENT,
        repo: repo,
        added_at: pstTime.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'America/Los_Angeles'
        })
      }
    };
    await dynamodb.put(params).promise();
    console.log(`Added ${repo} to collection list`);
    return true;
  } catch (error) {
    console.error('Error adding repository to collection:', error);
    return false;
  }
}

// Get list of repositories for collection
async function getRepositoriesForCollection() {
  try {
    const params = {
      TableName: REPOSITORIES_TABLE,
      FilterExpression: '#env = :env',
      ExpressionAttributeNames: {
        '#env': 'environment'
      },
      ExpressionAttributeValues: {
        ':env': ENVIRONMENT
      }
    };
    const result = await dynamodb.scan(params).promise();
    console.log('🔍 getRepositoriesForCollection - Full result.Items:', JSON.stringify(result.Items, null, 2));
    return result.Items.map(item => item.repo);
  } catch (error) {
    console.error('Error getting repositories for collection:', error);
    return ['promptfoo/promptfoo']; // Fallback to default
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
  // Format date in PST timezone (YYYY-MM-DD format)
  const date = pstTime.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); // en-CA gives YYYY-MM-DD format
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

// Fetch issue data from GitHub
async function fetchIssueData(repo, githubToken) {
  try {
    const headers = githubToken
      ? { Authorization: `token ${githubToken}` }
      : {};
    
    // Fetch all issues (both open and closed)
    const response = await axios.get(`https://api.github.com/repos/${repo}/issues?state=all&per_page=100`, { headers });
    const issues = response.data;
    
    const openCount = issues.filter(issue => issue.state === 'open').length;
    const closedCount = issues.filter(issue => issue.state === 'closed').length;
    
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
  // Format date in PST timezone (YYYY-MM-DD format)
  const date = pstTime.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); // en-CA gives YYYY-MM-DD format
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
    
    // Convert to PST timezone for response timestamp
    const now = new Date();
    const pstOffset = -8 * 60; // PST is UTC-8
    const pstTime = new Date(now.getTime() + (pstOffset * 60 * 1000));
    
    return {
      success: true,
      message: 'PR velocity collection completed successfully',
      repo: targetRepo,
      openCount: openCount,
      mergedCount: mergedCount,
      ratio: openCount > 0 ? (mergedCount / openCount).toFixed(2) : 0,
      timestamp: pstTime.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/Los_Angeles'
      })
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

// Trigger issue health collection
async function triggerIssueHealthCollection(targetRepo = REPO) {
  try {
    console.log(`Starting issue health collection for ${targetRepo} in ${ENVIRONMENT} environment`);
    
    // Get GitHub token
    const githubToken = await getGitHubToken();
    
    // Fetch issue data
    const { openCount, closedCount } = await fetchIssueData(targetRepo, githubToken);
    
    // Store in DynamoDB
    await storeIssueHealth(targetRepo, openCount, closedCount);
    
    console.log(`Successfully collected issue health data for ${targetRepo}`);
    
    // Convert to PST timezone for response timestamp
    const now = new Date();
    const pstOffset = -8 * 60; // PST is UTC-8
    const pstTime = new Date(now.getTime() + (pstOffset * 60 * 1000));
    
    return {
      success: true,
      message: 'Issue health collection completed successfully',
      repo: targetRepo,
      openCount: openCount,
      closedCount: closedCount,
      ratio: openCount > 0 ? (closedCount / openCount).toFixed(2) : 0,
      timestamp: pstTime.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/Los_Angeles'
      })
    };
    
  } catch (error) {
    console.error('Error in issue health collection:', error);
    
    return {
      success: false,
      error: 'Issue health collection failed',
      message: error.message
    };
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
  // Convert to PST timezone
  const now = new Date();
  const pstOffset = -8 * 60; // PST is UTC-8
  const pstTime = new Date(now.getTime() + (pstOffset * 60 * 1000));
  
  // Create sortable timestamp with full date-time for chronological sorting
  const sortableTimestamp = pstTime.toISOString(); // Full ISO format for proper sorting
  
  // Format as "month day, year at time" (e.g., "July 25, 2025 at 03:00:20 PM") for display
  const displayTimestamp = pstTime.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'America/Los_Angeles'
  });
  
  // Check if an entry already exists for this exact timestamp (within 1 minute to avoid duplicates)
  const oneMinuteAgo = new Date(pstTime.getTime() - 60000);
  const oneMinuteLater = new Date(pstTime.getTime() + 60000);
  
  const existingParams = {
    TableName: STAR_GROWTH_TABLE,
    KeyConditionExpression: 'repo = :repo AND #ts BETWEEN :startTime AND :endTime',
    ExpressionAttributeNames: {
      '#ts': 'timestamp'
    },
    ExpressionAttributeValues: {
      ':repo': repo,
      ':startTime': oneMinuteAgo.toISOString(),
      ':endTime': oneMinuteLater.toISOString()
    }
  };
  
  try {
    const existingResult = await dynamodb.query(existingParams).promise();
    
    if (existingResult.Items.length > 0) {
      console.log(`Entry already exists for ${repo} on ${displayTimestamp}, skipping duplicate`);
      return {
        message: 'Entry already exists for today',
        repo: repo,
        starCount: starCount,
        timestamp: displayTimestamp
      };
    }
    
    // No existing entry, proceed to store
    const params = {
      TableName: STAR_GROWTH_TABLE,
      Item: {
        repo: repo,
        timestamp: sortableTimestamp, // Use sortable format for database
        displayTimestamp: displayTimestamp, // Store display format separately
        count: starCount
      }
    };

    await dynamodb.put(params).promise();
    console.log(`Stored star count for ${repo}: ${starCount} at ${displayTimestamp} (sortable: ${sortableTimestamp})`);
    
    return {
      message: 'Star count stored successfully',
      repo: repo,
      starCount: starCount,
      timestamp: displayTimestamp,
      sortableTimestamp: sortableTimestamp
    };
  } catch (error) {
    console.error('Error storing star count:', error);
    throw error;
  }
}

// Trigger star collection
async function triggerStarCollection(targetRepo = REPO) {
  try {
    console.log(`🚀 Starting star collection for ${targetRepo} in ${ENVIRONMENT} environment`);
    
    // Call the unified collector instead of doing the work here
    const lambda = new AWS.Lambda();
    // Convert to PST timezone for event timestamp
    const now = new Date();
    const pstOffset = -8 * 60; // PST is UTC-8
    const pstTime = new Date(now.getTime() + (pstOffset * 60 * 1000));
    
    const event = {
      source: 'staging-star-collection-3hr',
      timestamp: pstTime.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'America/Los_Angeles'
      })
    };
    
    console.log(`📤 Invoking unified collector with event:`, event);
    
    const result = await lambda.invoke({
      FunctionName: 'staging-unified-collector',
      Payload: JSON.stringify(event),
      InvocationType: 'RequestResponse'
    }).promise();
    
    console.log(`📊 Unified collector result:`, result);
    
    if (result.StatusCode === 200) {
      const payload = JSON.parse(result.Payload.toString());
      console.log(`✅ Unified collector completed successfully`);
      
      return {
        success: true,
        message: 'Star collection completed via unified collector',
        repo: targetRepo,
        unifiedCollectorResponse: payload
      };
    } else {
      throw new Error(`Unified collector failed with status: ${result.StatusCode}`);
    }
    
  } catch (error) {
    console.error('❌ Error in star collection:', error);
    console.error('❌ Error stack:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

// Manual star collection that handles crewAI repository correctly
async function triggerManualStarCollection(targetRepo = REPO) {
  try {
    console.log(`Starting manual star collection for ${targetRepo} in ${ENVIRONMENT} environment`);
    
    // Get GitHub token
    const githubToken = await getGitHubToken();
    
    // Handle crewAI repository mapping
    let githubRepo = targetRepo;
    let dbRepo = targetRepo;
    
    if (targetRepo === 'crewAI/crewAI') {
      githubRepo = 'crewAIInc/crewAI'; // Use the correct GitHub repository
      dbRepo = 'crewAI/crewAI'; // Keep the original name for database consistency
    }
    
    // Fetch current star count from GitHub
    const starCount = await fetchStarCount(githubRepo, githubToken);
    
    // Store in DynamoDB with the original repository name
    // Convert to PST timezone
    const now = new Date();
    const pstOffset = -8 * 60; // PST is UTC-8
    const pstTime = new Date(now.getTime() + (pstOffset * 60 * 1000));
    
    // Format as "month day, year" (e.g., "July 25, 2025")
    const timestamp = pstTime.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const params = {
      TableName: STAR_GROWTH_TABLE,
      Item: {
        repo: dbRepo,
        timestamp: timestamp,
        starCount: starCount,
        note: `Manual entry from ${githubRepo}`
      }
    };
    
    await dynamodb.put(params).promise();
    
    console.log(`Successfully collected manual star data for ${dbRepo}: ${starCount} stars (from ${githubRepo})`);
    
    return {
      success: true,
      message: 'Manual star count stored successfully',
      repo: dbRepo,
      starCount: starCount,
      timestamp: timestamp,
      githubRepo: githubRepo
    };
  } catch (error) {
    console.error('Error in manual star collection:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Unified collection handler for all repositories
async function triggerUnifiedCollection() {
  try {
    console.log('🔄 Starting unified collection for all repositories...');
    
    const githubToken = await getGitHubToken();
    const repositories = await getRepositoriesForCollection();
    
    console.log(`📊 Found ${repositories.length} repositories to collect:`, repositories);
    
    const results = {
      success: true,
      message: `Unified collection completed for ${repositories.length} repositories`,
      repositories: [],
      errors: []
    };
    
    for (const repo of repositories) {
      try {
        console.log(`🔍 Processing repository: ${repo}`);
        
        // Collect star growth data
        const starCount = await fetchStarCount(repo, githubToken);
        await storeStarCount(repo, starCount);
        console.log(`⭐ Star count for ${repo}: ${starCount}`);
        
        // Collect PR velocity data
        const { openCount, mergedCount } = await fetchPRData(repo, githubToken);
        await storePRVelocity(repo, openCount, mergedCount);
        console.log(`📈 PR velocity for ${repo}: ${openCount} open, ${mergedCount} merged`);
        
        // Collect issue health data
        const { openCount: openIssues, closedCount } = await fetchIssueData(repo, githubToken);
        await storeIssueHealth(repo, openIssues, closedCount);
        console.log(`📋 Issue health for ${repo}: ${openIssues} open, ${closedCount} closed`);
        
        results.repositories.push({
          repo: repo,
          starCount: starCount,
          prVelocity: { openCount, mergedCount },
          issueHealth: { openCount: openIssues, closedCount }
        });
        
      } catch (error) {
        console.error(`❌ Error processing ${repo}:`, error);
        results.errors.push({
          repo: repo,
          error: error.message,
          fullError: error
        });
      }
    }
    
    console.log('✅ Unified collection completed');
    return results;
    
  } catch (error) {
    console.error('❌ Error in unified collection:', error);
    return {
      success: false,
      error: 'Unified collection failed: ' + error.message,
      fullError: error
    };
  }
}

// DynamoDB helper functions
async function queryStarHistory(repo) {
  // Handle crewAI repository mapping
  let dbRepo = repo;
  if (repo === 'crewAI/crewAI') {
    dbRepo = 'crewAIInc/crewAI'; // Use the correct database repository name
  }
  
  const params = {
    TableName: STAR_GROWTH_TABLE,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': dbRepo
    },
    ScanIndexForward: true
  };
  
  const result = await dynamodb.query(params).promise();
  return result.Items;
}

async function queryPRVelocity(repo) {
  // Handle crewAI repository mapping
  let dbRepo = repo;
  if (repo === 'crewAI/crewAI') {
    dbRepo = 'crewAIInc/crewAI'; // Use the correct database repository name
  }
  
  const params = {
    TableName: PR_VELOCITY_TABLE,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': dbRepo
    },
    ScanIndexForward: true
  };
  
  const result = await dynamodb.query(params).promise();
  return result.Items;
}

async function queryIssueHealth(repo) {
  // Handle crewAI repository mapping
  let dbRepo = repo;
  if (repo === 'crewAI/crewAI') {
    dbRepo = 'crewAIInc/crewAI'; // Use the correct database repository name
  }
  
  const params = {
    TableName: ISSUE_HEALTH_TABLE,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': dbRepo
    },
    ScanIndexForward: true
  };
  
  const result = await dynamodb.query(params).promise();
  return result.Items;
}

async function queryPackageDownloads(repo) {
  // Handle crewAI repository mapping
  let dbRepo = repo;
  if (repo === 'crewAI/crewAI') {
    dbRepo = 'crewAIInc/crewAI'; // Use the correct database repository name
  }
  
  const params = {
    TableName: PACKAGE_DOWNLOADS_TABLE,
    KeyConditionExpression: 'repo = :repo',
    ExpressionAttributeValues: {
      ':repo': dbRepo
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

    // Get all repositories from the collection
    const repos = await getRepositoriesForCollection();
    let totalItemsCleared = 0;

    // Clear data for all repositories
    for (const repo of repos) {
      console.log(`Clearing data for repository: ${repo}`);
      
      // Clear staging tables for this repository
      const starItems = await clearTable(STAR_GROWTH_TABLE, repo);
      const prItems = await clearTable(PR_VELOCITY_TABLE, repo);
      const issueItems = await clearTable(ISSUE_HEALTH_TABLE, repo);
      const packageItems = await clearTable(PACKAGE_DOWNLOADS_TABLE, repo);
      
      totalItemsCleared += starItems + prItems + issueItems + packageItems;
    }

    console.log(`Reset completed. Cleared ${totalItemsCleared} items from staging tables.`);
    return { success: true, itemsCleared: totalItemsCleared };
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
  
  // Check if this is an EventBridge scheduled event
  if (event.source === 'aws.events' && event['detail-type'] === 'Scheduled Event') {
    console.log('🕐 EventBridge scheduled event detected, triggering unified collection...');
    const result = await triggerUnifiedCollection();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result)
    };
  }
  
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

    } else if (path === '/api/trigger-issue-health' && httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const { repo } = body;
      const targetRepo = repo || REPO;
      const issueHealthResult = await triggerIssueHealthCollection(targetRepo);
      response = issueHealthResult;

    } else if (path === '/api/trigger-star-collection' && httpMethod === 'POST') {
      console.log('🎯 Trigger star collection endpoint called');
      console.log('📦 Request body:', event.body);
      
      const body = JSON.parse(event.body);
      const { repo } = body;
      const targetRepo = repo || REPO;
      
      console.log('📊 Request parameters:', { repo, targetRepo });
      
      const starResult = await triggerStarCollection(targetRepo);
      console.log('📤 Star collection result:', starResult);
      
      response = starResult;

    } else if (path === '/api/manual-star-collection' && httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      const { repo } = body;
      const targetRepo = repo || REPO;
      const manualStarResult = await triggerManualStarCollection(targetRepo);
      response = manualStarResult;

    } else if (path === '/api/collection-repos' && httpMethod === 'GET') {
      // Get list of repositories in automated collection
      const repos = await getRepositoriesForCollection();
      response = {
        repositories: repos,
        environment: ENVIRONMENT
      };

    } else if (path === '/api/collection-repos' && httpMethod === 'POST') {
      // Add repository to automated collection
      const body = JSON.parse(event.body);
      const { repo } = body;
      
      if (!repo) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing repo parameter' })
        };
      }
      
      const added = await addRepositoryToCollection(repo);
      response = {
        success: added,
        message: added ? `Repository ${repo} added to automated collection` : `Failed to add repository ${repo} to collection`,
        repo: repo
      };

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
          const date = pstTime.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }); // en-CA gives YYYY-MM-DD format
          
          // Initialize with current star count
          const starCount = githubResponse.data.stargazers_count;
          
          // Use existing pstTime for timestamp formatting
          const timestamp = pstTime.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          
          const starParams = {
            TableName: STAR_GROWTH_TABLE,
            Item: {
              repo: repo,
              timestamp: timestamp,
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
          
          // Add repository to collection list for automated data collection
          const addedToCollection = await addRepositoryToCollection(repo);
          
          response = {
            success: true,
            message: `Repository ${repo} initialized successfully${addedToCollection ? ' and added to automated collection' : ''}`,
            repo: repo,
            starCount: starCount,
            openPRs: openCount,
            mergedPRs: mergedCount,
            openIssues: openIssues,
            closedIssues: closedIssues,
            addedToCollection: addedToCollection
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

    } else if (path === '/api/trigger-unified-collection' && httpMethod === 'POST') {
      const unifiedResult = await triggerUnifiedCollection();
      response = unifiedResult;

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