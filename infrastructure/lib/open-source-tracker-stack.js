"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenSourceTrackerStack = void 0;
const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const s3 = require("aws-cdk-lib/aws-s3");
const cloudfront = require("aws-cdk-lib/aws-cloudfront");
const origins = require("aws-cdk-lib/aws-cloudfront-origins");
const apigateway = require("aws-cdk-lib/aws-apigateway");
const events = require("aws-cdk-lib/aws-events");
const targets = require("aws-cdk-lib/aws-events-targets");
const iam = require("aws-cdk-lib/aws-iam");
const secretsmanager = require("aws-cdk-lib/aws-secretsmanager");
const logs = require("aws-cdk-lib/aws-logs");
const path = require("path");
class OpenSourceTrackerStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { environment, domainName, githubTokenSecretName, devCredentialsSecretName, dataCollectionSchedule, useSharedDatabase = false, sharedDatabaseEnvironment = 'prod' } = props;
        // DynamoDB Tables
        const tableSuffix = useSharedDatabase ? sharedDatabaseEnvironment : environment;
        // Create or reference DynamoDB tables based on shared database configuration
        let starGrowthTable;
        let prVelocityTable;
        let issueHealthTable;
        let packageDownloadsTable;
        if (useSharedDatabase && environment !== sharedDatabaseEnvironment) {
            // Reference existing tables from the shared environment
            starGrowthTable = dynamodb.Table.fromTableName(this, 'StarGrowthTable', `${tableSuffix}-star-growth`);
            prVelocityTable = dynamodb.Table.fromTableName(this, 'PRVelocityTable', `${tableSuffix}-pr-velocity`);
            issueHealthTable = dynamodb.Table.fromTableName(this, 'IssueHealthTable', `${tableSuffix}-issue-health`);
            packageDownloadsTable = dynamodb.Table.fromTableName(this, 'PackageDownloadsTable', `${tableSuffix}-package-downloads`);
        }
        else {
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
        let githubTokenSecret;
        if (useSharedDatabase && environment !== sharedDatabaseEnvironment) {
            // Reference existing secret from the shared environment
            githubTokenSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubTokenSecret', githubTokenSecretName);
        }
        else {
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
        // Staging Credentials Secret (only for staging environment)
        let devCredentialsSecret;
        if (environment === 'staging' && devCredentialsSecretName) {
            if (useSharedDatabase && environment !== sharedDatabaseEnvironment) {
                // Reference existing secret from the shared environment
                devCredentialsSecret = secretsmanager.Secret.fromSecretNameV2(this, 'StagingCredentialsSecret', devCredentialsSecretName);
            }
            else {
                // Create new secret for this environment
                devCredentialsSecret = new secretsmanager.Secret(this, 'StagingCredentialsSecret', {
                    secretName: devCredentialsSecretName,
                    description: `Staging environment credentials for ${environment} environment`,
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
        // Star growth: every 3 hours starting at 3:00 AM PDT (10:00 AM UTC)
        const frequentDataCollectionRule = new events.Rule(this, 'FrequentDataCollectionRule', {
            schedule: events.Schedule.expression('cron(0 10/3 * * ? *)'), // 10 AM UTC = 3 AM PDT, then every 3 hours
            description: `Frequent data collection (every 3 hours starting 3:00 AM PDT) for ${environment} environment`,
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
        // Lambda@Edge function for staging environment authentication
        let authFunction;
        if (environment === 'staging') {
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
                ...(environment === 'staging' && authFunction ? {
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
exports.OpenSourceTrackerStack = OpenSourceTrackerStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3Blbi1zb3VyY2UtdHJhY2tlci1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9wZW4tc291cmNlLXRyYWNrZXItc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLGlEQUFpRDtBQUNqRCxxREFBcUQ7QUFDckQseUNBQXlDO0FBQ3pDLHlEQUF5RDtBQUN6RCw4REFBOEQ7QUFDOUQseURBQXlEO0FBQ3pELGlEQUFpRDtBQUNqRCwwREFBMEQ7QUFDMUQsMkNBQTJDO0FBQzNDLGlFQUFpRTtBQUNqRSw2Q0FBNkM7QUFDN0MsNkJBQTZCO0FBYTdCLE1BQWEsc0JBQXVCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDbkQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFrQztRQUMxRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxxQkFBcUIsRUFBRSx3QkFBd0IsRUFBRSxzQkFBc0IsRUFBRSxpQkFBaUIsR0FBRyxLQUFLLEVBQUUseUJBQXlCLEdBQUcsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRWxMLGtCQUFrQjtRQUNsQixNQUFNLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQztRQUVoRiw2RUFBNkU7UUFDN0UsSUFBSSxlQUFnQyxDQUFDO1FBQ3JDLElBQUksZUFBZ0MsQ0FBQztRQUNyQyxJQUFJLGdCQUFpQyxDQUFDO1FBQ3RDLElBQUkscUJBQXNDLENBQUM7UUFFM0MsSUFBSSxpQkFBaUIsSUFBSSxXQUFXLEtBQUsseUJBQXlCLEVBQUUsQ0FBQztZQUNuRSx3REFBd0Q7WUFDeEQsZUFBZSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRSxHQUFHLFdBQVcsY0FBYyxD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VSxFQUFFLEdBQUcsV0FBVyxlQUFlO1NBQzFDLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsb0JBQW9CLEVBQUU7WUFDNUMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxVQUFVO1lBQ2hDLFdBQVcsRUFBRSw2QkFBNkI7WUFDMUMsVUFBVSxFQUFFLEdBQUcsV0FBVyxrQkFBa0I7U0FDN0MsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvQyxLQUFLLEVBQUUsaUJBQWlCLENBQUMsVUFBVTtZQUNuQyxXQUFXLEVBQUUsMEJBQTBCO1lBQ3ZDLFVBQVUsRUFBRSxHQUFHLFdBQVcsc0JBQXNCO1NBQ2pELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTVVRCx3REE0VUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5JztcbmltcG9ydCAqIGFzIGV2ZW50cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzJztcbmltcG9ydCAqIGFzIHRhcmdldHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cy10YXJnZXRzJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlcic7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBPcGVuU291cmNlVHJhY2tlclN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG4gIGRvbWFpbk5hbWU/OiBzdHJpbmc7XG4gIGdpdGh1YlRva2VuU2VjcmV0TmFtZTogc3RyaW5nO1xuICBkZXZDcmVkZW50aWFsc1NlY3JldE5hbWU/OiBzdHJpbmc7XG4gIGRhdGFDb2xsZWN0aW9uU2NoZWR1bGU6IHN0cmluZztcbiAgdXNlU2hhcmVkRGF0YWJhc2U/OiBib29sZWFuO1xuICBzaGFyZWREYXRhYmFzZUVudmlyb25tZW50Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgT3BlblNvdXJjZVRyYWNrZXJTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBPcGVuU291cmNlVHJhY2tlclN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgZW52aXJvbm1lbnQsIGRvbWFpbk5hbWUsIGdpdGh1YlRva2VuU2VjcmV0TmFtZSwgZGV2Q3JlZGVudGlhbHNTZWNyZXROYW1lLCBkYXRhQ29sbGVjdGlvblNjaGVkdWxlLCB1c2VTaGFyZWREYXRhYmFzZSA9IGZhbHNlLCBzaGFyZWREYXRhYmFzZUVudmlyb25tZW50ID0gJ3Byb2QnIH0gPSBwcm9wcztcblxuICAgIC8vIER5bmFtb0RCIFRhYmxlc1xuICAgIGNvbnN0IHRhYmxlU3VmZml4ID0gdXNlU2hhcmVkRGF0YWJhc2UgPyBzaGFyZWREYXRhYmFzZUVudmlyb25tZW50IDogZW52aXJvbm1lbnQ7XG4gICAgXG4gICAgLy8gQ3JlYXRlIG9yIHJlZmVyZW5jZSBEeW5hbW9EQiB0YWJsZXMgYmFzZWQgb24gc2hhcmVkIGRhdGFiYXNlIGNvbmZpZ3VyYXRpb25cbiAgICBsZXQgc3Rhckdyb3d0aFRhYmxlOiBkeW5hbW9kYi5JVGFibGU7XG4gICAgbGV0IHByVmVsb2NpdHlUYWJsZTogZHluYW1vZGIuSVRhYmxlO1xuICAgIGxldCBpc3N1ZUhlYWx0aFRhYmxlOiBkeW5hbW9kYi5JVGFibGU7XG4gICAgbGV0IHBhY2thZ2VEb3dubG9hZHNUYWJsZTogZHluYW1vZGIuSVRhYmxlO1xuXG4gICAgaWYgKHVzZVNoYXJlZERhdGFiYXNlICYmIGVudmlyb25tZW50ICE9PSBzaGFyZWREYXRhYmFzZUVudmlyb25tZW50KSB7XG4gICAgICAvLyBSZWZlcmVuY2UgZXhpc3RpbmcgdGFibGVzIGZyb20gdGhlIHNoYXJlZCBlbnZpcm9ubWVudFxuICAgICAgc3Rhckdyb3d0aFRhYmxlID0gZHluYW1vZGIuVGFibGUuZnJvbVRhYmxlTmFtZSh0aGlzLCAnU3Rhckdyb3d0aFRhYmxlJywgYCR7dGFibGVTdWZmaXh9LXN0YXItZ3Jvd3RoYCk7XG4gICAgICBwclZlbG9jaXR5VGFibGUgPSBkeW5hbW9kYi5UYWJsZS5mcm9tVGFibGVOYW1lKHRoaXMsICdQUlZlbG9jaXR5VGFibGUnLCBgJHt0YWJsZVN1ZmZpeH0tcHItdmVsb2NpdHlgKTtcbiAgICAgIGlzc3VlSGVhbHRoVGFibGUgPSBkeW5hbW9kYi5UYWJsZS5mcm9tVGFibGVOYW1lKHRoaXMsICdJc3N1ZUhlYWx0aFRhYmxlJywgYCR7dGFibGVTdWZmaXh9LWlzc3VlLWhlYWx0aGApO1xuICAgICAgcGFja2FnZURvd25sb2Fkc1RhYmxlID0gZHluYW1vZGIuVGFibGUuZnJvbVRhYmxlTmFtZSh0aGlzLCAnUGFja2FnZURvd25sb2Fkc1RhYmxlJywgYCR7dGFibGVTdWZmaXh9LXBhY2thZ2UtZG93bmxvYWRzYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIENyZWF0ZSBuZXcgdGFibGVzIGZvciB0aGlzIGVudmlyb25tZW50XG4gICAgICBzdGFyR3Jvd3RoVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1N0YXJHcm93dGhUYWJsZScsIHtcbiAgICAgICAgdGFibGVOYW1lOiBgJHt0YWJsZVN1ZmZpeH0tc3Rhci1ncm93dGhgLFxuICAgICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3JlcG8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgICBzb3J0S2V5OiB7IG5hbWU6ICd0aW1lc3RhbXAnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgICByZW1vdmFsUG9saWN5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIH0pO1xuXG4gICAgICBwclZlbG9jaXR5VGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1BSVmVsb2NpdHlUYWJsZScsIHtcbiAgICAgICAgdGFibGVOYW1lOiBgJHt0YWJsZVN1ZmZpeH0tcHItdmVsb2NpdHlgLFxuICAgICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3JlcG8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgICBzb3J0S2V5OiB7IG5hbWU6ICdkYXRlJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICB9KTtcblxuICAgICAgaXNzdWVIZWFsdGhUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnSXNzdWVIZWFsdGhUYWJsZScsIHtcbiAgICAgICAgdGFibGVOYW1lOiBgJHt0YWJsZVN1ZmZpeH0taXNzdWUtaGVhbHRoYCxcbiAgICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdyZXBvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgICAgc29ydEtleTogeyBuYW1lOiAnZGF0ZScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGVudmlyb25tZW50ID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgfSk7XG5cbiAgICAgIHBhY2thZ2VEb3dubG9hZHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnUGFja2FnZURvd25sb2Fkc1RhYmxlJywge1xuICAgICAgICB0YWJsZU5hbWU6IGAke3RhYmxlU3VmZml4fS1wYWNrYWdlLWRvd25sb2Fkc2AsXG4gICAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncmVwbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ3dlZWtfc3RhcnQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgICByZW1vdmFsUG9saWN5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEdpdEh1YiBUb2tlbiBTZWNyZXRcbiAgICBsZXQgZ2l0aHViVG9rZW5TZWNyZXQ6IHNlY3JldHNtYW5hZ2VyLklTZWNyZXQ7XG4gICAgaWYgKHVzZVNoYXJlZERhdGFiYXNlICYmIGVudmlyb25tZW50ICE9PSBzaGFyZWREYXRhYmFzZUVudmlyb25tZW50KSB7XG4gICAgICAvLyBSZWZlcmVuY2UgZXhpc3Rpbmcgc2VjcmV0IGZyb20gdGhlIHNoYXJlZCBlbnZpcm9ubWVudFxuICAgICAgZ2l0aHViVG9rZW5TZWNyZXQgPSBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMih0aGlzLCAnR2l0SHViVG9rZW5TZWNyZXQnLCBnaXRodWJUb2tlblNlY3JldE5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBDcmVhdGUgbmV3IHNlY3JldCBmb3IgdGhpcyBlbnZpcm9ubWVudFxuICAgICAgZ2l0aHViVG9rZW5TZWNyZXQgPSBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsICdHaXRIdWJUb2tlblNlY3JldCcsIHtcbiAgICAgICAgc2VjcmV0TmFtZTogZ2l0aHViVG9rZW5TZWNyZXROYW1lLFxuICAgICAgICBkZXNjcmlwdGlvbjogYEdpdEh1YiBBUEkgdG9rZW4gZm9yICR7ZW52aXJvbm1lbnR9IGVudmlyb25tZW50YCxcbiAgICAgICAgZ2VuZXJhdGVTZWNyZXRTdHJpbmc6IHtcbiAgICAgICAgICBzZWNyZXRTdHJpbmdUZW1wbGF0ZTogSlNPTi5zdHJpbmdpZnkoeyB0b2tlbjogJycgfSksXG4gICAgICAgICAgZ2VuZXJhdGVTdHJpbmdLZXk6ICd0b2tlbicsXG4gICAgICAgICAgZXhjbHVkZUNoYXJhY3RlcnM6ICdcIkAvXFxcXCcsXG4gICAgICAgIH0sXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBTdGFnaW5nIENyZWRlbnRpYWxzIFNlY3JldCAob25seSBmb3Igc3RhZ2luZyBlbnZpcm9ubWVudClcbiAgICBsZXQgZGV2Q3JlZGVudGlhbHNTZWNyZXQ6IHNlY3JldHNtYW5hZ2VyLklTZWNyZXQgfCB1bmRlZmluZWQ7XG4gICAgaWYgKGVudmlyb25tZW50ID09PSAnc3RhZ2luZycgJiYgZGV2Q3JlZGVudGlhbHNTZWNyZXROYW1lKSB7XG4gICAgICBpZiAodXNlU2hhcmVkRGF0YWJhc2UgJiYgZW52aXJvbm1lbnQgIT09IHNoYXJlZERhdGFiYXNlRW52aXJvbm1lbnQpIHtcbiAgICAgICAgLy8gUmVmZXJlbmNlIGV4aXN0aW5nIHNlY3JldCBmcm9tIHRoZSBzaGFyZWQgZW52aXJvbm1lbnRcbiAgICAgICAgZGV2Q3JlZGVudGlhbHNTZWNyZXQgPSBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMih0aGlzLCAnU3RhZ2luZ0NyZWRlbnRpYWxzU2VjcmV0JywgZGV2Q3JlZGVudGlhbHNTZWNyZXROYW1lKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIENyZWF0ZSBuZXcgc2VjcmV0IGZvciB0aGlzIGVudmlyb25tZW50XG4gICAgICAgIGRldkNyZWRlbnRpYWxzU2VjcmV0ID0gbmV3IHNlY3JldHNtYW5hZ2VyLlNlY3JldCh0aGlzLCAnU3RhZ2luZ0NyZWRlbnRpYWxzU2VjcmV0Jywge1xuICAgICAgICAgIHNlY3JldE5hbWU6IGRldkNyZWRlbnRpYWxzU2VjcmV0TmFtZSxcbiAgICAgICAgICBkZXNjcmlwdGlvbjogYFN0YWdpbmcgZW52aXJvbm1lbnQgY3JlZGVudGlhbHMgZm9yICR7ZW52aXJvbm1lbnR9IGVudmlyb25tZW50YCxcbiAgICAgICAgICBnZW5lcmF0ZVNlY3JldFN0cmluZzoge1xuICAgICAgICAgICAgc2VjcmV0U3RyaW5nVGVtcGxhdGU6IEpTT04uc3RyaW5naWZ5KHsgdXNlcm5hbWU6ICdkZXYnLCBwYXNzd29yZDogJycgfSksXG4gICAgICAgICAgICBnZW5lcmF0ZVN0cmluZ0tleTogJ3Bhc3N3b3JkJyxcbiAgICAgICAgICAgIGV4Y2x1ZGVDaGFyYWN0ZXJzOiAnXCJAL1xcXFwnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIExhbWJkYSBMYXllciBmb3Igc2hhcmVkIGRlcGVuZGVuY2llc1xuICAgIGNvbnN0IHNoYXJlZExheWVyID0gbmV3IGxhbWJkYS5MYXllclZlcnNpb24odGhpcywgJ1NoYXJlZExheWVyJywge1xuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCdsYW1iZGEtbGF5ZXInKSxcbiAgICAgIGNvbXBhdGlibGVSdW50aW1lczogW2xhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YXSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2hhcmVkIGRlcGVuZGVuY2llcyBmb3IgT3BlbiBTb3VyY2UgVHJhY2tlciBMYW1iZGEgZnVuY3Rpb25zJyxcbiAgICAgIGxheWVyVmVyc2lvbk5hbWU6IGAke2Vudmlyb25tZW50fS1zaGFyZWQtbGF5ZXJgLFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIExhbWJkYSBGdW5jdGlvblxuICAgIGNvbnN0IGFwaUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQVBJRnVuY3Rpb24nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdsYW1iZGEtaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQnKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEVOVklST05NRU5UOiBlbnZpcm9ubWVudCxcbiAgICAgICAgU1RBUl9HUk9XVEhfVEFCTEU6IHN0YXJHcm93dGhUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFBSX1ZFTE9DSVRZX1RBQkxFOiBwclZlbG9jaXR5VGFibGUudGFibGVOYW1lLFxuICAgICAgICBJU1NVRV9IRUFMVEhfVEFCTEU6IGlzc3VlSGVhbHRoVGFibGUudGFibGVOYW1lLFxuICAgICAgICBQQUNLQUdFX0RPV05MT0FEU19UQUJMRTogcGFja2FnZURvd25sb2Fkc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgR0lUSFVCX1RPS0VOX1NFQ1JFVF9OQU1FOiBnaXRodWJUb2tlblNlY3JldE5hbWUsXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgbGF5ZXJzOiBbc2hhcmVkTGF5ZXJdLFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byBMYW1iZGFcbiAgICBzdGFyR3Jvd3RoVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGFwaUZ1bmN0aW9uKTtcbiAgICBwclZlbG9jaXR5VGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGFwaUZ1bmN0aW9uKTtcbiAgICBpc3N1ZUhlYWx0aFRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhcGlGdW5jdGlvbik7XG4gICAgcGFja2FnZURvd25sb2Fkc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhcGlGdW5jdGlvbik7XG4gICAgZ2l0aHViVG9rZW5TZWNyZXQuZ3JhbnRSZWFkKGFwaUZ1bmN0aW9uKTtcblxuICAgIC8vIERhdGEgQ29sbGVjdGlvbiBMYW1iZGEgRnVuY3Rpb25zXG4gICAgY29uc3Qgc3Rhckdyb3d0aENvbGxlY3RvciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1N0YXJHcm93dGhDb2xsZWN0b3InLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdzdGFyLWNvbGxlY3Rvci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9zY3JpcHRzJyksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBFTlZJUk9OTUVOVDogZW52aXJvbm1lbnQsXG4gICAgICAgIFNUQVJfR1JPV1RIX1RBQkxFOiBzdGFyR3Jvd3RoVGFibGUudGFibGVOYW1lLFxuICAgICAgICBHSVRIVUJfVE9LRU5fU0VDUkVUX05BTUU6IGdpdGh1YlRva2VuU2VjcmV0TmFtZSxcbiAgICAgICAgUkVQTzogJ3Byb21wdGZvby9wcm9tcHRmb28nLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGxheWVyczogW3NoYXJlZExheWVyXSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcHJWZWxvY2l0eUNvbGxlY3RvciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1BSVmVsb2NpdHlDb2xsZWN0b3InLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdwci1jb2xsZWN0b3IuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQvc2NyaXB0cycpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgRU5WSVJPTk1FTlQ6IGVudmlyb25tZW50LFxuICAgICAgICBQUl9WRUxPQ0lUWV9UQUJMRTogcHJWZWxvY2l0eVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgR0lUSFVCX1RPS0VOX1NFQ1JFVF9OQU1FOiBnaXRodWJUb2tlblNlY3JldE5hbWUsXG4gICAgICAgIFJFUE86ICdwcm9tcHRmb28vcHJvbXB0Zm9vJyxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgICBsYXllcnM6IFtzaGFyZWRMYXllcl0sXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIGNvbnN0IGlzc3VlSGVhbHRoQ29sbGVjdG9yID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnSXNzdWVIZWFsdGhDb2xsZWN0b3InLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdpc3N1ZS1jb2xsZWN0b3IuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQvc2NyaXB0cycpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgRU5WSVJPTk1FTlQ6IGVudmlyb25tZW50LFxuICAgICAgICBJU1NVRV9IRUFMVEhfVEFCTEU6IGlzc3VlSGVhbHRoVGFibGUudGFibGVOYW1lLFxuICAgICAgICBHSVRIVUJfVE9LRU5fU0VDUkVUX05BTUU6IGdpdGh1YlRva2VuU2VjcmV0TmFtZSxcbiAgICAgICAgUkVQTzogJ3Byb21wdGZvby9wcm9tcHRmb28nLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGxheWVyczogW3NoYXJlZExheWVyXSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgY29uc3QgcGFja2FnZURvd25sb2Fkc0NvbGxlY3RvciA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1BhY2thZ2VEb3dubG9hZHNDb2xsZWN0b3InLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdwYWNrYWdlLWNvbGxlY3Rvci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9zY3JpcHRzJyksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBFTlZJUk9OTUVOVDogZW52aXJvbm1lbnQsXG4gICAgICAgIFBBQ0tBR0VfRE9XTkxPQURTX1RBQkxFOiBwYWNrYWdlRG93bmxvYWRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBHSVRIVUJfVE9LRU5fU0VDUkVUX05BTUU6IGdpdGh1YlRva2VuU2VjcmV0TmFtZSxcbiAgICAgICAgUkVQTzogJ3Byb21wdGZvby9wcm9tcHRmb28nLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGxheWVyczogW3NoYXJlZExheWVyXSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gY29sbGVjdG9yc1xuICAgIHN0YXJHcm93dGhUYWJsZS5ncmFudFdyaXRlRGF0YShzdGFyR3Jvd3RoQ29sbGVjdG9yKTtcbiAgICBwclZlbG9jaXR5VGFibGUuZ3JhbnRXcml0ZURhdGEocHJWZWxvY2l0eUNvbGxlY3Rvcik7XG4gICAgaXNzdWVIZWFsdGhUYWJsZS5ncmFudFdyaXRlRGF0YShpc3N1ZUhlYWx0aENvbGxlY3Rvcik7XG4gICAgcGFja2FnZURvd25sb2Fkc1RhYmxlLmdyYW50V3JpdGVEYXRhKHBhY2thZ2VEb3dubG9hZHNDb2xsZWN0b3IpO1xuICAgIGdpdGh1YlRva2VuU2VjcmV0LmdyYW50UmVhZChzdGFyR3Jvd3RoQ29sbGVjdG9yKTtcbiAgICBnaXRodWJUb2tlblNlY3JldC5ncmFudFJlYWQocHJWZWxvY2l0eUNvbGxlY3Rvcik7XG4gICAgZ2l0aHViVG9rZW5TZWNyZXQuZ3JhbnRSZWFkKGlzc3VlSGVhbHRoQ29sbGVjdG9yKTtcbiAgICBnaXRodWJUb2tlblNlY3JldC5ncmFudFJlYWQocGFja2FnZURvd25sb2Fkc0NvbGxlY3Rvcik7XG5cbiAgICAvLyBFdmVudEJyaWRnZSBSdWxlcyBmb3Igc2NoZWR1bGVkIGRhdGEgY29sbGVjdGlvblxuICAgIC8vIFN0YXIgZ3Jvd3RoOiBldmVyeSAzIGhvdXJzIHN0YXJ0aW5nIGF0IDM6MDAgQU0gUERUICgxMDowMCBBTSBVVEMpXG4gICAgY29uc3QgZnJlcXVlbnREYXRhQ29sbGVjdGlvblJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0ZyZXF1ZW50RGF0YUNvbGxlY3Rpb25SdWxlJywge1xuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5leHByZXNzaW9uKCdjcm9uKDAgMTAvMyAqICogPyAqKScpLCAvLyAxMCBBTSBVVEMgPSAzIEFNIFBEVCwgdGhlbiBldmVyeSAzIGhvdXJzXG4gICAgICBkZXNjcmlwdGlvbjogYEZyZXF1ZW50IGRhdGEgY29sbGVjdGlvbiAoZXZlcnkgMyBob3VycyBzdGFydGluZyAzOjAwIEFNIFBEVCkgZm9yICR7ZW52aXJvbm1lbnR9IGVudmlyb25tZW50YCxcbiAgICB9KTtcblxuICAgIC8vIFBSIHZlbG9jaXR5IGFuZCBpc3N1ZSBoZWFsdGg6IG9uY2UgZGFpbHkgYXQgMTE6NTAgUE0gUFNUICg3OjUwIEFNIFVUQyBuZXh0IGRheSlcbiAgICBjb25zdCBkYWlseURhdGFDb2xsZWN0aW9uUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnRGFpbHlEYXRhQ29sbGVjdGlvblJ1bGUnLCB7XG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmV4cHJlc3Npb24oJ2Nyb24oNTAgNyAqICogPyAqKScpLCAvLyA3OjUwIEFNIFVUQyA9IDExOjUwIFBNIFBTVFxuICAgICAgZGVzY3JpcHRpb246IGBEYWlseSBkYXRhIGNvbGxlY3Rpb24gKDExOjUwIFBNIFBTVCkgZm9yICR7ZW52aXJvbm1lbnR9IGVudmlyb25tZW50YCxcbiAgICB9KTtcblxuICAgIC8vIFBhY2thZ2UgZG93bmxvYWRzOiBvbmNlIGV2ZXJ5IDcgZGF5cyBzdGFydGluZyBvbiB0aGUgMjl0aCBhdCAxMTo1MCBQTSBQU1QgKDc6NTAgQU0gVVRDIG5leHQgZGF5KVxuICAgIGNvbnN0IHdlZWtseURhdGFDb2xsZWN0aW9uUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnV2Vla2x5RGF0YUNvbGxlY3Rpb25SdWxlJywge1xuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5leHByZXNzaW9uKCdjcm9uKDUwIDcgPyAqIFNVTiAqKScpLCAvLyA3OjUwIEFNIFVUQyA9IDExOjUwIFBNIFBTVCBvbiBTdW5kYXlzXG4gICAgICBkZXNjcmlwdGlvbjogYFdlZWtseSBkYXRhIGNvbGxlY3Rpb24gKGV2ZXJ5IFN1bmRheSBhdCAxMTo1MCBQTSBQU1QpIGZvciAke2Vudmlyb25tZW50fSBlbnZpcm9ubWVudGAsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgdGFyZ2V0cyB0byB0aGUgZnJlcXVlbnQgcnVsZSAoZXZlcnkgMyBob3VycylcbiAgICBmcmVxdWVudERhdGFDb2xsZWN0aW9uUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24oc3Rhckdyb3d0aENvbGxlY3RvcikpO1xuXG4gICAgLy8gQWRkIHRhcmdldHMgdG8gdGhlIGRhaWx5IHJ1bGUgKG9uY2UgcGVyIGRheSlcbiAgICBkYWlseURhdGFDb2xsZWN0aW9uUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24ocHJWZWxvY2l0eUNvbGxlY3RvcikpO1xuICAgIGRhaWx5RGF0YUNvbGxlY3Rpb25SdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihpc3N1ZUhlYWx0aENvbGxlY3RvcikpO1xuXG4gICAgLy8gQWRkIHRhcmdldHMgdG8gdGhlIHdlZWtseSBydWxlIChvbmNlIHBlciB3ZWVrKVxuICAgIHdlZWtseURhdGFDb2xsZWN0aW9uUnVsZS5hZGRUYXJnZXQobmV3IHRhcmdldHMuTGFtYmRhRnVuY3Rpb24ocGFja2FnZURvd25sb2Fkc0NvbGxlY3RvcikpO1xuXG4gICAgLy8gQVBJIEdhdGV3YXlcbiAgICBjb25zdCBhcGkgPSBuZXcgYXBpZ2F0ZXdheS5SZXN0QXBpKHRoaXMsICdPcGVuU291cmNlVHJhY2tlckFQSScsIHtcbiAgICAgIHJlc3RBcGlOYW1lOiBgJHtlbnZpcm9ubWVudH0tb3Blbi1zb3VyY2UtdHJhY2tlci1hcGlgLFxuICAgICAgZGVzY3JpcHRpb246IGBBUEkgZm9yIE9wZW4gU291cmNlIFRyYWNrZXIgJHtlbnZpcm9ubWVudH0gZW52aXJvbm1lbnRgLFxuICAgICAgZGVmYXVsdENvcnNQcmVmbGlnaHRPcHRpb25zOiB7XG4gICAgICAgIGFsbG93T3JpZ2luczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9PUklHSU5TLFxuICAgICAgICBhbGxvd01ldGhvZHM6IGFwaWdhdGV3YXkuQ29ycy5BTExfTUVUSE9EUyxcbiAgICAgICAgYWxsb3dIZWFkZXJzOiBbJ0NvbnRlbnQtVHlwZScsICdYLUFtei1EYXRlJywgJ0F1dGhvcml6YXRpb24nLCAnWC1BcGktS2V5J10sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgSW50ZWdyYXRpb25cbiAgICBjb25zdCBhcGlJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUZ1bmN0aW9uKTtcblxuICAgIC8vIEFQSSBSb3V0ZXNcbiAgICBhcGkucm9vdC5hZGRQcm94eSh7XG4gICAgICBkZWZhdWx0SW50ZWdyYXRpb246IGFwaUludGVncmF0aW9uLFxuICAgICAgYW55TWV0aG9kOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gUzMgQnVja2V0IGZvciBGcm9udGVuZFxuICAgIGNvbnN0IGZyb250ZW5kQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnRnJvbnRlbmRCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgJHtlbnZpcm9ubWVudH0tb3Blbi1zb3VyY2UtdHJhY2tlci1mcm9udGVuZC0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgd2Vic2l0ZUluZGV4RG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcbiAgICAgIHdlYnNpdGVFcnJvckRvY3VtZW50OiAnaW5kZXguaHRtbCcsXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiB0cnVlLFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FDTFMsXG4gICAgICByZW1vdmFsUG9saWN5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiBlbnZpcm9ubWVudCAhPT0gJ3Byb2QnLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcHVibGljIHJlYWQgYWNjZXNzIHRvIHRoZSBidWNrZXRcbiAgICBmcm9udGVuZEJ1Y2tldC5hZGRUb1Jlc291cmNlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnczM6R2V0T2JqZWN0J10sXG4gICAgICByZXNvdXJjZXM6IFtmcm9udGVuZEJ1Y2tldC5hcm5Gb3JPYmplY3RzKCcqJyldLFxuICAgICAgcHJpbmNpcGFsczogW25ldyBpYW0uQW55UHJpbmNpcGFsKCldLFxuICAgIH0pKTtcblxuICAgIC8vIFVzZSBTM09yaWdpbiB3aXRoIHByb3BlciBjb25maWd1cmF0aW9uXG4gICAgY29uc3QgczNPcmlnaW4gPSBuZXcgb3JpZ2lucy5TM09yaWdpbihmcm9udGVuZEJ1Y2tldCk7XG5cbiAgICAvLyBMYW1iZGFARWRnZSBmdW5jdGlvbiBmb3Igc3RhZ2luZyBlbnZpcm9ubWVudCBhdXRoZW50aWNhdGlvblxuICAgIGxldCBhdXRoRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbiB8IHVuZGVmaW5lZDtcbiAgICBpZiAoZW52aXJvbm1lbnQgPT09ICdzdGFnaW5nJykge1xuICAgICAgYXV0aEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXV0aEZ1bmN0aW9uJywge1xuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgICAgaGFuZGxlcjogJ2F1dGgtZnVuY3Rpb24uaGFuZGxlcicsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhLWVkZ2UnKSksXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDUpLFxuICAgICAgICBtZW1vcnlTaXplOiAxMjgsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBDbG91ZEZyb250IERpc3RyaWJ1dGlvblxuICAgIGNvbnN0IGRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnRnJvbnRlbmREaXN0cmlidXRpb24nLCB7XG4gICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgb3JpZ2luOiBzM09yaWdpbixcbiAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgICAuLi4oZW52aXJvbm1lbnQgPT09ICdzdGFnaW5nJyAmJiBhdXRoRnVuY3Rpb24gPyB7XG4gICAgICAgICAgZWRnZUxhbWJkYXM6IFt7XG4gICAgICAgICAgICBmdW5jdGlvblZlcnNpb246IGF1dGhGdW5jdGlvbi5jdXJyZW50VmVyc2lvbixcbiAgICAgICAgICAgIGV2ZW50VHlwZTogY2xvdWRmcm9udC5MYW1iZGFFZGdlRXZlbnRUeXBlLlZJRVdFUl9SRVFVRVNULFxuICAgICAgICAgIH1dLFxuICAgICAgICB9IDoge30pLFxuICAgICAgfSxcbiAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FQSUVuZHBvaW50Jywge1xuICAgICAgdmFsdWU6IGFwaS51cmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IGVuZHBvaW50IFVSTCcsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZpcm9ubWVudH0tYXBpLWVuZHBvaW50YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGcm9udGVuZFVSTCcsIHtcbiAgICAgIHZhbHVlOiBkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudmlyb25tZW50fS1mcm9udGVuZC11cmxgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiBmcm9udGVuZEJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdTMyBidWNrZXQgbmFtZSBmb3IgZnJvbnRlbmQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7ZW52aXJvbm1lbnR9LWZyb250ZW5kLWJ1Y2tldGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnR2l0SHViVG9rZW5TZWNyZXROYW1lJywge1xuICAgICAgdmFsdWU6IGdpdGh1YlRva2VuU2VjcmV0LnNlY3JldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0dpdEh1YiB0b2tlbiBzZWNyZXQgbmFtZScsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZpcm9ubWVudH0tZ2l0aHViLXRva2VuLXNlY3JldGAsXG4gICAgfSk7XG4gIH1cbn0gIl19