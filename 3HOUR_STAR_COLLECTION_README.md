# 3-Hour Star Collection Scripts

This directory contains scripts to collect GitHub star counts every 3 hours starting at 6:00 AM PDT and store them in DynamoDB.

## Scripts Overview

### 1. `collect-stars-3hour.js`
- **Purpose**: Collects star count from GitHub API and stores it in `prod-star-growth` DynamoDB table
- **Target Schedule**: Every 3 hours starting at 6:00 AM PDT
- **Table**: `prod-star-growth`
- **Repository**: `promptfoo/promptfoo`

### 2. `schedule-3hour-stars.js`
- **Purpose**: Scheduler that runs the star collection every 3 hours
- **Schedule**: 6:00 AM, 9:00 AM, 12:00 PM, 3:00 PM, 6:00 PM, 9:00 PM PDT
- **Auto-restart**: Automatically schedules the next run after completion

### 3. `run-3hour-collection-now.js`
- **Purpose**: Runs the star collection immediately (for testing)
- **Usage**: Manual execution for immediate data collection

## Collection Schedule

The system collects star counts at the following times (PDT):
- **6:00 AM** - Morning collection
- **9:00 AM** - Late morning collection
- **12:00 PM** - Noon collection
- **3:00 PM** - Afternoon collection
- **6:00 PM** - Evening collection
- **9:00 PM** - Night collection

## How to Use

### Start the 3-Hour Scheduler
```bash
node schedule-3hour-stars.js
```
This will:
- Calculate the delay until the next collection time
- Run the collection at the scheduled times
- Automatically schedule the next run
- Continue running until stopped (Ctrl+C)

### Run Collection Immediately
```bash
node run-3hour-collection-now.js
```
This will collect the current star count and store it immediately.

### Run Collection Script Directly
```bash
node collect-stars-3hour.js
```
This runs the collection logic directly.

## Configuration

The scripts are configured for:
- **Environment**: Production (`prod`)
- **DynamoDB Table**: `prod-star-growth`
- **GitHub Repository**: `promptfoo/promptfoo`
- **AWS Region**: `us-east-1`
- **Time Zone**: Pacific Daylight Time (PDT)
- **Collection Interval**: Every 3 hours
- **Start Time**: 6:00 AM PDT

## Data Format

Each entry in the DynamoDB table contains:
- `repo`: Repository name (e.g., "promptfoo/promptfoo")
- `timestamp`: Date in "Month Day, Year" format (e.g., "July 28, 2025")
- `count`: Current star count (number)

## Dependencies

Required packages:
- `aws-sdk`: AWS SDK for JavaScript
- `axios`: HTTP client for API calls

Install with:
```bash
npm install aws-sdk axios
```

## AWS Setup

The scripts require:
1. AWS credentials configured (`aws configure`)
2. Access to DynamoDB table `prod-star-growth`
3. Access to Secrets Manager (optional, for GitHub token)

## Monitoring

The scheduler provides real-time feedback:
- Current PDT time
- Next collection time
- Delay until next run
- Success/failure status
- Star count collected

## Stopping the Scheduler

Press `Ctrl+C` to gracefully stop the scheduler.

## Current Status

- ✅ **Scheduler is running** (process ID: 28654)
- ✅ **Scripts tested and working**
- ✅ **Successfully collected star count: 7746**
- ✅ **Data stored in `prod-star-growth` table**

The scheduler will automatically collect star counts at the next scheduled time. 