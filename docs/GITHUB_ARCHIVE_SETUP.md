# GitHub Archive + BigQuery Setup Guide

This guide explains how to use Google BigQuery with GitHub Archive to get historical star data for repositories.

## Why Use GitHub Archive + BigQuery?

### Advantages:
1. **Complete Historical Data**: GitHub Archive contains every public GitHub event since 2011
2. **Real Data**: Actual star/unstar events with precise timestamps
3. **Free for Public Data**: GitHub Archive is available as a public BigQuery dataset
4. **Comprehensive**: Includes all public repositories, not just ones you have access to
5. **High Performance**: BigQuery can handle massive datasets efficiently

### What Data is Available:
- All `WatchEvent` (star/unstar) events
- All `PushEvent` (commits) events  
- All `PullRequestEvent` events
- All `IssuesEvent` events
- And many more event types

## Setup Steps

### 1. Google Cloud Project Setup

1. **Create a Google Cloud Project** (or use existing):
   ```bash
   # Install Google Cloud CLI
   gcloud auth login
   gcloud projects create your-project-id
   gcloud config set project your-project-id
   ```

2. **Enable BigQuery API**:
   ```bash
   gcloud services enable bigquery.googleapis.com
   ```

3. **Set up authentication** (optional for public data):
   ```bash
   gcloud auth application-default login
   ```

### 2. BigQuery Dataset Access

GitHub Archive is available as a public dataset. You can access it without authentication for read operations:

```sql
-- Example query to see available data
SELECT 
  type,
  COUNT(*) as event_count
FROM `githubarchive.day.2023*`
WHERE repo.name = 'promptfoo/promptfoo'
GROUP BY type
ORDER BY event_count DESC
```

### 3. Running the Script

```bash
# Install dependencies
npm install @google-cloud/bigquery

# Run the historical data import
node scripts/github-archive-bigquery.js
```

## Query Examples

### Get All Star Events for a Repository

```sql
SELECT
  created_at,
  JSON_EXTRACT_SCALAR(payload, '$.action') as action,
  JSON_EXTRACT_SCALAR(payload, '$.user.login') as user_login
FROM `githubarchive.day.2023*`
WHERE type = 'WatchEvent'
AND JSON_EXTRACT_SCALAR(payload, '$.action') = 'started'
AND repo.name = 'promptfoo/promptfoo'
ORDER BY created_at ASC
```

### Get Daily Star Counts

```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as new_stars
FROM `githubarchive.day.2023*`
WHERE type = 'WatchEvent'
AND JSON_EXTRACT_SCALAR(payload, '$.action') = 'started'
AND repo.name = 'promptfoo/promptfoo'
GROUP BY DATE(created_at)
ORDER BY date ASC
```

### Get Cumulative Star Counts

```sql
WITH daily_stars AS (
  SELECT
    DATE(created_at) as date,
    COUNT(*) as new_stars
  FROM `githubarchive.day.2023*`
  WHERE type = 'WatchEvent'
  AND JSON_EXTRACT_SCALAR(payload, '$.action') = 'started'
  AND repo.name = 'promptfoo/promptfoo'
  GROUP BY DATE(created_at)
)
SELECT
  date,
  new_stars,
  SUM(new_stars) OVER (ORDER BY date) as cumulative_stars
FROM daily_stars
ORDER BY date ASC
```

## Data Structure

### GitHub Archive Schema

Each event in GitHub Archive contains:
- `type`: Event type (e.g., "WatchEvent", "PushEvent")
- `created_at`: Timestamp when the event occurred
- `repo.name`: Repository name (e.g., "promptfoo/promptfoo")
- `payload`: JSON object with event-specific data

### WatchEvent Payload Structure

For star events (`WatchEvent` with `action = "started"`):
```json
{
  "action": "started",
  "starred_at": "2023-04-28T15:48:49Z",
  "user": {
    "login": "username"
  }
}
```

## Performance Tips

1. **Use date partitioning**: GitHub Archive data is partitioned by year and day
2. **Limit date ranges**: Only query the years/days you need
3. **Use wildcards**: `githubarchive.day.2023*` queries all 2023 data
4. **Index on repo.name**: The dataset is optimized for repository name queries

## Troubleshooting

### Common Issues:

1. **No data found**:
   - Check if repository is public
   - Verify repository name format (owner/repo)
   - Check date range (data starts from 2011)

2. **Authentication errors**:
   - For public data, authentication is optional
   - For private data, ensure proper credentials

3. **Rate limiting**:
   - BigQuery has quotas for free tier
   - Consider using paid tier for large queries

### Debugging Queries:

```sql
-- Test if repository exists in archive
SELECT DISTINCT repo.name
FROM `githubarchive.day.2023*`
WHERE repo.name LIKE '%promptfoo%'
LIMIT 10
```

## Alternative Approaches

If BigQuery is not suitable, consider:

1. **GitHub API with authentication**: Limited to repositories you have access to
2. **GitHub Archive JSON files**: Download and process locally
3. **Synthetic data generation**: For demonstration purposes

## Resources

- [GitHub Archive Documentation](https://www.gharchive.org/)
- [BigQuery GitHub Archive Dataset](https://console.cloud.google.com/bigquery?p=githubarchive&d=day&t=events&page=dataset)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [BigQuery Documentation](https://cloud.google.com/bigquery/docs) 