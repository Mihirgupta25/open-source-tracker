# Open Source Growth Tracker - Frontend

A modern React application for tracking GitHub repository metrics with real-time data visualization and multi-environment support.

---

## 🚀 Live Application

**Production Environment:**
- **URL**: https://d14l4o1um83q49.cloudfront.net
- **Features**: Public access, all features available

**Development Environment:**
- **URL**: https://dci8qqj8zzoob.cloudfront.net
- **Login**: Username: `dev`, Password: `dev123`
- **Features**: Password-protected, same functionality as production

---

## ✨ Features

### 📊 Analytics Dashboard
- **Star Growth Chart**: Historical GitHub star tracking with proper timestamp formatting
- **Pull Request Velocity**: Merged vs open PR ratio visualization
- **Issue Health**: Closed vs open issue ratio tracking
- **Package Downloads**: Weekly npm download statistics

### 🎨 User Interface
- **Environment Indicators**: Automatic detection and display of dev/production environment
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Interactive Charts**: Hover tooltips, zoom capabilities, and smooth animations
- **Tabbed Navigation**: Easy switching between different metrics views

### 🔧 Technical Features
- **Real-time Data Fetching**: Automatic API calls to DynamoDB via AWS API Gateway
- **Timestamp Handling**: Support for multiple timestamp formats with automatic conversion
- **Error Handling**: Graceful error display and fallback states
- **Performance Optimized**: Efficient data processing and chart rendering

---

## 🛠️ Technology Stack

- **React 18**: Modern React with hooks and functional components
- **Recharts**: Beautiful, composable charting library
- **CSS3**: Custom styling with responsive design
- **AWS Integration**: Direct API calls to AWS services
- **Environment Detection**: Automatic environment identification

---

## 📁 Project Structure

```
frontend/
├── public/                 # Static assets
│   ├── index.html         # Main HTML template
│   ├── favicon.ico        # Application icon
│   └── manifest.json      # PWA manifest
├── src/                   # Source code
│   ├── App.js            # Main application component
│   ├── App.css           # Application styles
│   ├── index.js          # React entry point
│   └── index.css         # Global styles
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+ recommended)
- npm or yarn
- AWS credentials configured (for deployment)

### Local Development

1. **Install dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Start development server:**
   ```bash
   npm start
   ```

3. **Open your browser:**
   - Navigate to `http://localhost:3000`
   - The app will automatically reload when you make changes

### Building for Production

1. **Create production build:**
   ```bash
   npm run build
   ```

2. **Deploy to AWS S3:**
   ```bash
   # Deploy to dev environment
   aws s3 sync build/ s3://dev-open-source-tracker-frontend-071493677444 --delete
   
   # Deploy to production environment
   aws s3 sync build/ s3://prod-open-source-tracker-frontend-071493677444 --delete
   ```

3. **Invalidate CloudFront cache:**
   ```bash
   # Dev environment
   aws cloudfront create-invalidation --distribution-id E1YYTJZXHOIMIQ --paths "/*"
   
   # Production environment
   aws cloudfront create-invalidation --distribution-id EHL2D1R0B7OQI --paths "/*"
   ```

---

## 📊 Components

### App.js - Main Application Component

**Key Features:**
- **Environment Detection**: Automatically detects and displays current environment
- **Data Fetching**: Manages API calls to AWS backend services
- **Chart Rendering**: Handles data visualization with Recharts
- **Error Handling**: Provides user-friendly error messages

**Environment Indicators:**
```javascript
// Dev Environment
{window.location.hostname.includes('dci8qqj8zzoob') && (
  <div style={{...}}>
    🚧 DEV ENVIRONMENT 🚧
  </div>
)}

// Production Environment
{window.location.hostname.includes('d14l4o1um83q49') && (
  <div style={{...}}>
    🚀 PRODUCTION ENVIRONMENT 🚀
  </div>
)}
```

### Chart Components

**Star Growth Chart:**
- **Data Source**: `/api/star-history` endpoint
- **Features**: Line chart with timestamp formatting
- **Updates**: Real-time data from DynamoDB

**Pull Request Velocity Chart:**
- **Data Source**: `/api/pr-velocity` endpoint
- **Features**: Ratio calculation and visualization
- **Updates**: Daily data collection

**Issue Health Chart:**
- **Data Source**: `/api/issue-health` endpoint
- **Features**: Issue ratio tracking
- **Updates**: Daily data collection

**Package Downloads Chart:**
- **Data Source**: `/api/package-downloads` endpoint
- **Features**: Weekly download statistics
- **Updates**: Weekly data collection

---

## 🔧 Configuration

### API Endpoints

The application automatically detects the correct API endpoint based on the environment:

```javascript
// API base URL - will use environment variable in production
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://v7ka0hnhgg.execute-api.us-east-1.amazonaws.com/prod';
```

**Available Endpoints:**
- `/api/star-history` - Historical star growth data
- `/api/pr-velocity` - Pull request velocity metrics
- `/api/issue-health` - Issue health statistics
- `/api/package-downloads` - Package download data
- `/api/stars?repo=owner/repo` - Real-time star count for any repository

### Environment Variables

**Development:**
```bash
REACT_APP_API_URL=https://v7ka0hnhgg.execute-api.us-east-1.amazonaws.com/prod
```

**Production:**
```bash
REACT_APP_API_URL=https://fwaonagbbh.execute-api.us-east-1.amazonaws.com/prod
```

---

## 🎨 Styling

### CSS Architecture

**App.css**: Main application styles
- **Card Layout**: Clean, modern card-based design
- **Responsive Grid**: Flexible layout for different screen sizes
- **Color Scheme**: Consistent color palette throughout
- **Typography**: Clear, readable font hierarchy

**Key Style Features:**
- **Environment Badges**: Distinct styling for dev vs production
- **Chart Containers**: Optimized spacing and padding
- **Interactive Elements**: Hover effects and transitions
- **Mobile Responsive**: Touch-friendly interface

### Color Palette

**Dev Environment:**
- Background: `#fbbf24` (Yellow)
- Text: `#92400e` (Dark Orange)
- Border: `#f59e0b` (Orange)

**Production Environment:**
- Background: `#10b981` (Green)
- Text: `#064e3b` (Dark Green)
- Border: `#059669` (Green)

---

## 🔍 Troubleshooting

### Common Issues

**"Invalid Date" in Charts:**
- ✅ **Fixed**: Updated timestamp parsing to handle multiple formats
- **Solution**: Automatic format detection and conversion

**Environment Indicator Not Showing:**
- **Check**: Browser console for JavaScript errors
- **Verify**: Correct hostname detection logic
- **Solution**: Clear browser cache and refresh

**Charts Not Loading:**
- **Check**: Network tab for API call failures
- **Verify**: AWS API Gateway endpoint accessibility
- **Solution**: Check AWS credentials and API permissions

**Build Failures:**
- **Check**: Node.js version compatibility
- **Verify**: All dependencies installed
- **Solution**: Delete `node_modules` and run `npm install`

### Performance Optimization

**Bundle Size:**
- **Current**: ~150KB gzipped
- **Optimization**: Code splitting and lazy loading available
- **Monitoring**: Regular bundle analysis recommended

**Chart Performance:**
- **Data Points**: Optimized for up to 1000 data points
- **Rendering**: Efficient chart updates with React state
- **Memory**: Proper cleanup of chart instances

---

## 🚀 Deployment

### Automated Deployment (GitHub Actions)

**Dev Environment:**
- **Trigger**: Push to `develop` branch
- **Process**: Build → Test → Deploy to dev S3 bucket
- **Result**: Available at https://dci8qqj8zzoob.cloudfront.net

**Production Environment:**
- **Trigger**: Push to `main` branch
- **Process**: Build → Test → Deploy to prod S3 bucket
- **Result**: Available at https://d14l4o1um83q49.cloudfront.net

### Manual Deployment

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Deploy to S3:**
   ```bash
   aws s3 sync build/ s3://[bucket-name] --delete
   ```

3. **Invalidate CloudFront:**
   ```bash
   aws cloudfront create-invalidation --distribution-id [distribution-id] --paths "/*"
   ```

---

## 🤝 Contributing

### Development Workflow

1. **Create feature branch:**
   ```bash
   git checkout -b feature/new-feature
   ```

2. **Make changes and test:**
   ```bash
   npm start
   # Test in browser at localhost:3000
   ```

3. **Build and verify:**
   ```bash
   npm run build
   # Check for build errors
   ```

4. **Commit and push:**
   ```bash
   git add .
   git commit -m "Add new feature"
   git push origin feature/new-feature
   ```

### Code Standards

- **React Hooks**: Use functional components with hooks
- **Error Handling**: Implement proper error boundaries
- **Performance**: Optimize re-renders and bundle size
- **Accessibility**: Follow WCAG guidelines
- **Testing**: Add tests for new components

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Recharts**: For the excellent charting library
- **React Team**: For the amazing framework
- **AWS**: For the robust cloud infrastructure
- **GitHub**: For the comprehensive API

---

*Last updated: July 27, 2025 - AWS deployment with multi-environment support and enhanced UI features.* 