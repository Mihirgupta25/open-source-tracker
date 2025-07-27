# Open Source Growth Tracker

A modern web app to track GitHub repository traction metrics, including star growth, pull request velocity, issue health, and package downloads, with a beautiful and intuitive UI. Now deployed on AWS with separate dev and production environments.

---

## 🌟 Latest Features (Recent Updates)

### 🎨 Enhanced UI Design
- **Clean Header Layout**: Centered title with GitHub Octocat icon in top right corner
- **Professional Design**: Matches modern website aesthetics like promptfoo
- **GitHub Integration**: Direct link to repository via Octocat icon
- **Environment Indicators**: Dev environment shows indicator, production is clean
- **Updated Chart Descriptions**: Clean descriptions with informative footnotes
  - **Star Growth**: "Data is collected from the GitHub API every 3 hours"
  - **Pull Request Velocity**: "Data is collected from the GitHub API and updates daily at 11:50 PM PST"
  - **Issue Health**: "Data is collected from the GitHub API and updates daily at 11:50 PM PST"
  - **Package Downloads**: "Data is collected weekly from the npm Registry API"

### 🚀 AWS Cloud Deployment
- **Serverless Architecture**: Lambda functions, DynamoDB, S3, CloudFront, API Gateway
- **Multi-Environment Setup**: Separate dev and production environments
- **Environment Indicators**: Visual badges for dev environment only
- **Password Protection**: Dev environment requires authentication
- **Automated CI/CD**: GitHub Actions for seamless deployments

### 📊 Enhanced Data Collection
- **Smart Scheduling**: Different collection frequencies for different metrics
  - **Star Growth**: Every 3 hours starting at 3 AM PST
  - **PR Velocity & Issue Health**: Daily at 11:50 PM PST
  - **Package Downloads**: Weekly on Sundays at 11:50 PM PST
- **Timezone Handling**: All timestamps in PST for consistency
- **Dual Format Support**: Handles both old and new timestamp formats

### 🎨 UI Improvements
- **Fixed Chart Display**: Resolved "Invalid Date" issues in star growth charts
- **Environment Badges**: Clear visual indicators for dev environment only
- **Responsive Design**: Optimized for all screen sizes
- **Real-time Data**: Automatic data collection and storage

---

## Features

- **Multi-Environment Support**
  - **Dev Environment**: Password-protected with "🚧 DEV ENVIRONMENT 🚧" badge
  - **Production Environment**: Public access with clean, professional interface
  - **Shared Database**: Both environments use the same DynamoDB tables for consistency

- **Comprehensive Analytics Dashboard**
  - **Star Growth Chart:** Visualizes historical GitHub star growth with proper timestamp formatting
  - **Pull Request Velocity Chart:** Shows merged vs open PR ratios over time
  - **Issue Health Chart:** Displays closed vs open issue ratios
  - **Package Downloads Chart:** Tracks weekly npm download statistics

- **Real-time Data Collection**
  - **Automated Scripts**: AWS Lambda functions collect data on scheduled intervals
  - **EventBridge Rules**: Reliable scheduling for all collection tasks
  - **DynamoDB Storage**: Scalable cloud database with automatic backups

- **Modern, Responsive UI**
  - **Tabbed Interface**: Easy navigation between different metrics
  - **Interactive Charts**: Hover tooltips and zoom capabilities
  - **Clean Design**: Card-based layout with clear visual hierarchy
  - **Environment Awareness**: Automatic detection and display of current environment
  - **GitHub Integration**: Direct repository access via Octocat icon

- **Developer-Friendly**
  - **GitHub Actions CI/CD**: Automated testing and deployment
  - **Infrastructure as Code**: AWS CDK for reproducible deployments
  - **Environment Variables**: Secure token management via AWS Secrets Manager
  - **Comprehensive Logging**: CloudWatch logs for debugging and monitoring

---

## 🚀 Quick Start - AWS Deployment

### Access the Live Application

**Production Environment:**
- **URL**: https://d14l4o1um83q49.cloudfront.net
- **Features**: Public access, clean interface, all features available

**Development Environment:**
- **URL**: https://dci8qqj8zzoob.cloudfront.net
- **Login**: Username: `dev`, Password: `tracker2024`
- **Features**: Password-protected, environment indicator, same functionality as production
- **Security**: Credentials stored in AWS Secrets Manager, not in code

### Local Development Setup

1. **Clone and install:**
   ```bash
   git clone https://github.com/Mihirgupta25/open-source-tracker.git
   cd open-source-tracker
   npm install
   ```

2. **Set up AWS credentials:**
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, and region (us-east-1)
   ```

3. **Deploy to dev environment:**
   ```bash
   npm run cdk:dev
   ```

4. **Deploy to production:**
   ```bash
   npm run cdk:prod
   ```

---

## 📊 Data Collection Schedule

### Automated Collection Scripts

**Star Growth Collection:**
- **Frequency**: Every 3 hours starting at 3 AM PST
- **Next runs**: 6:00 AM, 9:00 AM, 12:00 PM, 3:00 PM, 6:00 PM, 9:00 PM PST
- **Data**: Current star count for promptfoo/promptfoo repository

**Pull Request Velocity Collection:**
- **Frequency**: Daily at 11:50 PM PST
- **Data**: Open and merged PR counts, calculates ratio

**Issue Health Collection:**
- **Frequency**: Daily at 11:50 PM PST
- **Data**: Open and closed issue counts, calculates ratio

**Package Downloads Collection:**
- **Frequency**: Weekly on Sundays at 11:50 PM PST
- **Data**: Weekly npm download statistics

### Manual Data Management

**View Collection Logs:**
```bash
# Check recent star growth collections
aws logs get-log-events --log-group-name "/aws/lambda/OpenSourceTrackerDevV2-StarGrowthCollectorF1B47D4F-QAc5hVYWDI4G" --log-stream-name "latest"

# Check collection schedules
aws events list-rules --output json | grep -A 5 "OpenSourceTracker"
```

**Database Operations:**
```bash
# View star growth data
aws dynamodb scan --table-name dev-star-growth --output json | jq '.Items[] | {timestamp: .timestamp.S, star_count: .star_count.N}'

# Remove duplicate entries
aws dynamodb delete-item --table-name dev-star-growth --key '{"repo": {"S": "promptfoo/promptfoo"}, "timestamp": {"S": "2025-07-26 19:00:33"}}'
```

---

## 🏗️ Architecture

### AWS Services Used

**Compute & API:**
- **AWS Lambda**: Serverless functions for data collection and API handling
- **API Gateway**: RESTful API endpoints for frontend communication
- **Lambda@Edge**: Authentication for dev environment

**Storage & Database:**
- **DynamoDB**: NoSQL database for storing all metrics data
- **S3**: Static website hosting for the React frontend
- **Secrets Manager**: Secure storage for GitHub API tokens

**Networking & CDN:**
- **CloudFront**: Global content delivery network
- **Route 53**: DNS management (optional for custom domains)

**Orchestration:**
- **EventBridge**: Scheduled triggers for data collection
- **CloudWatch**: Logging and monitoring
- **CloudFormation**: Infrastructure management via CDK

### Environment Structure

```
AWS Account
├── Dev Environment (OpenSourceTrackerDevV2)
│   ├── Frontend: dci8qqj8zzoob.cloudfront.net
│   ├── API: v7ka0hnhgg.execute-api.us-east-1.amazonaws.com
│   ├── Database: Shared DynamoDB tables
│   └── Features: Environment indicator, password protection
│
├── Production Environment (OpenSourceTrackerProdV2)
│   ├── Frontend: d14l4o1um83q49.cloudfront.net
│   ├── API: fwaonagbbh.execute-api.us-east-1.amazonaws.com
│   ├── Database: Shared DynamoDB tables
│   └── Features: Clean interface, public access
│
└── Shared Resources
    ├── DynamoDB Tables: dev-star-growth, dev-pr-velocity, etc.
    ├── GitHub Tokens: github-token-dev, github-token-prod
    └── Lambda Layers: Shared dependencies
```

---

## 🔧 Development Workflow

### Making Changes

1. **Development Phase:**
   ```bash
   # Make your changes to the code
   git add .
   git commit -m "Your changes"
   git push origin develop
   ```

2. **Automatic Deployment:**
   - GitHub Actions automatically deploys to dev environment
   - Test your changes at https://dci8qqj8zzoob.cloudfront.net

3. **Production Deployment:**
   ```bash
   # Merge to main branch
   git checkout main
   git merge develop
   git push origin main
   ```
   - GitHub Actions automatically deploys to production
   - Changes go live at https://d14l4o1um83q49.cloudfront.net

### Environment Management

**Dev Environment:**
- **Purpose**: Testing new features and changes
- **Access**: Password-protected (dev/tracker2024)
- **Deployment**: Automatic on push to `develop` branch
- **Database**: Shared with production for consistency
- **UI**: Shows environment indicator for testing
- **Security**: Credentials managed via AWS Secrets Manager

**Production Environment:**
- **Purpose**: Live application for end users
- **Access**: Public
- **Deployment**: Automatic on push to `main` branch
- **Database**: Shared with dev for consistency
- **UI**: Clean, professional interface without environment indicators

---

## 📁 Project Structure

```
open-source-tracker/
├── infrastructure/           # AWS CDK infrastructure code
│   ├── bin/app.ts           # CDK app entry point
│   ├── lib/                 # Stack definitions
│   └── lambda-edge/         # Lambda@Edge authentication
├── backend/                 # Backend application
│   ├── lambda-index.js      # API Gateway Lambda handler
│   └── scripts/             # Data collection scripts
│       ├── star-collector.js
│       ├── pr-collector.js
│       ├── issue-collector.js
│       └── package-collector.js
├── frontend/                # React frontend
│   ├── src/App.js           # Main application component
│   └── public/              # Static assets
├── .github/workflows/       # GitHub Actions CI/CD
└── package.json             # Project dependencies and scripts
```

---

## 🛠️ Customization

### Changing Collection Schedules

Edit the CDK configuration in `infrastructure/lib/open-source-tracker-stack.ts`:

```typescript
// Star growth: every 3 hours starting at 3 AM PST
const frequentDataCollectionRule = new events.Rule(this, 'FrequentDataCollectionRule', {
  schedule: events.Schedule.expression('cron(0 11/3 * * ? *)'), // 11 AM UTC = 3 AM PST
});

// PR velocity and issue health: daily at 11:50 PM PST
const dailyDataCollectionRule = new events.Rule(this, 'DailyDataCollectionRule', {
  schedule: events.Schedule.expression('cron(50 7 * * ? *)'), // 7:50 AM UTC = 11:50 PM PST
});

// Package downloads: weekly on Sundays at 11:50 PM PST
const weeklyDataCollectionRule = new events.Rule(this, 'WeeklyDataCollectionRule', {
  schedule: events.Schedule.expression('cron(50 7 ? * SUN *)'), // 7:50 AM UTC on Sundays
});
```

### Adding New Metrics

1. **Create Lambda Function:**
   ```javascript
   // backend/scripts/new-metric-collector.js
   exports.handler = async (event) => {
     // Collect your data
     // Store in DynamoDB
     return { statusCode: 200, body: JSON.stringify({ success: true }) };
   };
   ```

2. **Add to CDK Stack:**
   ```typescript
   const newMetricCollector = new lambda.Function(this, 'NewMetricCollector', {
     runtime: lambda.Runtime.NODEJS_18_X,
     handler: 'new-metric-collector.handler',
     code: lambda.Code.fromAsset('../backend/scripts'),
   });
   ```

3. **Update Frontend:**
   - Add new API endpoint
   - Create new chart component
   - Update data fetching logic

### Environment Variables

**GitHub Token Management:**
```bash
# Update dev environment token
aws secretsmanager update-secret --secret-id github-token-dev --secret-string "your_new_token"

# Update production environment token
aws secretsmanager update-secret --secret-id github-token-prod --secret-string "your_new_token"
```

**Dev Environment Credentials Management:**
```bash
# Set up initial dev credentials
npm run dev:auth:setup

# Update dev credentials (requires AWS CLI access)
aws secretsmanager update-secret --secret-id dev-credentials --secret-string '{"username":"dev","password":"your_new_password"}'

# Update credentials in deployment
npm run dev:auth:update
```

---

## 🔍 Monitoring & Troubleshooting

### Viewing Logs

**Lambda Function Logs:**
```bash
# Star growth collector logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/OpenSourceTrackerDevV2-StarGrowthCollector"

# View recent logs
aws logs get-log-events --log-group-name "/aws/lambda/OpenSourceTrackerDevV2-StarGrowthCollectorF1B47D4F-QAc5hVYWDI4G" --log-stream-name "latest"
```

**EventBridge Rules:**
```bash
# Check collection schedules
aws events list-rules --output json | grep -A 5 "OpenSourceTracker"

# View rule targets
aws events list-targets-by-rule --rule OpenSourceTrackerDevV2-FrequentDataCollectionRule5D-wXjXecw3nkB5
```

### Common Issues

**"Invalid Date" in Charts:**
- ✅ **Fixed**: Updated timestamp parsing to handle both old and new formats
- **Cause**: Mixed timestamp formats in database
- **Solution**: Automatic format detection and conversion

**Duplicate Data Points:**
- ✅ **Fixed**: Implemented duplicate removal logic
- **Cause**: Multiple collection runs at similar times
- **Solution**: Keep latest entry for each date/time

**Environment Indicator Issues:**
- ✅ **Fixed**: Updated detection logic to use hostname instead of API URL
- **Cause**: Shared API between environments
- **Solution**: Detect environment based on CloudFront domain

**Collection Script Failures:**
- **Check**: CloudWatch logs for Lambda function errors
- **Common Causes**: GitHub API rate limits, network issues
- **Solution**: Verify GitHub token permissions and network connectivity

---

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and test in dev environment
4. **Commit your changes**: `git commit -m 'Add amazing feature'`
5. **Push to the branch**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Development Guidelines

- **Test in dev environment first**: All changes should be tested in the dev environment before production
- **Follow the deployment workflow**: Use the develop → main branch workflow
- **Update documentation**: Keep README and inline comments up to date
- **Monitor logs**: Check CloudWatch logs for any issues after deployment

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **GitHub API**: For providing comprehensive repository data
- **AWS CDK**: For infrastructure as code capabilities
- **React & Recharts**: For the beautiful, interactive UI
- **EventBridge**: For reliable scheduled task execution

---

## 📞 Support

For issues, questions, or contributions:
- **GitHub Issues**: [Create an issue](https://github.com/Mihirgupta25/open-source-tracker/issues)
- **Email**: [Your email here]
- **Documentation**: Check this README and inline code comments

---

*Last updated: July 27, 2025 - Enhanced UI with GitHub integration, clean production interface, updated chart descriptions and footnotes, and improved user experience.*
