#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { OpenSourceTrackerStack } from '../lib/open-source-tracker-stack';

const app = new cdk.App();

// Get environment from context
const environment = app.node.tryGetContext('environment') || 'staging';

// Environment-specific configurations
const envConfigs = {
  staging: {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
    stackName: 'OpenSourceTrackerStagingV2',
    domainName: undefined, // No custom domain for staging
    githubTokenSecretName: 'github-token-dev',
    devCredentialsSecretName: 'staging-credentials',
    useSharedDatabase: false, // Staging uses its own database tables
    sharedDatabaseEnvironment: undefined, // No shared database for staging
  },
  prod: {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
    stackName: 'OpenSourceTrackerProdV2',
    domainName: undefined, // Add your custom domain here if needed
    githubTokenSecretName: 'github-token-prod',
    devCredentialsSecretName: undefined, // No staging credentials for prod
    useSharedDatabase: false, // Prod uses its own database tables
    sharedDatabaseEnvironment: undefined, // No shared database for prod
  }
};

const config = envConfigs[environment as keyof typeof envConfigs];

if (!config) {
  throw new Error(`Invalid environment: ${environment}. Must be 'staging' or 'prod'`);
}

new OpenSourceTrackerStack(app, config.stackName, {
  environment,
  domainName: config.domainName,
  githubTokenSecretName: config.githubTokenSecretName,
  devCredentialsSecretName: config.devCredentialsSecretName,
  useSharedDatabase: config.useSharedDatabase,
  sharedDatabaseEnvironment: config.sharedDatabaseEnvironment,
  env: config.env,
  description: `Open Source Tracker ${environment} environment`,
}); 