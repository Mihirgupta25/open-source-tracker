import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { Construct } from 'constructs';

export interface OpenSourceTrackerStackProps extends cdk.StackProps {
  environment: string;
  domainName?: string;
  githubTokenSecretName: string;
  dataCollectionSchedule: string;
  useSharedDatabase?: boolean;
  sharedDatabaseEnvironment?: string;
}

export class OpenSourceTrackerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: OpenSourceTrackerStackProps) {
    super(scope, id, props);

    const { environment, domainName, githubTokenSecretName, dataCollectionSchedule, useSharedDatabase = false, sharedDatabaseEnvironment = 'prod' } = props;

    // DynamoDB Tables
    const tableSuffix = useSharedDatabase ? sharedDatabaseEnvironment : environment;
    
    const starGrowthTable = new dynamodb.Table(this, 'StarGrowthTable', {
      tableName: `${tableSuffix}-star-growth`,
      partitionKey: { name: 'repo', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const prVelocityTable = new dynamodb.Table(this, 'PRVelocityTable', {
      tableName: `${tableSuffix}-pr-velocity`,
      partitionKey: { name: 'repo', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const issueHealthTable = new dynamodb.Table(this, 'IssueHealthTable', {
      tableName: `${tableSuffix}-issue-health`,
      partitionKey: { name: 'repo', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const packageDownloadsTable = new dynamodb.Table(this, 'PackageDownloadsTable', {
      tableName: `${tableSuffix}-package-downloads`,
      partitionKey: { name: 'repo', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'week_start', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // GitHub Token Secret
    const githubTokenSecret = new secretsmanager.Secret(this, 'GitHubTokenSecret', {
      secretName: githubTokenSecretName,
      description: `GitHub API token for ${environment} environment`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ token: '' }),
        generateStringKey: 'token',
        excludeCharacters: '"@/\\',
      },
    });

    // Lambda Layer for shared dependencies
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset('lambda-layer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Shared dependencies for Open Source Tracker Lambda functions',
      layerVersionName: `${environment}-shared-layer`,
    });

    // API Lambda Function
    const apiFunction = new lambda.Function(this, 'APIFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'lambda-index.handler',
      code: lambda.Code.fromAsset('../backend'),
      environment: {
        ENVIRONMENT: environment,
        STAR_GROWTH_TABLE: starGrowthTable.tableName,
        PR_VELOCITY_TABLE: prVelocityTable.tableName,
        ISSUE_HEALTH_TABLE: issueHealthTable.tableName,
        PACKAGE_DOWNLOADS_TABLE: packageDownloadsTable.tableName,
        GITHUB_TOKEN_SECRET_NAME: githubTokenSecretName,
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      layers: [sharedLayer],
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permissions to Lambda
    starGrowthTable.grantReadWriteData(apiFunction);
    prVelocityTable.grantReadWriteData(apiFunction);
    issueHealthTable.grantReadWriteData(apiFunction);
    packageDownloadsTable.grantReadWriteData(apiFunction);
    githubTokenSecret.grantRead(apiFunction);

    // Data Collection Lambda Functions
    const starGrowthCollector = new lambda.Function(this, 'StarGrowthCollector', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'star-collector.handler',
      code: lambda.Code.fromAsset('../backend/scripts'),
      environment: {
        ENVIRONMENT: environment,
        STAR_GROWTH_TABLE: starGrowthTable.tableName,
        GITHUB_TOKEN_SECRET_NAME: githubTokenSecretName,
        REPO: 'promptfoo/promptfoo',
      },
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      layers: [sharedLayer],
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const prVelocityCollector = new lambda.Function(this, 'PRVelocityCollector', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'pr-collector.handler',
      code: lambda.Code.fromAsset('../backend/scripts'),
      environment: {
        ENVIRONMENT: environment,
        PR_VELOCITY_TABLE: prVelocityTable.tableName,
        GITHUB_TOKEN_SECRET_NAME: githubTokenSecretName,
        REPO: 'promptfoo/promptfoo',
      },
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      layers: [sharedLayer],
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const issueHealthCollector = new lambda.Function(this, 'IssueHealthCollector', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'issue-collector.handler',
      code: lambda.Code.fromAsset('../backend/scripts'),
      environment: {
        ENVIRONMENT: environment,
        ISSUE_HEALTH_TABLE: issueHealthTable.tableName,
        GITHUB_TOKEN_SECRET_NAME: githubTokenSecretName,
        REPO: 'promptfoo/promptfoo',
      },
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      layers: [sharedLayer],
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const packageDownloadsCollector = new lambda.Function(this, 'PackageDownloadsCollector', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'package-collector.handler',
      code: lambda.Code.fromAsset('../backend/scripts'),
      environment: {
        ENVIRONMENT: environment,
        PACKAGE_DOWNLOADS_TABLE: packageDownloadsTable.tableName,
        GITHUB_TOKEN_SECRET_NAME: githubTokenSecretName,
        REPO: 'promptfoo/promptfoo',
      },
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      layers: [sharedLayer],
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Grant permissions to collectors
    starGrowthTable.grantWriteData(starGrowthCollector);
    prVelocityTable.grantWriteData(prVelocityCollector);
    issueHealthTable.grantWriteData(issueHealthCollector);
    packageDownloadsTable.grantWriteData(packageDownloadsCollector);
    githubTokenSecret.grantRead(starGrowthCollector);
    githubTokenSecret.grantRead(prVelocityCollector);
    githubTokenSecret.grantRead(issueHealthCollector);
    githubTokenSecret.grantRead(packageDownloadsCollector);

    // EventBridge Rules for scheduled data collection
    const dataCollectionRule = new events.Rule(this, 'DataCollectionRule', {
      schedule: events.Schedule.expression(dataCollectionSchedule),
      description: `Daily data collection for ${environment} environment`,
    });

    // Add targets to the rule
    dataCollectionRule.addTarget(new targets.LambdaFunction(starGrowthCollector));
    dataCollectionRule.addTarget(new targets.LambdaFunction(prVelocityCollector));
    dataCollectionRule.addTarget(new targets.LambdaFunction(issueHealthCollector));
    dataCollectionRule.addTarget(new targets.LambdaFunction(packageDownloadsCollector));

    // API Gateway
    const api = new apigateway.RestApi(this, 'OpenSourceTrackerAPI', {
      restApiName: `${environment}-open-source-tracker-api`,
      description: `API for Open Source Tracker ${environment} environment`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // API Gateway Integration
    const apiIntegration = new apigateway.LambdaIntegration(apiFunction);

    // API Routes
    api.root.addProxy({
      defaultIntegration: apiIntegration,
      anyMethod: true,
    });

    // S3 Bucket for Frontend
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `${environment}-open-source-tracker-frontend-${this.account}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: environment !== 'prod',
    });

    // Lambda@Edge function for dev environment authentication
    let authFunction: lambda.Function | undefined;
    if (environment === 'dev') {
      authFunction = new lambda.Function(this, 'AuthFunction', {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: 'auth-function.handler',
        code: lambda.Code.fromAsset(path.join(__dirname, '../lambda-edge')),
        timeout: cdk.Duration.seconds(5),
        memorySize: 128,
      });
    }

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        ...(environment === 'dev' && authFunction ? {
          edgeLambdas: [{
            functionVersion: authFunction.currentVersion,
            eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
          }],
        } : {}),
      },
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'APIEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
      exportName: `${environment}-api-endpoint`,
    });

    new cdk.CfnOutput(this, 'FrontendURL', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution URL',
      exportName: `${environment}-frontend-url`,
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'S3 bucket name for frontend',
      exportName: `${environment}-frontend-bucket`,
    });

    new cdk.CfnOutput(this, 'GitHubTokenSecretName', {
      value: githubTokenSecret.secretName,
      description: 'GitHub token secret name',
      exportName: `${environment}-github-token-secret`,
    });
  }
} 