# 🌟 Open Source Growth Tracker

> **Track your GitHub repository's growth with beautiful, real-time analytics**

A modern web application that automatically collects and visualizes key metrics for open source projects, including star growth, pull request velocity, issue health, and package downloads. Built with React 19, AWS, and deployed with automated CI/CD.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Production-blue?style=for-the-badge)](https://d3ou2hv17g990f.cloudfront.net)

---

## 🚀 Quick Start

### Try It Now
- **🌐 Production**: [https://d3ou2hv17g990f.cloudfront.net](https://d3ou2hv17g990f.cloudfront.net) (Public access)

### What You'll See
- 📈 **Star Growth**: Real-time GitHub star tracking daily at 11:50 PM PST
- 🔄 **PR Velocity**: Daily pull request merge ratios
- 🏥 **Issue Health**: Daily issue resolution metrics  
- 📦 **Package Downloads**: Weekly npm download statistics
- 🔄 **Multi-Repository Support**: Switch between multiple repositories seamlessly
- 🎯 **Repository Tabs**: Track promptfoo, crewAI, and langchain repositories

---

## ✨ Features

### 📊 Real-Time Analytics
- **Unified Data Collection**: Single Lambda function collects all metrics for all repositories
- **Beautiful Visualizations**: Interactive charts with hover tooltips and zoom capabilities
- **Multi-Environment Support**: Separate staging and production environments
- **Environment Detection**: Automatic API endpoint selection
- **Multi-Repository Support**: Track multiple repositories with easy switching
- **PST Timezone**: All timestamps automatically converted to Pacific Standard Time
- **Consistent Branding**: Unified icon and styling across environments
- **Optimized Scheduling**: Efficient EventBridge rules with minimal redundancy

### 🏗️ Modern Architecture
- **Serverless**: AWS Lambda, DynamoDB, S3, CloudFront, API Gateway
- **Scalable**: EventBridge scheduling, CloudWatch monitoring
- **Secure**: AWS Secrets Manager for token management
- **Automated**: GitHub Actions CI/CD pipeline
- **React 19**: Latest React version with enhanced performance
- **Unified Collector**: Single Lambda function handles all data collection types

### 🎨 User Experience
- **Clean Design**: Card-based layout with professional aesthetics
- **Responsive**: Works on desktop, tablet, and mobile
- **Interactive**: Tabbed interface for easy navigation
- **GitHub Integration**: Direct repository access via Octocat icon
- **Local Storage**: Persistent user preferences and repository selections
- **Repository Management**: Add, remove, and switch between repositories
- **Custom App Icon**: Professional branding with consistent styling
- **Auto-Correction**: Smart localStorage management for repository tabs
- **Timestamp Consistency**: Proper date parsing for all data formats

---

## 📋 Data Collection Schedule

| Metric | Frequency | Time | Description |
|--------|-----------|------|-------------|
| ⭐ Star Growth | Daily | 11:50 PM PST | Current GitHub star count |
| 🔄 PR Velocity | Daily | 11:50 PM PST | Merged vs open PR ratios |
| 🏥 Issue Health | Daily | 11:50 PM PST | Closed vs open issue ratios |
| 📦 Package Downloads | Weekly | Sundays 11:50 PM PST | npm download statistics |

**Note**: All data collection is now unified into a single daily schedule for efficiency.

---

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- AWS CLI configured
- GitHub account

### Local Development
```bash
# Clone the repository
git clone https://github.com/Mihirgupta25/open-source-tracker.git
cd open-source-tracker

# Install dependencies
npm install

# Start development server
npm start
```

### AWS Deployment
```bash
# Deploy to staging
npm run cdk:staging

# Deploy to production  
npm run cdk:prod
```

---

## 🏗️ Architecture

For detailed information about our system architecture, data flow, and environment separation, see our **[Architecture Documentation](ARCHITECTURE.md)**.

### Quick Overview
- **Frontend**: React 19 app served via CloudFront CDN
- **Backend**: Unified Lambda function with API Gateway
- **Database**: DynamoDB with separate staging/production tables
- **Scheduling**: Optimized EventBridge rules (4 total rules)
- **Security**: AWS Secrets Manager for token management
- **Multi-Repository**: Support for tracking multiple repositories simultaneously
- **Data Migration**: Automated scripts for staging/production data synchronization

---

## 🔧 Customization

### Adding New Metrics
1. Update the unified collector Lambda function in `backend/index.js`
2. Add new data collection logic to the `triggerUnifiedCollection` function
3. Update the frontend with new chart component
4. Deploy via GitHub Actions

### Changing Collection Schedules
Edit the CDK configuration in `infrastructure/lib/open-source-tracker-stack.ts`:

```typescript
// Example: Change daily collection time
const dailyDataCollectionRule = new events.Rule(this, 'DailyDataCollectionRule', {
  schedule: events.Schedule.expression('cron(50 7 * * ? *)'), // 11:50 PM PST
});
```

### Environment Variables
```bash
# Update GitHub tokens
aws secretsmanager update-secret --secret-id github-token-prod --secret-string "your_token"
```

---

## 🚀 Deployment

### Automated CI/CD
- **Push to `main`**: Automatically deploys to production
- **Manual dispatch**: Choose staging or production environment
- **GitHub Actions**: Runs tests, builds, and deploys

### Manual Deployment
```bash
# Deploy infrastructure
cd infrastructure
npm run build
cdk deploy --context environment=prod

# Deploy frontend
npm run build
aws s3 sync frontend/build/ s3://your-bucket-name --delete
```

---

## 🔍 Monitoring & Troubleshooting

### Automation Scripts
We provide several automation scripts for monitoring and management:

```bash
# Check automation status
node scripts/check-automation.js

# Test data collection
node scripts/check-automation.js test

# Manage databases
node scripts/manage-databases.js

# Copy production data to staging
node scripts/copy-prod-to-staging.js

# Deploy staging authentication
node scripts/deploy-staging-auth.js
```

### Viewing Logs
```bash
# Lambda function logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/OpenSourceTracker"

# EventBridge rules
aws events list-rules --name-prefix "OpenSourceTracker"
```

### Common Issues
- **"Invalid Date" in charts**: Fixed with automatic timestamp format detection
- **Duplicate data points**: Implemented duplicate removal logic
- **Environment detection**: Updated to use CloudFront domain detection
- **Multi-repository switching**: Local storage persistence for user preferences
- **Timezone issues**: All timestamps now automatically converted to PST
- **Missing repository tabs**: Auto-correction logic ensures all repositories are displayed
- **EventBridge optimization**: Reduced from 10 rules to 4 essential rules

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Make** your changes and test in staging
4. **Commit** your changes: `git commit -m 'Add amazing feature'`
5. **Push** to your branch: `git push origin feature/amazing-feature`
6. **Open** a Pull Request

### Development Guidelines
- Test in staging environment first
- Follow the main branch workflow
- Update documentation
- Monitor CloudWatch logs
- Use ApexCharts for new charts
- Maintain multi-repository compatibility

---

## 🆕 Recent Updates (August 2025)

### 🔄 Unified Data Collection System
- **Unified Collector**: Single Lambda function now handles all data collection types
- **Optimized Scheduling**: Reduced EventBridge rules from 10 to 4 essential rules
- **Improved Efficiency**: All repositories processed in one scheduled run
- **Better Error Handling**: Per-repository error handling with detailed logging

### 🎯 Multi-Repository Support
- **Added langchain repository**: Now tracking promptfoo, crewAI, and langchain repositories
- **Repository initialization**: Easy setup of new repositories in production environment
- **Auto-correction logic**: Smart localStorage management ensures all repository tabs are displayed
- **Consistent data collection**: All repositories receive automated data collection

### 🕐 Timezone & Timestamp Improvements
- **PST conversion**: All timestamps automatically converted to Pacific Standard Time
- **Consistent formatting**: Unified date/time display across all environments
- **User-friendly timestamps**: "August 1, 2025 at 06:12:16 AM" format
- **Database consistency**: All new data stored with PST timestamps
- **Frontend fixes**: Proper handling of both old and new timestamp formats

### 🎨 Brand Identity
- **Custom app icon**: Professional circular icon with consistent styling
- **Unified branding**: Same icon and styling across staging and production
- **Enhanced header**: Improved layout with app icon and title
- **Responsive design**: Icon scales properly on all devices

### 🔧 Technical Improvements
- **Data migration scripts**: Automated copying of production data to staging
- **Repository mapping**: Proper handling of crewAI repository name variations
- **Frontend optimization**: Enhanced localStorage management and auto-correction
- **Production deployment**: Streamlined deployment workflow with CloudFront invalidation
- **EventBridge optimization**: Removed 6 redundant rules for cleaner management

### 🧹 Code Cleanup
- **Removed unused scripts**: Cleaned up leftover files and unused code
- **Optimized builds**: Reduced bundle sizes and improved performance
- **Enhanced documentation**: Updated scripts and deployment procedures
- **Staging environment**: Fixed GitHub token permissions and unified collector setup

---

## 🚧 Planned Features

### 📊 Enhanced Data Visualization
- **Time Period Toggles**: View data in weekly, monthly, and quarterly trends for all graphs
  - Star Growth: Toggle between daily, weekly, monthly, quarterly views
  - PR Velocity: Aggregate data by different time periods
  - Issue Health: Trend analysis across different timeframes
  - Package Downloads: Enhanced weekly/monthly breakdowns

### 🧪 Staging Environment Testing Tools
- **Database Management Buttons**: 
  - Clear database and copy production data for fresh testing
  - Manual data point creation for testing purposes
  - Reset staging environment to production state
- **Testing Interface**: 
  - Add test data points directly from the UI
  - Simulate different data scenarios
  - Validate chart rendering with custom data
- **Data Migration**: Automated scripts for copying production data to staging
- **Repository Initialization**: Easy setup of new repositories in production environment

### 🔧 Development Enhancements
- **Real-time Data Updates**: Live data refresh without page reload
- **Export Functionality**: Download charts as images or data as CSV
- **Advanced Filtering**: Filter data by date ranges and custom criteria
- **Mobile Optimization**: Enhanced responsive design for mobile devices
- **Repository Analytics**: Compare metrics across multiple repositories
- **Timezone Consistency**: All environments use PST for timestamp display
- **Brand Identity**: Consistent app icon and styling across all environments

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **GitHub API**: For comprehensive repository data
- **AWS CDK**: For infrastructure as code
- **React 19 & ApexCharts**: For beautiful UI
- **EventBridge**: For reliable scheduling

---

## 📞 Support

- **GitHub Issues**: [Create an issue](https://github.com/Mihirgupta25/open-source-tracker/issues)
- **Documentation**: Check this README and inline code comments
- **Live Demo**: [Production](https://d3ou2hv17g990f.cloudfront.net)

---

*Last updated: August 2025 - Implemented unified data collection system, optimized EventBridge rules from 10 to 4, added langchain repository support, implemented PST timezone conversion, unified app branding across environments, enhanced localStorage auto-correction, improved data migration scripts, fixed timestamp parsing issues, and optimized production deployment workflow.*
