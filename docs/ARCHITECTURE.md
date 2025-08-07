# 🏗️ Architecture Documentation

## System Overview

The Open Source Growth Tracker is built on AWS serverless architecture with separate staging and production environments. This document explains the technical design, data flow, and environment separation.

---

## 🏛️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Interface                                │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │   Production    │    │    Staging      │    │   Development   │        │
│  │   Frontend      │    │   Frontend      │    │   Frontend      │        │
│  │ (CloudFront)    │    │ (CloudFront)    │    │   (Local)       │        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API Gateway                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │   Production    │    │    Staging      │    │   Development   │        │
│  │   API Gateway   │    │   API Gateway   │    │   API Gateway   │        │
│  │ (REST Endpoints)│    │ (REST Endpoints)│    │ (REST Endpoints)│        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Lambda Functions                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │   API Lambda    │    │   Data Collection│   │   Authentication│        │
│  │   (Read Data)   │    │   Lambda        │    │   Lambda@Edge   │        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DynamoDB Tables                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │   Production    │    │    Staging      │    │   Shared        │        │
│  │   Tables        │    │   Tables        │    │   Resources     │        │
│  │ (prod-*)        │    │ (staging-*)     │    │ (GitHub Tokens) │        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EventBridge                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │   Production    │    │    Staging      │    │   Monitoring    │        │
│  │   Schedules     │    │   Schedules     │    │   & Logging     │        │
│  │ (Every 3h, Daily)│   │ (Every 3h, Daily)│   │ (CloudWatch)   │        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Architecture

### Table Structure

We use **separate DynamoDB tables** for staging and production environments to ensure data isolation and safe testing.

#### Production Tables (`prod-*`)
```
prod-star-growth
├── Primary Key: repo (String)
├── Sort Key: timestamp (String)
└── Attributes:
    ├── star_count (Number)
    └── environment (String) = "prod"

prod-pr-velocity  
├── Primary Key: repo (String)
├── Sort Key: timestamp (String)
└── Attributes:
    ├── open_prs (Number)
    ├── merged_prs (Number)
    ├── ratio (Number)
    └── environment (String) = "prod"

prod-issue-health
├── Primary Key: repo (String)
├── Sort Key: timestamp (String)
└── Attributes:
    ├── open_issues (Number)
    ├── closed_issues (Number)
    ├── ratio (Number)
    └── environment (String) = "prod"

prod-package-downloads
├── Primary Key: repo (String)
├── Sort Key: timestamp (String)
└── Attributes:
    ├── weekly_downloads (Number)
    ├── total_downloads (Number)
    └── environment (String) = "prod"
```

#### Staging Tables (`staging-*`)
```
staging-star-growth
├── Primary Key: repo (String)
├── Sort Key: timestamp (String)
└── Attributes:
    ├── star_count (Number)
    └── environment (String) = "staging"

staging-pr-velocity
├── Primary Key: repo (String)
├── Sort Key: timestamp (String)
└── Attributes:
    ├── open_prs (Number)
    ├── merged_prs (Number)
    ├── ratio (Number)
    └── environment (String) = "staging"

staging-issue-health
├── Primary Key: repo (String)
├── Sort Key: timestamp (String)
└── Attributes:
    ├── open_issues (Number)
    ├── closed_issues (Number)
    ├── ratio (Number)
    └── environment (String) = "staging"

staging-package-downloads
├── Primary Key: repo (String)
├── Sort Key: timestamp (String)
└── Attributes:
    ├── weekly_downloads (Number)
    ├── total_downloads (Number)
    └── environment (String) = "staging"
```

### Data Isolation Strategy

**Why Separate Tables?**
- ✅ **Safe Testing**: Staging changes don't affect production data
- ✅ **Independent Scaling**: Each environment can scale independently
- ✅ **Clear Separation**: Easy to identify which environment data belongs to
- ✅ **Rollback Safety**: Production data remains untouched during testing

**Shared Resources:**
- 🔑 **GitHub Tokens**: Stored in AWS Secrets Manager
- 📊 **Lambda Layers**: Shared dependencies across environments
- 🔐 **IAM Roles**: Similar permissions structure

---

## 🔄 Data Flow

### 1. Data Collection Flow

```
GitHub API / npm Registry
         │
         ▼
┌─────────────────┐
│  EventBridge    │ ← Scheduled triggers
│  (Scheduler)    │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  Lambda         │ ← Data collection functions
│  Functions      │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│  DynamoDB       │ ← Environment-specific tables
│  Tables         │
└─────────────────┘
```

### 2. Data Retrieval Flow

```
User Browser
     │
     ▼
┌─────────────────┐
│  React App      │ ← Frontend application
│  (Frontend)     │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  API Gateway    │ ← REST API endpoints
│  (Backend)      │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Lambda         │ ← API handler functions
│  Functions      │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  DynamoDB       │ ← Read from environment tables
│  Tables         │
└─────────────────┘
```

### 3. Environment Detection Flow

```
User visits URL
     │
     ▼
┌─────────────────┐
│  CloudFront     │ ← CDN determines environment
│  Distribution   │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  React App      │ ← Frontend detects environment
│  (Environment   │   based on hostname
│   Detection)    │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  API Gateway    │ ← Routes to correct backend
│  (Environment   │
│   Routing)      │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│  Lambda         │ ← Reads from environment-
│  Functions      │   specific DynamoDB tables
└─────────────────┘
```

---

## 🏢 Environment Separation

### Production Environment
- **Frontend**: `d14l4o1um83q49.cloudfront.net`
- **API**: `fwaonagbbh.execute-api.us-east-1.amazonaws.com`
- **Tables**: `prod-star-growth`, `prod-pr-velocity`, `prod-issue-health`, `prod-package-downloads`
- **Features**: Public access, clean interface, no debug info
- **Deployment**: Automatic on push to `main` branch

### Staging Environment
- **Frontend**: `d1j9ixntt6x51n.cloudfront.net`
- **API**: `k3wr4zoexk.execute-api.us-east-1.amazonaws.com`
- **Tables**: `staging-star-growth`, `staging-pr-velocity`, `staging-issue-health`, `staging-package-downloads`
- **Features**: Password-protected, environment indicator, same functionality
- **Deployment**: Manual via GitHub Actions workflow dispatch

### Environment Detection Logic

```javascript
// Frontend environment detection
function getApiBaseUrl() {
  const hostname = window.location.hostname;
  
  if (hostname.includes('d1j9ixntt6x51n')) {
    // Staging environment
    return 'https://k3wr4zoexk.execute-api.us-east-1.amazonaws.com/prod';
  } else {
    // Production environment
    return 'https://fwaonagbbh.execute-api.us-east-1.amazonaws.com/prod';
  }
}
```

---

## 🔧 AWS Services Integration

### Compute Layer
- **AWS Lambda**: Serverless functions for data collection and API handling
- **API Gateway**: RESTful API endpoints with automatic scaling
- **Lambda@Edge**: Authentication for staging environment

### Storage Layer
- **DynamoDB**: NoSQL database with automatic scaling and backups
- **S3**: Static website hosting for React frontend
- **Secrets Manager**: Secure storage for GitHub API tokens

### Networking Layer
- **CloudFront**: Global CDN for frontend delivery
- **Route 53**: DNS management (optional for custom domains)

### Orchestration Layer
- **EventBridge**: Scheduled triggers for data collection
- **CloudWatch**: Logging, monitoring, and alerting
- **CloudFormation**: Infrastructure management via CDK

---

## 📊 Data Collection Schedule

### Production Schedule
| Metric | Frequency | Time (PDT) | Lambda Function |
|--------|-----------|------------|-----------------|
| ⭐ Star Growth | Every 3 hours | Starting 3:00 AM | `OpenSourceTrackerProdV2-StarGrowthCollectorF1B47D4F-QAc5hVYWDI4G` |
| 🔄 PR Velocity | Daily | 11:50 PM | `OpenSourceTrackerProdV2-PRVelocityCollectorF1B47D4F-QAc5hVYWDI4G` |
| 🏥 Issue Health | Daily | 11:50 PM | `OpenSourceTrackerProdV2-IssueHealthCollectorF1B47D4F-QAc5hVYWDI4G` |
| 📦 Package Downloads | Weekly | Sundays 11:50 PM | `OpenSourceTrackerProdV2-PackageDownloadsCollectorF1B47D4F-QAc5hVYWDI4G` |

### Staging Schedule
| Metric | Frequency | Time (PDT) | Lambda Function |
|--------|-----------|------------|-----------------|
| ⭐ Star Growth | Every 3 hours | Starting 12:00 PM | `OpenSourceTrackerStagingV-StarGrowthCollectorF1B47-ZJWbEh13nHFc` |
| 🔄 PR Velocity | Daily | 11:50 PM | `OpenSourceTrackerStagingV-PRVelocityCollectorF1B47-ZJWbEh13nHFc` |
| 🏥 Issue Health | Daily | 11:50 PM | `OpenSourceTrackerStagingV-IssueHealthCollectorF1B47-ZJWbEh13nHFc` |
| 📦 Package Downloads | Weekly | Sundays 11:50 PM | `OpenSourceTrackerStagingV-PackageDownloadsCollectorF1B47-ZJWbEh13nHFc` |

---

## 🔐 Security Architecture

### Authentication & Authorization
- **Production**: Public access, no authentication required
- **Staging**: Password protection via Lambda@Edge
- **Credentials**: Stored in AWS Secrets Manager
- **IAM**: Least privilege access to DynamoDB tables

### Data Security
- **Encryption**: All data encrypted at rest and in transit
- **Access Control**: Environment-specific IAM roles
- **Token Management**: GitHub tokens stored securely in Secrets Manager
- **Network Security**: VPC isolation for Lambda functions

---

## 📈 Monitoring & Observability

### CloudWatch Logs
- **Lambda Functions**: Automatic logging of all function executions
- **API Gateway**: Request/response logging
- **Error Tracking**: Centralized error monitoring

### Metrics & Alarms
- **Data Collection**: Monitor successful/failed collection runs
- **API Performance**: Response time and error rate monitoring
- **Database**: DynamoDB read/write capacity monitoring

### Health Checks
- **Collection Scripts**: Verify data is being collected on schedule
- **API Endpoints**: Ensure endpoints are responding correctly
- **Frontend**: Monitor application availability

---

## 🚀 Deployment Architecture

### CI/CD Pipeline
```
GitHub Repository
       │
       ▼
┌─────────────────┐
│  GitHub Actions │ ← Automated testing and deployment
│  (CI/CD)        │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│  AWS CDK        │ ← Infrastructure as Code
│  (Deployment)   │
└─────────────────┘
       │
       ▼
┌─────────────────┐
│  AWS Services   │ ← Lambda, DynamoDB, API Gateway, etc.
│  (Resources)    │
└─────────────────┘
```

### Deployment Strategy
- **Infrastructure**: Deployed via AWS CDK
- **Frontend**: Built and deployed to S3/CloudFront
- **Backend**: Lambda functions deployed with code updates
- **Database**: Schema changes via CDK migrations

---

## 🔄 Migration & Data Management

### Table Migration Process
When we migrated from `dev-*` to `staging-*` tables:

1. **Create New Tables**: CDK creates new `staging-*` tables
2. **Migrate Data**: Copy all data from `dev-*` to `staging-*`
3. **Update Lambdas**: Point collection functions to new tables
4. **Update API**: Point API functions to new tables
5. **Test**: Verify staging environment works with new tables
6. **Cleanup**: Delete old `dev-*` tables

### Data Synchronization
- **Production Sync**: Copy staging data to production tables
- **Backup Strategy**: DynamoDB automatic backups
- **Recovery**: Point-in-time recovery capabilities

---

## 🛠️ Troubleshooting Guide

### Common Issues

**Data Collection Failures:**
- Check CloudWatch logs for Lambda function errors
- Verify GitHub token permissions
- Check EventBridge rule schedules

**API Errors:**
- Verify IAM permissions for DynamoDB access
- Check API Gateway configuration
- Monitor Lambda function timeouts

**Frontend Issues:**
- Clear CloudFront cache for frontend updates
- Check environment detection logic
- Verify API endpoint configuration

### Debug Commands
```bash
# Check Lambda function logs
aws logs get-log-events --log-group-name "/aws/lambda/OpenSourceTrackerProdV2-StarGrowthCollectorF1B47D4F-QAc5hVYWDI4G"

# Check EventBridge rules
aws events list-rules --name-prefix "OpenSourceTracker"

# Check DynamoDB data
aws dynamodb scan --table-name prod-star-growth --limit 5

# Check API Gateway
aws apigateway get-rest-apis
```

---

*This architecture ensures reliable, scalable, and maintainable data collection and visualization for open source project metrics.* 