#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { OpenSourceTrackerStack } from '../lib/open-source-tracker-stack';

const app = new cdk.App();

// Get environment from context
const environment = app.node.tryGetContext('environment') || 'dev';

// Environment-specific configurations
const envConfigs = {
  dev: {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
    stackName: 'OpenSourceTrackerDev',
    domainName: undefined, // No custom domain for dev
    githubTokenSecretName: 'github-token-dev',
    dataCollectionSchedule: 'cron(0 12 * * ? *)', // Daily at 12 PM UTC
    useSharedDatabase: true, // Dev uses shared database initially
    sharedDatabaseEnvironment: 'dev', // Use dev tables as the shared database
  },
  prod: {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
    stackName: 'OpenSourceTrackerProd',
    domainName: undefined, // Add your custom domain here if needed
    githubTokenSecretName: 'github-token-prod',
    dataCollectionSchedule: 'cron(0 12 * * ? *)', // Daily at 12 PM UTC
    useSharedDatabase: true, // Prod uses shared database initially
    sharedDatabaseEnvironment: 'dev', // Use dev tables as the shared database
  }
};

const config = envConfigs[environment as keyof typeof envConfigs];

if (!config) {
  throw new Error(`Invalid environment: ${environment}. Must be 'dev' or 'prod'`);
}

new OpenSourceTrackerStack(app, config.stackName, {
  environment,
  domainName: config.domainName,
  githubTokenSecretName: config.githubTokenSecretName,
  dataCollectionSchedule: config.dataCollectionSchedule,
  useSharedDatabase: config.useSharedDatabase,
  sharedDatabaseEnvironment: config.sharedDatabaseEnvironment,
  env: config.env,
  description: `Open Source Tracker ${environment} environment`,
}); 