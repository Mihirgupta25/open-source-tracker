# Cloud Deployment for Star Collection

This guide will help you deploy the star collection system to AWS Lambda + EventBridge, so it runs completely in the cloud without requiring your computer to stay on.

## 🚀 Quick Deployment

### 1. Stop Local Scheduler
```bash
node cleanup-local-scheduler.js
```

### 2. Deploy to AWS Cloud
```bash
node deploy-cloud-star-collector.js
```

## 📋 What Gets Deployed

### AWS Lambda Function
- **Name**: `prod-star-collector`
- **Runtime**: Node.js 18.x
- **Handler**: `index.handler`
- **Timeout**: 30 seconds
- **Memory**: 128 MB

### EventBridge Rule
- **Name**: `prod-star-collection-schedule`
- **Schedule**: Every 3 hours (`rate(3 hours)`)
- **Target**: Lambda function

### IAM Role & Permissions
- **Role**: `prod-star-collector-role`
- **Permissions**:
  - DynamoDB access to `prod-star-growth` table
  - Secrets Manager access for GitHub token
  - CloudWatch Logs for monitoring

## 🔧 How It Works

1. **EventBridge** triggers the Lambda function every 3 hours
2. **Lambda** fetches star count from GitHub API
3. **Lambda** stores the data in DynamoDB `prod-star-growth` table
4. **CloudWatch** logs all execution details

## 📊 Benefits of Cloud Deployment

### ✅ Advantages
- **No local computer needed** - runs 24/7 in AWS
- **Automatic scaling** - AWS handles the infrastructure
- **Reliable scheduling** - EventBridge is highly available
- **Cost effective** - pay only for execution time
- **Monitoring** - CloudWatch logs and metrics
- **No maintenance** - AWS handles updates and patches

### 💰 Cost Estimate
- **Lambda**: ~$0.000016 per execution (very cheap)
- **EventBridge**: Free for basic rules
- **DynamoDB**: Pay-per-request (minimal cost)
- **Total**: Less than $1/month for 8 executions/day

## 🔍 Monitoring

### View Logs
```bash
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/prod-star-collector
```

### Test Function
```bash
aws lambda invoke --function-name prod-star-collector response.json
```

### Check EventBridge Rule
```bash
aws events describe-rule --name prod-star-collection-schedule
```

## 🛠️ Manual Testing

### Test Lambda Function Locally
```bash
node lambda-star-collector.js
```

### Invoke Lambda Function
```bash
aws lambda invoke --function-name prod-star-collector --payload '{}' response.json
```

## 🗑️ Cleanup (Optional)

If you want to remove the cloud resources:

```bash
# Remove EventBridge rule
aws events remove-targets --rule prod-star-collection-schedule --ids prod-star-collector-target
aws events delete-rule --name prod-star-collection-schedule

# Remove Lambda function
aws lambda delete-function --function-name prod-star-collector

# Remove IAM role
aws iam delete-role-policy --role-name prod-star-collector-role --policy-name prod-star-collector-policy
aws iam delete-role --role-name prod-star-collector-role
```

## 📈 Schedule

The cloud deployment will collect star counts at:
- **6:00 AM PDT** - Morning collection
- **9:00 AM PDT** - Late morning collection
- **12:00 PM PDT** - Noon collection
- **3:00 PM PDT** - Afternoon collection
- **6:00 PM PDT** - Evening collection
- **9:00 PM PDT** - Night collection

## 🔐 Security

- **IAM Role**: Least privilege access
- **Secrets Manager**: Secure GitHub token storage
- **DynamoDB**: Encrypted at rest
- **Lambda**: Runs in isolated environment

## 📞 Support

If you encounter issues:
1. Check CloudWatch logs for error details
2. Verify AWS credentials are configured
3. Ensure DynamoDB table exists
4. Check EventBridge rule status

The cloud deployment provides a robust, scalable, and cost-effective solution for automated star collection! 