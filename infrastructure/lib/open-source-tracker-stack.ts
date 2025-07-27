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
  devCredentialsSecretName?: string;
  dataCollectionSchedule: string;
  useSharedDatabase?: boolean;
  sharedDatabaseEnvironment?: string;
}

export class OpenSourceTrackerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: OpenSourceTrackerStackProps) {
    super(scope, id, props);

    const { environment, domainName, githubTokenSecretName, devCredentialsSecretName, dataCollectionSchedule, useSharedDatabase = false, sharedDatabaseEnvironment = 'prod' } = props;

    // DynamoDB Tables
    const tableSuffix = useSharedDatabase ? sharedDatabaseEnvironment : environment;
    
    // Create or reference DynamoDB tables based on shared database configuration
    let starGrowthTable: dynamodb.ITable;
    let prVelocityTable: dynamodb.ITable;
    let issueHealthTable: dynamodb.ITable;
    let packageDownloadsTable: dynamodb.ITable;

    if (useSharedDatabase && environment !== sharedDatabaseEnvironment) {
      // Reference existing tables from the shared environment
      starGrowthTable = dynamodb.Table.fromTableName(this, 'StarGrowthTable', `${tableSuffix}-star-growth`);
      prVelocityTable = dynamodb.Table.fromTableName(this, 'PRVelocityTable', `${tableSuffix}-pr-velocity`);
      issueHealthTable = dynamodb.Table.fromTableName(this, 'IssueHealthTable', `${tableSuffix}-issue-health`);
      packageDownloadsTable = dynamodb.Table.fromTableName(this, 'PackageDownloadsTable', `${tableSuffix}-package-downloads`);
    } else {
      // Create new tables for this environment
      starGrowthTable = new dynamodb.Table(this, 'StarGrowthTable', {
        tableName: `${tableSuffix}-star-growth`,
        partitionKey: { name: 'repo', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      });

      prVelocityTable = new dynamodb.Table(this, 'PRVelocityTable', {
        tableName: `${tableSuffix}-pr-velocity`,
        partitionKey: { name: 'repo', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      });

      issueHealthTable = new dynamodb.Table(this, 'IssueHealthTable', {
        tableName: `${tableSuffix}-issue-health`,
        partitionKey: { name: 'repo', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      });

      packageDownloadsTable = new dynamodb.Table(this, 'PackageDownloadsTable', {
        tableName: `${tableSuffix}-package-downloads`,
        partitionKey: { name: 'repo', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'week_start', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      });
    }

    // GitHub Token Secret
    let githubTokenSecret: secretsmanager.ISecret;
    if (useSharedDatabase && environment !== sharedDatabaseEnvironment) {
      // Reference existing secret from the shared environment
      githubTokenSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubTokenSecret', githubTokenSecretName);
    } else {
      // Create new secret for this environment
      githubTokenSecret = new secretsmanager.Secret(this, 'GitHubTokenSecret', {
        secretName: githubTokenSecretName,
        description: `GitHub API token for ${environment} environment`,
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ token: '' }),
          generateStringKey: 'token',
          excludeCharacters: '"@/\\',
        },
      });
    }

    // Dev Credentials Secret (only for dev environment)
    let devCredentialsSecret: secretsmanager.ISecret | undefined;
    if (environment === 'dev' && devCredentialsSecretName) {
      if (useSharedDatabase && environment !== sharedDatabaseEnvironment) {
        // Reference existing secret from the shared environment
        devCredentialsSecret = secretsmanager.Secret.fromSecretNameV2(this, 'DevCredentialsSecret', devCredentialsSecretName);
      } else {
        // Create new secret for this environment
        devCredentialsSecret = new secretsmanager.Secret(this, 'DevCredentialsSecret', {
          secretName: devCredentialsSecretName,
          description: `Dev environment credentials for ${environment} environment`,
          generateSecretString: {
            secretStringTemplate: JSON.stringify({ username: 'dev', password: '' }),
            generateStringKey: 'password',
            excludeCharacters: '"@/\\',
          },
        });
      }
    }

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
    // Star growth: every 3 hours starting at 3 AM PST (11 AM UTC)
    const frequentDataCollectionRule = new events.Rule(this, 'FrequentDataCollectionRule', {
      schedule: events.Schedule.expression('cron(0 11/3 * * ? *)'), // 11 AM UTC = 3 AM PST, then every 3 hours
      description: `Frequent data collection (every 3 hours starting 3 AM PST) for ${environment} environment`,
    });

    // PR velocity and issue health: once daily at 11:50 PM PST (7:50 AM UTC next day)
    const dailyDataCollectionRule = new events.Rule(this, 'DailyDataCollectionRule', {
      schedule: events.Schedule.expression('cron(50 7 * * ? *)'), // 7:50 AM UTC = 11:50 PM PST
      description: `Daily data collection (11:50 PM PST) for ${environment} environment`,
    });

    // Package downloads: once every 7 days starting on the 29th at 11:50 PM PST (7:50 AM UTC next day)
    const weeklyDataCollectionRule = new events.Rule(this, 'WeeklyDataCollectionRule', {
      schedule: events.Schedule.expression('cron(50 7 ? * SUN *)'), // 7:50 AM UTC = 11:50 PM PST on Sundays
      description: `Weekly data collection (every Sunday at 11:50 PM PST) for ${environment} environment`,
    });

    // Add targets to the frequent rule (every 3 hours)
    frequentDataCollectionRule.addTarget(new targets.LambdaFunction(starGrowthCollector));

    // Add targets to the daily rule (once per day)
    dailyDataCollectionRule.addTarget(new targets.LambdaFunction(prVelocityCollector));
    dailyDataCollectionRule.addTarget(new targets.LambdaFunction(issueHealthCollector));

    // Add targets to the weekly rule (once per week)
    weeklyDataCollectionRule.addTarget(new targets.LambdaFunction(packageDownloadsCollector));

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

    // Grant public read access to the bucket
    frontendBucket.addToResourcePolicy(new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      resources: [frontendBucket.arnForObjects('*')],
      principals: [new iam.AnyPrincipal()],
    }));

    // Use S3Origin with proper configuration
    const s3Origin = new origins.S3Origin(frontendBucket);

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
        origin: s3Origin,
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