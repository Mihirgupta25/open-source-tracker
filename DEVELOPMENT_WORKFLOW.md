# Development Workflow

This document outlines the development workflow for the Open Source Tracker project, ensuring changes are properly tested in the dev environment before being promoted to production.

## 🎯 **Workflow Overview**

```
Feature Branch → Develop Branch → Dev Environment → Testing → Main Branch → Production Environment
```

## 📋 **Development Process**

### **1. Starting New Development**

Always work from the `develop` branch:

```bash
# Ensure you're on develop branch
git checkout develop
git pull origin develop

# Create a feature branch for your changes
git checkout -b feature/your-feature-name
```

### **2. Making Changes**

Make your changes and commit them:

```bash
# Make your changes to the code
# ...

# Add and commit your changes
git add .
git commit -m "feat: your feature description"

# Push your feature branch
git push origin feature/your-feature-name
```

### **3. Testing in Dev Environment**

#### **Option A: Automatic Deployment (Recommended)**
1. Create a Pull Request from your feature branch to `develop`
2. The CI/CD pipeline will automatically deploy to the dev environment
3. Test your changes at: **https://dcujo2wk56am6.cloudfront.net**

#### **Option B: Manual Deployment**
1. Merge your feature branch into `develop`
2. Push to `develop` branch
3. The CI/CD pipeline will automatically deploy to dev

### **4. Promoting to Production**

Once you've tested your changes in the dev environment:

#### **Option A: Pull Request (Recommended)**
1. Create a Pull Request from `develop` to `main`
2. Review the changes
3. Merge the PR to deploy to production

#### **Option B: Manual Promotion**
```bash
# Switch to main branch
git checkout main
git pull origin main

# Merge develop into main
git merge develop

# Push to main (triggers production deployment)
git push origin main
```

#### **Option C: Manual Workflow Trigger**
1. Go to GitHub Actions tab
2. Select "Deploy to AWS" workflow
3. Click "Run workflow"
4. Choose "prod" environment
5. Click "Run workflow"

## 🌐 **Environment URLs**

| Environment | Frontend URL | API URL | Purpose | Authentication | Database |
|-------------|--------------|---------|---------|----------------|----------|
| **Dev** | https://dcujo2wk56am6.cloudfront.net | https://l97n7ozrb0.execute-api.us-east-1.amazonaws.com/prod | Testing new features | 🔒 Password Protected | 🗄️ Shared (dev tables) |
| **Prod** | TBD (after first prod deployment) | TBD | Live application | 🌐 Public Access | 🗄️ Shared (dev tables) |

## 🗄️ **Database Strategy**

### **Shared Database Setup (Current)**
Both dev and prod environments currently use the same database tables (dev tables) to ensure data consistency.

### **Database Management Commands:**
```bash
# Check database status
npm run db:status

# Sync data from dev to prod
npm run db:sync

# Copy data between environments
npm run db:copy dev prod

# Separate databases (when you want dev-specific changes)
npm run db:separate
```

### **When to Separate Databases:**
- ✅ **Keep Shared**: When both environments should have identical data
- 🔀 **Separate**: When you want to test changes in dev without affecting prod
- 🔄 **Sync**: When you want to copy prod data to dev for testing

## 🔧 **Branch Strategy**

- **`main`**: Production-ready code, deploys to production environment
- **`develop`**: Integration branch, deploys to dev environment
- **`feature/*`**: Feature branches for individual changes

## 📝 **Commit Message Convention**

Use conventional commit messages:

```
feat: add new feature
fix: fix a bug
docs: update documentation
style: formatting changes
refactor: code refactoring
test: add or update tests
chore: maintenance tasks
```

## 🚀 **Deployment Triggers**

### **Automatic Deployments**
- **Push to `develop`** → Deploys to dev environment
- **Push to `main`** → Deploys to production environment
- **Pull Request to `develop`** → Deploys to dev environment for testing

### **Manual Deployments**
- **GitHub Actions** → Manual workflow trigger with environment selection

## 🧪 **Testing Checklist**

Before promoting to production, ensure:

- [ ] Code changes work in dev environment
- [ ] All API endpoints return expected data
- [ ] Frontend displays data correctly
- [ ] No console errors in browser
- [ ] All features function as expected
- [ ] Performance is acceptable

## 🔍 **Troubleshooting**

### **Dev Environment Issues**
1. Check GitHub Actions for deployment status
2. Verify AWS credentials are configured
3. Check CloudFormation stack status
4. Review Lambda function logs

### **Production Deployment Issues**
1. Ensure dev environment is working
2. Check for any breaking changes
3. Verify all tests pass
4. Review deployment logs

## 🔐 **Dev Environment Authentication**

The dev environment is password protected to prevent unauthorized access. Credentials are stored securely in AWS Secrets Manager.

### **Default Credentials:**
- **Username:** `dev`
- **Password:** `tracker2024`

### **Managing Authentication:**
```bash
# Show current credentials
npm run dev:auth:show

# Update to default credentials
npm run dev:auth:update

# Update to custom credentials
npm run dev:auth:custom <username> <password>
```

### **Security Features:**
- ✅ **AWS Secrets Manager**: Credentials stored securely in AWS
- ✅ **No Hardcoded Values**: No credentials in source code
- ✅ **Immediate Updates**: Changes take effect without redeployment
- ✅ **Access Control**: Only authorized users can update credentials

## 📚 **Useful Commands**

```bash
# Check current branch
git branch

# Switch to develop branch
git checkout develop

# Pull latest changes
git pull origin develop

# Create feature branch
git checkout -b feature/new-feature

# Push feature branch
git push origin feature/new-feature

# Merge feature branch into develop
git checkout develop
git merge feature/new-feature
git push origin develop

# Promote to production
git checkout main
git merge develop
git push origin main
```

## 🎯 **Best Practices**

1. **Always test in dev first** - Never deploy directly to production
2. **Use feature branches** - Keep changes isolated and reviewable
3. **Write clear commit messages** - Make history readable
4. **Test thoroughly** - Ensure everything works before promotion
5. **Monitor deployments** - Check GitHub Actions for success/failure
6. **Document changes** - Update README and documentation as needed

## 🚨 **Emergency Procedures**

### **Rollback Production**
1. Revert the last commit on `main`
2. Push the revert to trigger a new production deployment
3. Investigate the issue in dev environment

### **Hotfix Process**
1. Create hotfix branch from `main`
2. Make minimal changes to fix the issue
3. Test in dev environment
4. Merge to `main` for immediate production deployment
5. Backport to `develop` branch

---

**Remember: Dev environment is for testing, Production is for users!** 🎉 