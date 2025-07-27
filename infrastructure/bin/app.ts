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
    stackName: 'OpenSourceTrackerDevV2',
    domainName: undefined, // No custom domain for dev
    githubTokenSecretName: 'github-token-dev',
    devCredentialsSecretName: 'dev-credentials',
    dataCollectionSchedule: 'cron(0 */3 * * ? *)', // Every 3 hours starting at 00:00 UTC (4 PM PST)
    useSharedDatabase: true, // Dev uses shared database initially
    sharedDatabaseEnvironment: 'dev', // Use dev tables as the shared database
  },
  prod: {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
    stackName: 'OpenSourceTrackerProdV2',
    domainName: undefined, // Add your custom domain here if needed
    githubTokenSecretName: 'github-token-prod',
    devCredentialsSecretName: undefined, // No dev credentials for prod
    dataCollectionSchedule: 'cron(0 */3 * * ? *)', // Every 3 hours starting at 00:00 UTC (4 PM PST)
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
  devCredentialsSecretName: config.devCredentialsSecretName,
  dataCollectionSchedule: config.dataCollectionSchedule,
  useSharedDatabase: config.useSharedDatabase,
  sharedDatabaseEnvironment: config.sharedDatabaseEnvironment,
  env: config.env,
  description: `Open Source Tracker ${environment} environment`,
}); 