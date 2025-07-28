# 🌟 Open Source Growth Tracker

> **Track your GitHub repository's growth with beautiful, real-time analytics**

A modern web application that automatically collects and visualizes key metrics for open source projects, including star growth, pull request velocity, issue health, and package downloads. Built with React, AWS, and deployed with automated CI/CD.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Production-blue?style=for-the-badge)](https://d14l4o1um83q49.cloudfront.net)
[![Staging](https://img.shields.io/badge/Staging-Testing-orange?style=for-the-badge)](https://d1j9ixntt6x51n.cloudfront.net)

---

## 🚀 Quick Start

### Try It Now
- **🌐 Production**: [https://d14l4o1um83q49.cloudfront.net](https://d14l4o1um83q49.cloudfront.net) (Public access)
- **🧪 Staging**: [https://d1j9ixntt6x51n.cloudfront.net](https://d1j9ixntt6x51n.cloudfront.net) (Login: `dev` / `tracker2024`)

### What You'll See
- 📈 **Star Growth**: Real-time GitHub star tracking every 3 hours
- 🔄 **PR Velocity**: Daily pull request merge ratios
- 🏥 **Issue Health**: Daily issue resolution metrics  
- 📦 **Package Downloads**: Weekly npm download statistics

---

## ✨ Features

### 📊 Real-Time Analytics
- **Automated Data Collection**: AWS Lambda functions collect data on scheduled intervals
- **Beautiful Visualizations**: Interactive charts with hover tooltips and zoom capabilities
- **Multi-Environment Support**: Separate staging and production environments
- **Environment Detection**: Automatic API endpoint selection

### 🏗️ Modern Architecture
- **Serverless**: AWS Lambda, DynamoDB, S3, CloudFront, API Gateway
- **Scalable**: EventBridge scheduling, CloudWatch monitoring
- **Secure**: AWS Secrets Manager for token management
- **Automated**: GitHub Actions CI/CD pipeline

### 🎨 User Experience
- **Clean Design**: Card-based layout with professional aesthetics
- **Responsive**: Works on desktop, tablet, and mobile
- **Interactive**: Tabbed interface for easy navigation
- **GitHub Integration**: Direct repository access via Octocat icon

---

## 📋 Data Collection Schedule

| Metric | Frequency | Time | Description |
|--------|-----------|------|-------------|
| ⭐ Star Growth | Every 3 hours | Starting 3:00 AM PDT | Current GitHub star count |
| 🔄 PR Velocity | Daily | 11:50 PM PST | Merged vs open PR ratios |
| 🏥 Issue Health | Daily | 11:50 PM PST | Closed vs open issue ratios |
| 📦 Package Downloads | Weekly | Sundays 11:50 PM PST | npm download statistics |

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
- **Frontend**: React app served via CloudFront CDN
- **Backend**: Serverless Lambda functions with API Gateway
- **Database**: DynamoDB with separate staging/production tables
- **Scheduling**: EventBridge for automated data collection
- **Security**: AWS Secrets Manager for token management

---

## 🔧 Customization

### Adding New Metrics
1. Create a new Lambda function in `backend/scripts/`
2. Add EventBridge rule for scheduling
3. Update the frontend with new chart component
4. Deploy via GitHub Actions

### Changing Collection Schedules
Edit the CDK configuration in `infrastructure/lib/open-source-tracker-stack.ts`:

```typescript
// Example: Change star growth to every 6 hours
const frequentDataCollectionRule = new events.Rule(this, 'FrequentDataCollectionRule', {
  schedule: events.Schedule.expression('cron(0 */6 * * ? *)'),
});
```

### Environment Variables
```bash
# Update GitHub tokens
aws secretsmanager update-secret --secret-id github-token-prod --secret-string "your_token"

# Update staging credentials
aws secretsmanager update-secret --secret-id staging-credentials --secret-string '{"username":"dev","password":"new_password"}'
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

### 🔧 Development Enhancements
- **Real-time Data Updates**: Live data refresh without page reload
- **Export Functionality**: Download charts as images or data as CSV
- **Advanced Filtering**: Filter data by date ranges and custom criteria
- **Mobile Optimization**: Enhanced responsive design for mobile devices

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **GitHub API**: For comprehensive repository data
- **AWS CDK**: For infrastructure as code
- **React & ApexCharts**: For beautiful UI
- **EventBridge**: For reliable scheduling

---

## 📞 Support

- **GitHub Issues**: [Create an issue](https://github.com/Mihirgupta25/open-source-tracker/issues)
- **Documentation**: Check this README and inline code comments
- **Live Demo**: [Production](https://d14l4o1um83q49.cloudfront.net) | [Staging](https://d1j9ixntt6x51n.cloudfront.net)

---

*Last updated: July 28, 2025 - Enhanced UI with GitHub integration, clean production interface, updated chart descriptions, migrated to ApexCharts, and improved user experience.*
