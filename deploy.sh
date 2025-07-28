#!/bin/bash

# Open Source Tracker AWS Deployment Script
# This script deploys the application to AWS using CDK

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if AWS CLI is configured
check_aws_config() {
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    print_success "AWS CLI is configured"
}

# Function to check if CDK is installed
check_cdk() {
    if ! command -v cdk &> /dev/null; then
        print_error "AWS CDK is not installed. Please install it first: npm install -g aws-cdk"
        exit 1
    fi
    print_success "AWS CDK is installed"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install root dependencies
    npm install
    
    # Install infrastructure dependencies
    cd infrastructure
    npm install
    cd ..
    
    # Install backend dependencies
    cd backend
    npm install
    cd ..
    
    # Install frontend dependencies
    cd frontend
    npm install
    cd ..
    
    print_success "Dependencies installed"
}

# Function to build the application
build_app() {
    print_status "Building the application..."
    
    # Build frontend
    cd frontend
    npm run build
    cd ..
    
    print_success "Application built"
}

# Function to bootstrap CDK (if needed)
bootstrap_cdk() {
    print_status "Checking if CDK is bootstrapped..."
    
    if ! aws cloudformation describe-stacks --stack-name CDKToolkit &> /dev/null; then
        print_warning "CDK is not bootstrapped. Bootstrapping now..."
        cd infrastructure
        cdk bootstrap
        cd ..
        print_success "CDK bootstrapped"
    else
        print_success "CDK is already bootstrapped"
    fi
}

# Function to deploy environment
deploy_environment() {
    local environment=$1
    
    print_status "Deploying $environment environment..."
    
    cd infrastructure
    
    # Build TypeScript
    npm run build
    
    # Deploy
    cdk deploy --context environment=$environment --require-approval never
    
    cd ..
    
    print_success "$environment environment deployed successfully"
}

# Function to upload frontend to S3
upload_frontend() {
    local environment=$1
    
    print_status "Uploading frontend to S3 for $environment environment..."
    
    # Get bucket name from CDK outputs
    cd infrastructure
    local bucket_name=$(aws cloudformation describe-stacks \
        --stack-name "OpenSourceTracker${environment^}" \
        --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucketName`].OutputValue' \
        --output text)
    cd ..
    
    if [ -z "$bucket_name" ]; then
        print_error "Could not get bucket name from CloudFormation outputs"
        exit 1
    fi
    
    # Sync frontend build to S3
    aws s3 sync frontend/build/ s3://$bucket_name/ --delete
    
    print_success "Frontend uploaded to S3 bucket: $bucket_name"
}

# Function to set GitHub token
set_github_token() {
    local environment=$1
    local token=$2
    
    if [ -z "$token" ]; then
        print_warning "No GitHub token provided. You can set it later in AWS Secrets Manager."
        return
    fi
    
    print_status "Setting GitHub token for $environment environment..."
    
    local secret_name="github-token-$environment"
    
    # Create or update the secret
    aws secretsmanager put-secret-value \
        --secret-id $secret_name \
        --secret-string "{\"token\":\"$token\"}" \
        --region us-east-1 || \
    aws secretsmanager create-secret \
        --name $secret_name \
        --description "GitHub API token for $environment environment" \
        --secret-string "{\"token\":\"$token\"}" \
        --region us-east-1
    
    print_success "GitHub token set for $environment environment"
}

# Function to display deployment info
show_deployment_info() {
    local environment=$1
    
    print_status "Getting deployment information for $environment environment..."
    
    cd infrastructure
    
    # Get outputs
    local api_endpoint=$(aws cloudformation describe-stacks \
        --stack-name "OpenSourceTracker${environment^}" \
        --query 'Stacks[0].Outputs[?OutputKey==`APIEndpoint`].OutputValue' \
        --output text)
    
    local frontend_url=$(aws cloudformation describe-stacks \
        --stack-name "OpenSourceTracker${environment^}" \
        --query 'Stacks[0].Outputs[?OutputKey==`FrontendURL`].OutputValue' \
        --output text)
    
    cd ..
    
    echo ""
    print_success "Deployment completed successfully!"
    echo ""
    echo "Environment: $environment"
    echo "API Endpoint: $api_endpoint"
    echo "Frontend URL: https://$frontend_url"
    echo ""
    echo "Next steps:"
    echo "1. Set your GitHub token in AWS Secrets Manager: github-token-$environment"
    echo "2. Test the application by visiting the frontend URL"
    echo "3. Check CloudWatch logs for data collection functions"
    echo ""
}

# Main script
main() {
    local environment=${1:-staging}
    local github_token=$2
    
    if [ "$environment" != "staging" ] && [ "$environment" != "prod" ]; then
        print_error "Environment must be 'staging' or 'prod'"
        echo "Usage: $0 [staging|prod] [github_token]"
        exit 1
    fi
    
    echo "=========================================="
    echo "Open Source Tracker AWS Deployment"
    echo "Environment: $environment"
    echo "=========================================="
    echo ""
    
    # Pre-deployment checks
    check_aws_config
    check_cdk
    install_dependencies
    build_app
    bootstrap_cdk
    
    # Deploy infrastructure
    deploy_environment $environment
    
    # Upload frontend
    upload_frontend $environment
    
    # Set GitHub token if provided
    if [ ! -z "$github_token" ]; then
        set_github_token $environment $github_token
    fi
    
    # Show deployment info
    show_deployment_info $environment
}

# Run main function with all arguments
main "$@" 