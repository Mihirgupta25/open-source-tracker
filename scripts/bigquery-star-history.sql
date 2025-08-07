
-- BigQuery script to fetch historical star data for promptfoo/promptfoo
-- Run this in Google BigQuery console

-- Get all star events for the repository
SELECT 
  created_at,
  actor.login as user,
  repo.name as repository,
  payload.action as action,
  -- Calculate running total of stars
  SUM(CASE WHEN payload.action = 'started' THEN 1 ELSE -1 END) 
    OVER (ORDER BY created_at ROWS UNBOUNDED PRECEDING) as running_stars
FROM `githubarchive.day.events`
WHERE 
  type = 'WatchEvent' 
  AND repo.name = 'promptfoo/promptfoo'
  AND created_at >= '2023-04-28'  -- Repository creation date
ORDER BY created_at ASC;

-- Alternative: Get daily star counts
SELECT 
  DATE(created_at) as date,
  COUNT(CASE WHEN payload.action = 'started' THEN 1 END) as stars_added,
  COUNT(CASE WHEN payload.action = 'deleted' THEN 1 END) as stars_removed,
  SUM(CASE WHEN payload.action = 'started' THEN 1 ELSE -1 END) as net_change
FROM `githubarchive.day.events`
WHERE 
  type = 'WatchEvent' 
  AND repo.name = 'promptfoo/promptfoo'
  AND created_at >= '2023-04-28'
GROUP BY DATE(created_at)
ORDER BY date ASC;
  