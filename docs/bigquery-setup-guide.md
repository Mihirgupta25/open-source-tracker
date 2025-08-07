# BigQuery GitHub Archive Setup Guide

## 🚀 Step-by-Step Setup Process

### **Step 1: Google Cloud Account Setup**

1. **Create Google Cloud Account**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Sign up for a new account or use existing Google account
   - **Note**: New accounts get $300 free credit and BigQuery has generous free tier

2. **Enable BigQuery API**
   - In Google Cloud Console, go to "APIs & Services" > "Library"
   - Search for "BigQuery API"
   - Click "Enable"

### **Step 2: Create BigQuery Project**

1. **Create New Project**
   - In Google Cloud Console, click on project dropdown
   - Click "New Project"
   - Name: `github-archive-analysis` (or your preferred name)
   - Click "Create"

2. **Set as Active Project**
   - Select your new project from the dropdown
   - This will be your active project for BigQuery queries

### **Step 3: Access GitHub Archive Dataset**

1. **Open BigQuery Console**
   - Go to [BigQuery Console](https://console.cloud.google.com/bigquery)
   - Or navigate to BigQuery from the main Google Cloud Console

2. **Add GitHub Archive Dataset**
   - In BigQuery Console, click "Add Data" > "Search a project"
   - Search for: `githubarchive`
   - Click on the `githubarchive` project
   - Click "View Dataset"
   - Click "Star Dataset" to save it for easy access

### **Step 4: Run Historical Star Query**

1. **Open Query Editor**
   - In BigQuery Console, click "Compose new query"

2. **Paste the Query**
   ```sql
   -- Get all star events for promptfoo/promptfoo from creation to July 24, 2025
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
     AND created_at <= '2025-07-24'  -- End date specified
   ORDER BY created_at ASC;
   ```

3. **Run the Query**
   - Click "Run"
   - **Note**: First query may take a few minutes to process
   - Results will show all star events with running totals

### **Step 5: Export Results**

1. **Download Results**
   - After query completes, click "Save results"
   - Choose "Download as JSON" or "Download as CSV"
   - Save file as `promptfoo-historical-stars-bigquery.json`

2. **Alternative: Save to Table**
   - Click "Save results" > "Save as BigQuery table"
   - This allows you to query the results later

### **Step 6: Additional Queries**

#### **Daily Star Summary**
```sql
-- Get daily star counts for promptfoo
SELECT 
  DATE(created_at) as date,
  COUNT(CASE WHEN payload.action = 'started' THEN 1 END) as stars_added,
  COUNT(CASE WHEN payload.action = 'deleted' THEN 1 END) as stars_removed,
  SUM(CASE WHEN payload.action = 'started' THEN 1 ELSE -1 END) as net_change,
  COUNT(*) as total_events
FROM `githubarchive.day.events`
WHERE 
  type = 'WatchEvent' 
  AND repo.name = 'promptfoo/promptfoo'
  AND created_at >= '2023-04-28'
  AND created_at <= '2025-07-24'
GROUP BY DATE(created_at)
ORDER BY date ASC;
```

#### **Monthly Growth Analysis**
```sql
-- Get monthly star growth
SELECT 
  FORMAT_DATE('%Y-%m', created_at) as month,
  COUNT(CASE WHEN payload.action = 'started' THEN 1 END) as stars_added,
  COUNT(CASE WHEN payload.action = 'deleted' THEN 1 END) as stars_removed,
  SUM(CASE WHEN payload.action = 'started' THEN 1 ELSE -1 END) as net_change
FROM `githubarchive.day.events`
WHERE 
  type = 'WatchEvent' 
  AND repo.name = 'promptfoo/promptfoo'
  AND created_at >= '2023-04-28'
  AND created_at <= '2025-07-24'
GROUP BY month
ORDER BY month ASC;
```

## 💰 **Cost Information**

### **BigQuery Pricing**
- **Free Tier**: 1 TB of query processing per month
- **Storage**: $0.02 per GB per month
- **Query Processing**: $5 per TB after free tier
- **GitHub Archive**: ~2.5 TB total dataset
- **Estimated Cost**: $0-5 for this analysis (likely free with tier)

### **Cost Optimization**
1. **Use DATE() filters** to limit data scanned
2. **Start with small date ranges** for testing
3. **Monitor usage** in Google Cloud Console

## 🔧 **Troubleshooting**

### **Common Issues**

1. **"Dataset not found"**
   - Make sure you've added the `githubarchive` project
   - Check that you're in the correct Google Cloud project

2. **"Permission denied"**
   - Ensure BigQuery API is enabled
   - Check that you have BigQuery User role

3. **"Query timeout"**
   - Add more specific date filters
   - Break query into smaller chunks

4. **"No results found"**
   - Check repository name spelling: `promptfoo/promptfoo`
   - Verify date range is correct
   - Try broader date range first

## 📊 **Expected Results**

### **What You'll Get**
- **Complete timeline** of all star events from April 2023 to July 2025
- **User information** for each star/unstar event
- **Running totals** showing star count progression
- **Daily/monthly summaries** for trend analysis

### **Sample Output Format**
```json
[
  {
    "created_at": "2023-04-28T16:30:00.000Z",
    "user": "first_starrer",
    "repository": "promptfoo/promptfoo",
    "action": "started",
    "running_stars": 1
  },
  {
    "created_at": "2023-04-28T17:15:00.000Z", 
    "user": "second_starrer",
    "repository": "promptfoo/promptfoo",
    "action": "started",
    "running_stars": 2
  }
]
```

## 🎯 **Next Steps**

1. **Follow the setup guide** above
2. **Run the main query** to get historical data
3. **Export results** to JSON/CSV format
4. **Import into your tracking system** or analyze further
5. **Share results** and we can process them for your application

## 📞 **Support**

If you encounter any issues:
1. Check Google Cloud Console for error messages
2. Verify BigQuery API is enabled
3. Ensure you're in the correct project
4. Try smaller date ranges for testing

**Ready to proceed with the setup?** 