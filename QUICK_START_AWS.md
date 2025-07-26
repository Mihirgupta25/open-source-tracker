# Quick Start: AWS Deployment

Get your Open Source Tracker running on AWS in under 10 minutes!

## Prerequisites

1. **AWS Account** with free tier access
2. **AWS CLI** installed and configured
3. **GitHub Token** (optional but recommended)

## Step 1: Setup AWS CLI

```bash
# Install AWS CLI (if not already installed)
# macOS: brew install awscli
# Linux: sudo apt-get install awscli

# Configure AWS CLI
aws configure
# Enter your AWS Access Key ID, Secret Access Key, and region (us-east-1)
```

## Step 2: Install Dependencies

```bash
# Install AWS CDK globally
npm install -g aws-cdk

# Install project dependencies
npm install
cd infrastructure && npm install && cd ..
```

## Step 3: Deploy to AWS

### Option A: Automated Deployment (Recommended)

```bash
# Deploy dev environment
./deploy.sh dev

# Deploy prod environment  
./deploy.sh prod

# Deploy with GitHub token
./deploy.sh dev your_github_token_here
```

### Option B: Manual Deployment

```bash
# Build the application
cd frontend && npm run build && cd ..

# Deploy infrastructure
cd infrastructure
npm run build
cdk bootstrap  # Only needed once per AWS account
cdk deploy --context environment=dev
cd ..
```

## Step 4: Set GitHub Token (Optional)

```bash
# Set GitHub token for higher API rate limits
aws secretsmanager put-secret-value \
  --secret-id github-token-dev \
  --secret-string '{"token":"your_github_token_here"}' \
  --region us-east-1
```

## Step 5: Test Your Deployment

1. **Get your URLs** from the deployment output
2. **Visit the frontend URL** in your browser
3. **Test the real-time star count** feature
4. **Check CloudWatch logs** for data collection

## What You Get

### Dev Environment
- **Frontend**: https://dev-open-source-tracker-frontend-{account}.s3-website-us-east-1.amazonaws.com
- **API**: https://{api-id}.execute-api.us-east-1.amazonaws.com/prod/
- **Data Collection**: Daily at 12 PM UTC

### Prod Environment  
- **Frontend**: https://prod-open-source-tracker-frontend-{account}.s3-website-us-east-1.amazonaws.com
- **API**: https://{api-id}.execute-api.us-east-1.amazonaws.com/prod/
- **Data Collection**: Daily at 12 PM UTC

## Cost Breakdown

### Free Tier (First 12 Months)
- **Lambda**: 1M requests/month
- **DynamoDB**: 25GB storage
- **S3**: 5GB storage  
- **API Gateway**: 1M API calls/month
- **CloudFront**: 1TB data transfer
- **Total**: ~$0/month

### Beyond Free Tier
- **Lambda**: $0.20 per 1M requests
- **DynamoDB**: $1.25 per GB-month
- **API Gateway**: $3.50 per 1M API calls
- **CloudFront**: $0.085 per GB

## Troubleshooting

### Common Issues

1. **CDK Bootstrap Required**
   ```bash
   cd infrastructure && cdk bootstrap
   ```

2. **AWS CLI Not Configured**
   ```bash
   aws configure
   ```

3. **GitHub API Rate Limits**
   - Set GitHub token in Secrets Manager
   - Check token permissions

4. **Frontend Not Loading**
   - Wait 5-10 minutes for CloudFront propagation
   - Check S3 bucket configuration

### Useful Commands

```bash
# Check deployment status
aws cloudformation describe-stacks --stack-name OpenSourceTrackerDev

# View Lambda logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/OpenSourceTracker"

# Test API endpoint
curl "https://your-api-gateway-url/api/stars?repo=promptfoo/promptfoo"

# Destroy environment
cd infrastructure && cdk destroy --context environment=dev
```

## Next Steps

1. **Custom Domain**: Add Route 53 and SSL certificate
2. **Monitoring**: Set up CloudWatch alarms
3. **CI/CD**: Configure GitHub Actions
4. **Backup**: Enable DynamoDB backups
5. **Scaling**: Monitor and adjust resources

## Support

- **Documentation**: See `AWS_DEPLOYMENT.md` for detailed guide
- **Issues**: Check CloudWatch logs for errors
- **Costs**: Monitor AWS Cost Explorer
- **Security**: Review IAM permissions regularly

---

**🎉 Congratulations!** Your Open Source Tracker is now running on AWS with automatic daily data collection! 