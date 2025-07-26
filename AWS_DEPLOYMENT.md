# AWS Deployment Guide

This guide will help you deploy the Open Source Tracker application to AWS using a serverless architecture with separate dev and prod environments.

## Architecture Overview

The application is deployed using AWS CDK with the following components:

### Infrastructure Components
- **Lambda Functions**: API endpoints and data collection scripts
- **DynamoDB Tables**: Cloud database for storing metrics
- **API Gateway**: REST API endpoints
- **S3 + CloudFront**: Static frontend hosting
- **EventBridge**: Scheduled data collection (daily)
- **Secrets Manager**: Secure storage for GitHub API tokens

### Environment Separation
- **Dev Environment**: For development and testing
- **Prod Environment**: For production use
- Each environment has its own resources and configurations

## Prerequisites

### 1. AWS Account Setup
- AWS account with free tier access
- AWS CLI installed and configured
- Appropriate IAM permissions for CDK deployment

### 2. Local Development Setup
- Node.js (v16 or higher)
- npm or yarn
- AWS CDK CLI: `npm install -g aws-cdk`

### 3. GitHub Token
- GitHub personal access token with `public_repo` scope
- Used for higher API rate limits

## Quick Deployment

### Option 1: Automated Deployment Script

```bash
# Deploy dev environment
./deploy.sh dev

# Deploy prod environment
./deploy.sh prod

# Deploy with GitHub token
./deploy.sh dev your_github_token_here
```

### Option 2: Manual Deployment

```bash
# Install dependencies
npm install
cd infrastructure && npm install && cd ..

# Build the application
cd frontend && npm run build && cd ..

# Deploy dev environment
cd infrastructure
npm run build
cdk deploy --context environment=dev

# Deploy prod environment
cdk deploy --context environment=prod
```

## Environment Configuration

### Dev Environment
- **Region**: us-east-1
- **Data Collection**: Daily at 12 PM UTC
- **Resource Retention**: Destroy on stack deletion
- **GitHub Token Secret**: `github-token-dev`

### Prod Environment
- **Region**: us-east-1
- **Data Collection**: Daily at 12 PM UTC
- **Resource Retention**: Retain critical resources
- **GitHub Token Secret**: `github-token-prod`

## Resource Details

### DynamoDB Tables
Each environment creates 4 DynamoDB tables:

1. **Star Growth Table** (`{env}-star-growth`)
   - Partition Key: `repo` (String)
   - Sort Key: `timestamp` (String)
   - Stores: Repository star counts over time

2. **PR Velocity Table** (`{env}-pr-velocity`)
   - Partition Key: `repo` (String)
   - Sort Key: `date` (String)
   - Stores: PR merge ratios by date

3. **Issue Health Table** (`{env}-issue-health`)
   - Partition Key: `repo` (String)
   - Sort Key: `date` (String)
   - Stores: Issue close ratios by date

4. **Package Downloads Table** (`{env}-package-downloads`)
   - Partition Key: `repo` (String)
   - Sort Key: `week_start` (String)
   - Stores: Weekly package download counts

### Lambda Functions
- **API Function**: Handles all API requests
- **Star Collector**: Collects star growth data
- **PR Collector**: Collects PR velocity data
- **Issue Collector**: Collects issue health data
- **Package Collector**: Collects package download data

### Scheduled Data Collection
- **Frequency**: Daily at 12 PM UTC
- **Trigger**: EventBridge rule
- **Targets**: All 4 data collection Lambda functions
- **Repository**: promptfoo/promptfoo (configurable)

## Post-Deployment Setup

### 1. Set GitHub Token
```bash
# Using AWS CLI
aws secretsmanager put-secret-value \
  --secret-id github-token-dev \
  --secret-string '{"token":"your_github_token_here"}' \
  --region us-east-1

# Or via AWS Console
# Go to Secrets Manager > github-token-{env} > Edit > Update the token value
```

### 2. Test the Application
1. Visit the frontend URL from deployment outputs
2. Test the real-time star count feature
3. Check CloudWatch logs for data collection functions

### 3. Monitor Data Collection
- **CloudWatch Logs**: Check Lambda function logs
- **DynamoDB**: Verify data is being stored
- **EventBridge**: Monitor scheduled executions

## Cost Estimation (Free Tier)

### Monthly Costs (within free tier limits)
- **Lambda**: ~$0 (1M requests/month free)
- **DynamoDB**: ~$0 (25GB storage free)
- **S3**: ~$0 (5GB storage free)
- **API Gateway**: ~$0 (1M API calls/month free)
- **EventBridge**: ~$0 (1M events/month free)
- **CloudFront**: ~$0 (1TB data transfer free)

### Beyond Free Tier
- **Lambda**: $0.20 per 1M requests
- **DynamoDB**: $1.25 per GB-month
- **API Gateway**: $3.50 per 1M API calls
- **CloudFront**: $0.085 per GB

## Management Commands

### View Stack Information
```bash
# List all stacks
aws cloudformation list-stacks

# Get stack outputs
aws cloudformation describe-stacks --stack-name OpenSourceTrackerDev
```

### Update GitHub Token
```bash
# Update token for dev environment
aws secretsmanager put-secret-value \
  --secret-id github-token-dev \
  --secret-string '{"token":"new_token"}' \
  --region us-east-1
```

### Manual Data Collection
```bash
# Invoke data collection functions manually
aws lambda invoke \
  --function-name OpenSourceTrackerDev-StarGrowthCollector \
  --payload '{}' \
  response.json
```

### Destroy Environment
```bash
# Destroy dev environment
cd infrastructure
cdk destroy --context environment=dev

# Destroy prod environment
cdk destroy --context environment=prod
```

## Troubleshooting

### Common Issues

1. **CDK Bootstrap Required**
   ```bash
   cd infrastructure
   cdk bootstrap
   ```

2. **GitHub API Rate Limits**
   - Set GitHub token in Secrets Manager
   - Check token permissions

3. **Lambda Function Errors**
   - Check CloudWatch logs
   - Verify environment variables
   - Check IAM permissions

4. **Frontend Not Loading**
   - Verify S3 bucket configuration
   - Check CloudFront distribution
   - Ensure CORS is configured

### Debug Commands
```bash
# Check Lambda logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/OpenSourceTracker"

# Test API endpoint
curl -X GET "https://your-api-gateway-url/api/stars?repo=promptfoo/promptfoo"

# Check DynamoDB data
aws dynamodb scan --table-name dev-star-growth --limit 5
```

## Security Considerations

### IAM Permissions
- Lambda functions have minimal required permissions
- Secrets Manager access is restricted to specific functions
- DynamoDB access is scoped to specific tables

### Data Protection
- GitHub tokens stored in AWS Secrets Manager
- All API communications use HTTPS
- CORS configured for frontend access

### Monitoring
- CloudWatch logs for all Lambda functions
- CloudTrail for API calls (if enabled)
- DynamoDB metrics and alarms

## Scaling Considerations

### Automatic Scaling
- Lambda functions scale automatically
- DynamoDB on-demand billing
- CloudFront global distribution

### Manual Scaling
- Increase Lambda memory/timeout
- Add DynamoDB read/write capacity
- Configure CloudFront caching

## Support and Maintenance

### Regular Maintenance
- Monitor CloudWatch logs
- Review DynamoDB costs
- Update GitHub tokens as needed
- Check for Lambda function updates

### Backup and Recovery
- DynamoDB tables can be backed up
- S3 bucket versioning (if enabled)
- CloudFormation templates for infrastructure

### Updates and Upgrades
- Update Lambda function code
- Modify CDK infrastructure
- Deploy with `cdk deploy`

## Next Steps

1. **Custom Domain**: Add Route 53 and ACM certificate
2. **Monitoring**: Set up CloudWatch alarms and dashboards
3. **CI/CD**: Configure GitHub Actions for automated deployment
4. **Multi-Region**: Deploy to additional regions for redundancy
5. **Advanced Analytics**: Add additional metrics and visualizations 