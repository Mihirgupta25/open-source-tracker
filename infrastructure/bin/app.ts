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
    dataCollectionSchedule: 'cron(0 0,3,6,9,12,15,18,21 * * ? *)', // Same as production: every 3 hours at specific times
    useSharedDatabase: false, // Staging uses its own database tables
    sharedDatabaseEnvironment: undefined, // No shared database for staging
  },
  prod: {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
    stackName: 'OpenSourceTrackerProdV2',
    domainName: undefined, // Add your custom domain here if needed
    githubTokenSecretName: 'github-token-prod',
    devCredentialsSecretName: undefined, // No staging credentials for prod
    dataCollectionSchedule: 'cron(0 */3 * * ? *)', // Every 3 hours starting at 00:00 UTC (4 PM PST)
    useSharedDatabase: true, // Prod uses shared database initially
    sharedDatabaseEnvironment: 'dev', // Use existing dev tables as the shared database
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
  dataCollectionSchedule: config.dataCollectionSchedule,
  useSharedDatabase: config.useSharedDatabase,
  sharedDatabaseEnvironment: config.sharedDatabaseEnvironment,
  env: config.env,
  description: `Open Source Tracker ${environment} environment`,
}); 