# Scripts Directory

This directory contains various utility scripts for managing the Open Source Tracker project.

## 📁 Script Categories

### 🔧 **Data Management Scripts**

#### **CrewAI Data Scripts**
- `add-crewai-historical-data.js` - Add historical crewAI data to staging
- `add-crewai-daily-data.js` - Add daily crewAI data points
- `add-crewai-manual-star.js` - Add manual star count for crewAI
- `clean-crewai-data.js` - Clear existing crewAI data and add clean set
- `check-crewai-data.js` - Check crewAI data in DynamoDB tables
- `copy-crewai-to-production.js` - Copy crewAI data from staging to production
- `update-crewai-repo-name.js` - Update crewAI repository name mapping
- `add-real-crewai-data.js` - Add real crewAI data points to staging

#### **Langchain Data Scripts**
- `add-langchain-historical-data.js` - Add historical langchain data (old dates)
- `add-correct-langchain-data.js` - Add correct historical langchain data (2022-2025)
- `add-langchain-to-production.js` - Add langchain data to production
- `clear-langchain-data.js` - Clear existing langchain data from staging

#### **General Data Scripts**
- `upload-historical-data.js` - Upload historical data to DynamoDB
- `restore-original-data.js` - Restore original data from backup
- `restore-prod-from-staging.js` - Restore production data from staging
- `clear-and-manual-entry.js` - Clear data and add manual entries
- `check-data.js` - Check data in DynamoDB tables
- `upload-crewai-data.js` - Upload crewAI data to DynamoDB

### 🔍 **GitHub API Scripts**

#### **Star History Scripts**
- `fetch-stargazers-with-dates.js` - Fetch stargazers with dates from GitHub API
- `fetch-historical-stars.js` - Fetch historical star data
- `fetch-comprehensive-stars.js` - Fetch comprehensive star data
- `fetch-promptfoo-historical-stars.js` - Fetch promptfoo historical stars
- `github-api-historical.js` - GitHub API historical data collection
- `github-api-last-year.js` - GitHub API data for last year
- `github-api-weekly.js` - GitHub API weekly data collection
- `github-api-daily-since-july.js` - GitHub API daily data since July
- `simple-star-history.js` - Simple star history collection

#### **GitHub Archive Scripts**
- `fetch-github-archive-stars.js` - Fetch stars from GitHub Archive
- `github-archive-star-history.js` - GitHub Archive star history
- `github-archive-monthly.js` - GitHub Archive monthly data
- `github-archive-weekly.js` - GitHub Archive weekly data
- `github-archive-last-year.js` - GitHub Archive last year data
- `github-archive-backwards.js` - GitHub Archive backwards data collection
- `github-archive-bigquery.js` - GitHub Archive BigQuery integration
- `extract-last-year.js` - Extract last year data from archive

#### **GraphQL Scripts**
- `github-graphql-last-year.js` - GitHub GraphQL API for last year data

### 🔧 **BigQuery Scripts**
- `process-bigquery-results.js` - Process BigQuery results
- `bigquery-star-history.sql` - BigQuery SQL for star history
- `test-bigquery-cost.js` - Test BigQuery cost analysis

### 🚀 **Deployment & Infrastructure Scripts**
- `deploy-staging-auth.js` - Deploy staging authentication
- `manage-databases.js` - Manage DynamoDB databases
- `check-automation.js` - Check automation status
- `trigger-data-collection.js` - Trigger data collection manually

### 🔍 **Debug & Analysis Scripts**
- `debug-stargazers.js` - Debug stargazers data
- `check-available-events.js` - Check available GitHub events

## 📋 **Usage Examples**

### **Data Management**
```bash
# Add historical data to staging
node scripts/add-crewai-historical-data.js

# Check data in tables
node scripts/check-crewai-data.js

# Copy data between environments
node scripts/copy-crewai-to-production.js
```

### **GitHub API**
```bash
# Fetch historical stars
node scripts/fetch-historical-stars.js

# Fetch from GitHub Archive
node scripts/fetch-github-archive-stars.js
```

### **Deployment**
```bash
# Deploy staging auth
node scripts/deploy-staging-auth.js

# Manage databases
node scripts/manage-databases.js
```

## 📝 **Notes**

- Most scripts require AWS credentials to be configured
- Some scripts require GitHub API tokens
- BigQuery scripts require Google Cloud credentials
- Always test scripts in staging environment first
- Check script dependencies before running

## 🔧 **Dependencies**

- AWS SDK for JavaScript
- GitHub API client
- BigQuery client (for BigQuery scripts)
- Node.js environment

## 📊 **Data Sources**

- **GitHub API**: Real-time repository data
- **GitHub Archive**: Historical repository data
- **BigQuery**: Large-scale data analysis
- **DynamoDB**: Application data storage 