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
        const { environment, domainName, githubTokenSecretName, dataCollectionSchedule, useSharedDatabase = false, sharedDatabaseEnvironment = 'prod' } = props;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3Blbi1zb3VyY2UtdHJhY2tlci1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9wZW4tc291cmNlLXRyYWNrZXItc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLGlEQUFpRDtBQUNqRCxxREFBcUQ7QUFDckQseUNBQXlDO0FBQ3pDLHlEQUF5RDtBQUN6RCw4REFBOEQ7QUFDOUQseURBQXlEO0FBQ3pELGlEQUFpRDtBQUNqRCwwREFBMEQ7QUFDMUQsMkNBQTJDO0FBQzNDLGlFQUFpRTtBQUNqRSw2Q0FBNkM7QUFDN0MsNkJBQTZCO0FBWTdCLE1BQWEsc0JBQXVCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDbkQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFrQztRQUMxRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxxQkFBcUIsRUFBRSxzQkFBc0IsRUFBRSxpQkFBaUIsR0FBRyxLQUFLLEVBQUUseUJBQXlCLEdBQUcsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRXhKLGtCQUFrQjtRQUNsQixNQUFNLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQztRQUVoRiw2RUFBNkU7UUFDN0UsSUFBSSxlQUFnQyxDQUFDO1FBQ3JDLElBQUksZUFBZ0MsQ0FBQztRQUNyQyxJQUFJLGdCQUFpQyxDQUFDO1FBQ3RDLElBQUkscUJBQXNDLENBQUM7UUFFM0MsSUFBSSxpQkFBaUIsSUFBSSxXQUFXLEtBQUsseUJBQXlCLEVBQUUsQ0FBQztZQUNuRSx3REFBd0Q7WUFDeEQsZUFBZSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRSxHQUFHLFdBQVcsY0FBYyxDQUFDLENBQUM7WUFD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Q0Y7U0FDRixDQUFDLENBQUM7UUFFSCxVQUFVO1FBQ1YsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDckMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxHQUFHO1lBQ2QsV0FBVyxFQUFFLDBCQUEwQjtZQUN2QyxVQUFVLEVBQUUsR0FBRyxXQUFXLGVBQWU7U0FDMUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDckMsS0FBSyxFQUFFLFlBQVksQ0FBQyxzQkFBc0I7WUFDMUMsV0FBVyxFQUFFLDZCQUE2QjtZQUMxQyxVQUFVLEVBQUUsR0FBRyxXQUFXLGVBQWU7U0FDMUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1QyxLQUFLLEVBQUUsY0FBYyxDQUFDLFVBQVU7WUFDaEMsV0FBVyxFQUFFLDZCQUE2QjtZQUMxQyxVQUFVLEVBQUUsR0FBRyxXQUFXLGtCQUFrQjtTQUM3QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQy9DLEtBQUssRUFBRSxpQkFBaUIsQ0FBQyxVQUFVO1lBQ25DLFdBQVcsRUFBRSwwQkFBMEI7WUFDdkMsVUFBVSxFQUFFLEdBQUcsV0FBVyxzQkFBc0I7U0FDakQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBeFRELHdEQXdUQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE9wZW5Tb3VyY2VUcmFja2VyU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgZG9tYWluTmFtZT86IHN0cmluZztcbiAgZ2l0aHViVG9rZW5TZWNyZXROYW1lOiBzdHJpbmc7XG4gIGRhdGFDb2xsZWN0aW9uU2NoZWR1bGU6IHN0cmluZztcbiAgdXNlU2hhcmVkRGF0YWJhc2U/OiBib29sZWFuO1xuICBzaGFyZWREYXRhYmFzZUVudmlyb25tZW50Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgT3BlblNvdXJjZVRyYWNrZXJTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzOiBPcGVuU291cmNlVHJhY2tlclN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgZW52aXJvbm1lbnQsIGRvbWFpbk5hbWUsIGdpdGh1YlRva2VuU2VjcmV0TmFtZSwgZGF0YUNvbGxlY3Rpb25TY2hlZHVsZSwgdXNlU2hhcmVkRGF0YWJhc2UgPSBmYWxzZSwgc2hhcmVkRGF0YWJhc2VFbnZpcm9ubWVudCA9ICdwcm9kJyB9ID0gcHJvcHM7XG5cbiAgICAvLyBEeW5hbW9EQiBUYWJsZXNcbiAgICBjb25zdCB0YWJsZVN1ZmZpeCA9IHVzZVNoYXJlZERhdGFiYXNlID8gc2hhcmVkRGF0YWJhc2VFbnZpcm9ubWVudCA6IGVudmlyb25tZW50O1xuICAgIFxuICAgIC8vIENyZWF0ZSBvciByZWZlcmVuY2UgRHluYW1vREIgdGFibGVzIGJhc2VkIG9uIHNoYXJlZCBkYXRhYmFzZSBjb25maWd1cmF0aW9uXG4gICAgbGV0IHN0YXJHcm93dGhUYWJsZTogZHluYW1vZGIuSVRhYmxlO1xuICAgIGxldCBwclZlbG9jaXR5VGFibGU6IGR5bmFtb2RiLklUYWJsZTtcbiAgICBsZXQgaXNzdWVIZWFsdGhUYWJsZTogZHluYW1vZGIuSVRhYmxlO1xuICAgIGxldCBwYWNrYWdlRG93bmxvYWRzVGFibGU6IGR5bmFtb2RiLklUYWJsZTtcblxuICAgIGlmICh1c2VTaGFyZWREYXRhYmFzZSAmJiBlbnZpcm9ubWVudCAhPT0gc2hhcmVkRGF0YWJhc2VFbnZpcm9ubWVudCkge1xuICAgICAgLy8gUmVmZXJlbmNlIGV4aXN0aW5nIHRhYmxlcyBmcm9tIHRoZSBzaGFyZWQgZW52aXJvbm1lbnRcbiAgICAgIHN0YXJHcm93dGhUYWJsZSA9IGR5bmFtb2RiLlRhYmxlLmZyb21UYWJsZU5hbWUodGhpcywgJ1N0YXJHcm93dGhUYWJsZScsIGAke3RhYmxlU3VmZml4fS1zdGFyLWdyb3d0aGApO1xuICAgICAgcHJWZWxvY2l0eVRhYmxlID0gZHluYW1vZGIuVGFibGUuZnJvbVRhYmxlTmFtZSh0aGlzLCAnUFJWZWxvY2l0eVRhYmxlJywgYCR7dGFibGVTdWZmaXh9LXByLXZlbG9jaXR5YCk7XG4gICAgICBpc3N1ZUhlYWx0aFRhYmxlID0gZHluYW1vZGIuVGFibGUuZnJvbVRhYmxlTmFtZSh0aGlzLCAnSXNzdWVIZWFsdGhUYWJsZScsIGAke3RhYmxlU3VmZml4fS1pc3N1ZS1oZWFsdGhgKTtcbiAgICAgIHBhY2thZ2VEb3dubG9hZHNUYWJsZSA9IGR5bmFtb2RiLlRhYmxlLmZyb21UYWJsZU5hbWUodGhpcywgJ1BhY2thZ2VEb3dubG9hZHNUYWJsZScsIGAke3RhYmxlU3VmZml4fS1wYWNrYWdlLWRvd25sb2Fkc2ApO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBDcmVhdGUgbmV3IHRhYmxlcyBmb3IgdGhpcyBlbnZpcm9ubWVudFxuICAgICAgc3Rhckdyb3d0aFRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdTdGFyR3Jvd3RoVGFibGUnLCB7XG4gICAgICAgIHRhYmxlTmFtZTogYCR7dGFibGVTdWZmaXh9LXN0YXItZ3Jvd3RoYCxcbiAgICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdyZXBvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgICAgc29ydEtleTogeyBuYW1lOiAndGltZXN0YW1wJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICB9KTtcblxuICAgICAgcHJWZWxvY2l0eVRhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdQUlZlbG9jaXR5VGFibGUnLCB7XG4gICAgICAgIHRhYmxlTmFtZTogYCR7dGFibGVTdWZmaXh9LXByLXZlbG9jaXR5YCxcbiAgICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdyZXBvJywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgICAgc29ydEtleTogeyBuYW1lOiAnZGF0ZScsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICAgIGJpbGxpbmdNb2RlOiBkeW5hbW9kYi5CaWxsaW5nTW9kZS5QQVlfUEVSX1JFUVVFU1QsXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IGVudmlyb25tZW50ID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgfSk7XG5cbiAgICAgIGlzc3VlSGVhbHRoVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ0lzc3VlSGVhbHRoVGFibGUnLCB7XG4gICAgICAgIHRhYmxlTmFtZTogYCR7dGFibGVTdWZmaXh9LWlzc3VlLWhlYWx0aGAsXG4gICAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncmVwbycsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICAgIHNvcnRLZXk6IHsgbmFtZTogJ2RhdGUnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgICByZW1vdmFsUG9saWN5OiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIH0pO1xuXG4gICAgICBwYWNrYWdlRG93bmxvYWRzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgJ1BhY2thZ2VEb3dubG9hZHNUYWJsZScsIHtcbiAgICAgICAgdGFibGVOYW1lOiBgJHt0YWJsZVN1ZmZpeH0tcGFja2FnZS1kb3dubG9hZHNgLFxuICAgICAgICBwYXJ0aXRpb25LZXk6IHsgbmFtZTogJ3JlcG8nLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgICBzb3J0S2V5OiB7IG5hbWU6ICd3ZWVrX3N0YXJ0JywgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcgfSxcbiAgICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBHaXRIdWIgVG9rZW4gU2VjcmV0XG4gICAgbGV0IGdpdGh1YlRva2VuU2VjcmV0OiBzZWNyZXRzbWFuYWdlci5JU2VjcmV0O1xuICAgIGlmICh1c2VTaGFyZWREYXRhYmFzZSAmJiBlbnZpcm9ubWVudCAhPT0gc2hhcmVkRGF0YWJhc2VFbnZpcm9ubWVudCkge1xuICAgICAgLy8gUmVmZXJlbmNlIGV4aXN0aW5nIHNlY3JldCBmcm9tIHRoZSBzaGFyZWQgZW52aXJvbm1lbnRcbiAgICAgIGdpdGh1YlRva2VuU2VjcmV0ID0gc2VjcmV0c21hbmFnZXIuU2VjcmV0LmZyb21TZWNyZXROYW1lVjIodGhpcywgJ0dpdEh1YlRva2VuU2VjcmV0JywgZ2l0aHViVG9rZW5TZWNyZXROYW1lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQ3JlYXRlIG5ldyBzZWNyZXQgZm9yIHRoaXMgZW52aXJvbm1lbnRcbiAgICAgIGdpdGh1YlRva2VuU2VjcmV0ID0gbmV3IHNlY3JldHNtYW5hZ2VyLlNlY3JldCh0aGlzLCAnR2l0SHViVG9rZW5TZWNyZXQnLCB7XG4gICAgICAgIHNlY3JldE5hbWU6IGdpdGh1YlRva2VuU2VjcmV0TmFtZSxcbiAgICAgICAgZGVzY3JpcHRpb246IGBHaXRIdWIgQVBJIHRva2VuIGZvciAke2Vudmlyb25tZW50fSBlbnZpcm9ubWVudGAsXG4gICAgICAgIGdlbmVyYXRlU2VjcmV0U3RyaW5nOiB7XG4gICAgICAgICAgc2VjcmV0U3RyaW5nVGVtcGxhdGU6IEpTT04uc3RyaW5naWZ5KHsgdG9rZW46ICcnIH0pLFxuICAgICAgICAgIGdlbmVyYXRlU3RyaW5nS2V5OiAndG9rZW4nLFxuICAgICAgICAgIGV4Y2x1ZGVDaGFyYWN0ZXJzOiAnXCJAL1xcXFwnLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gTGFtYmRhIExheWVyIGZvciBzaGFyZWQgZGVwZW5kZW5jaWVzXG4gICAgY29uc3Qgc2hhcmVkTGF5ZXIgPSBuZXcgbGFtYmRhLkxheWVyVmVyc2lvbih0aGlzLCAnU2hhcmVkTGF5ZXInLCB7XG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS1sYXllcicpLFxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1hdLFxuICAgICAgZGVzY3JpcHRpb246ICdTaGFyZWQgZGVwZW5kZW5jaWVzIGZvciBPcGVuIFNvdXJjZSBUcmFja2VyIExhbWJkYSBmdW5jdGlvbnMnLFxuICAgICAgbGF5ZXJWZXJzaW9uTmFtZTogYCR7ZW52aXJvbm1lbnR9LXNoYXJlZC1sYXllcmAsXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgTGFtYmRhIEZ1bmN0aW9uXG4gICAgY29uc3QgYXBpRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBUElGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2xhbWJkYS1pbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZCcpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgRU5WSVJPTk1FTlQ6IGVudmlyb25tZW50LFxuICAgICAgICBTVEFSX0dST1dUSF9UQUJMRTogc3Rhckdyb3d0aFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgUFJfVkVMT0NJVFlfVEFCTEU6IHByVmVsb2NpdHlUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIElTU1VFX0hFQUxUSF9UQUJMRTogaXNzdWVIZWFsdGhUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFBBQ0tBR0VfRE9XTkxPQURTX1RBQkxFOiBwYWNrYWdlRG93bmxvYWRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBHSVRIVUJfVE9LRU5fU0VDUkVUX05BTUU6IGdpdGh1YlRva2VuU2VjcmV0TmFtZSxcbiAgICAgIH0sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBsYXllcnM6IFtzaGFyZWRMYXllcl0sXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIHRvIExhbWJkYVxuICAgIHN0YXJHcm93dGhUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXBpRnVuY3Rpb24pO1xuICAgIHByVmVsb2NpdHlUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXBpRnVuY3Rpb24pO1xuICAgIGlzc3VlSGVhbHRoVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGFwaUZ1bmN0aW9uKTtcbiAgICBwYWNrYWdlRG93bmxvYWRzVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGFwaUZ1bmN0aW9uKTtcbiAgICBnaXRodWJUb2tlblNlY3JldC5ncmFudFJlYWQoYXBpRnVuY3Rpb24pO1xuXG4gICAgLy8gRGF0YSBDb2xsZWN0aW9uIExhbWJkYSBGdW5jdGlvbnNcbiAgICBjb25zdCBzdGFyR3Jvd3RoQ29sbGVjdG9yID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnU3Rhckdyb3d0aENvbGxlY3RvcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ3N0YXItY29sbGVjdG9yLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL3NjcmlwdHMnKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEVOVklST05NRU5UOiBlbnZpcm9ubWVudCxcbiAgICAgICAgU1RBUl9HUk9XVEhfVEFCTEU6IHN0YXJHcm93dGhUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEdJVEhVQl9UT0tFTl9TRUNSRVRfTkFNRTogZ2l0aHViVG9rZW5TZWNyZXROYW1lLFxuICAgICAgICBSRVBPOiAncHJvbXB0Zm9vL3Byb21wdGZvbycsXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgbGF5ZXJzOiBbc2hhcmVkTGF5ZXJdLFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICBjb25zdCBwclZlbG9jaXR5Q29sbGVjdG9yID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUFJWZWxvY2l0eUNvbGxlY3RvcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ3ByLWNvbGxlY3Rvci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9zY3JpcHRzJyksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBFTlZJUk9OTUVOVDogZW52aXJvbm1lbnQsXG4gICAgICAgIFBSX1ZFTE9DSVRZX1RBQkxFOiBwclZlbG9jaXR5VGFibGUudGFibGVOYW1lLFxuICAgICAgICBHSVRIVUJfVE9LRU5fU0VDUkVUX05BTUU6IGdpdGh1YlRva2VuU2VjcmV0TmFtZSxcbiAgICAgICAgUkVQTzogJ3Byb21wdGZvby9wcm9tcHRmb28nLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGxheWVyczogW3NoYXJlZExheWVyXSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgY29uc3QgaXNzdWVIZWFsdGhDb2xsZWN0b3IgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdJc3N1ZUhlYWx0aENvbGxlY3RvcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2lzc3VlLWNvbGxlY3Rvci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZC9zY3JpcHRzJyksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBFTlZJUk9OTUVOVDogZW52aXJvbm1lbnQsXG4gICAgICAgIElTU1VFX0hFQUxUSF9UQUJMRTogaXNzdWVIZWFsdGhUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEdJVEhVQl9UT0tFTl9TRUNSRVRfTkFNRTogZ2l0aHViVG9rZW5TZWNyZXROYW1lLFxuICAgICAgICBSRVBPOiAncHJvbXB0Zm9vL3Byb21wdGZvbycsXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgbGF5ZXJzOiBbc2hhcmVkTGF5ZXJdLFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICBjb25zdCBwYWNrYWdlRG93bmxvYWRzQ29sbGVjdG9yID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUGFja2FnZURvd25sb2Fkc0NvbGxlY3RvcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ3BhY2thZ2UtY29sbGVjdG9yLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kL3NjcmlwdHMnKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEVOVklST05NRU5UOiBlbnZpcm9ubWVudCxcbiAgICAgICAgUEFDS0FHRV9ET1dOTE9BRFNfVEFCTEU6IHBhY2thZ2VEb3dubG9hZHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEdJVEhVQl9UT0tFTl9TRUNSRVRfTkFNRTogZ2l0aHViVG9rZW5TZWNyZXROYW1lLFxuICAgICAgICBSRVBPOiAncHJvbXB0Zm9vL3Byb21wdGZvbycsXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgbGF5ZXJzOiBbc2hhcmVkTGF5ZXJdLFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byBjb2xsZWN0b3JzXG4gICAgc3Rhckdyb3d0aFRhYmxlLmdyYW50V3JpdGVEYXRhKHN0YXJHcm93dGhDb2xsZWN0b3IpO1xuICAgIHByVmVsb2NpdHlUYWJsZS5ncmFudFdyaXRlRGF0YShwclZlbG9jaXR5Q29sbGVjdG9yKTtcbiAgICBpc3N1ZUhlYWx0aFRhYmxlLmdyYW50V3JpdGVEYXRhKGlzc3VlSGVhbHRoQ29sbGVjdG9yKTtcbiAgICBwYWNrYWdlRG93bmxvYWRzVGFibGUuZ3JhbnRXcml0ZURhdGEocGFja2FnZURvd25sb2Fkc0NvbGxlY3Rvcik7XG4gICAgZ2l0aHViVG9rZW5TZWNyZXQuZ3JhbnRSZWFkKHN0YXJHcm93dGhDb2xsZWN0b3IpO1xuICAgIGdpdGh1YlRva2VuU2VjcmV0LmdyYW50UmVhZChwclZlbG9jaXR5Q29sbGVjdG9yKTtcbiAgICBnaXRodWJUb2tlblNlY3JldC5ncmFudFJlYWQoaXNzdWVIZWFsdGhDb2xsZWN0b3IpO1xuICAgIGdpdGh1YlRva2VuU2VjcmV0LmdyYW50UmVhZChwYWNrYWdlRG93bmxvYWRzQ29sbGVjdG9yKTtcblxuICAgIC8vIEV2ZW50QnJpZGdlIFJ1bGVzIGZvciBzY2hlZHVsZWQgZGF0YSBjb2xsZWN0aW9uXG4gICAgLy8gU3RhciBncm93dGg6IGV2ZXJ5IDMgaG91cnMgc3RhcnRpbmcgYXQgMyBBTSBQU1QgKDExIEFNIFVUQylcbiAgICBjb25zdCBmcmVxdWVudERhdGFDb2xsZWN0aW9uUnVsZSA9IG5ldyBldmVudHMuUnVsZSh0aGlzLCAnRnJlcXVlbnREYXRhQ29sbGVjdGlvblJ1bGUnLCB7XG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmV4cHJlc3Npb24oJ2Nyb24oMCAxMS8zICogKiA/ICopJyksIC8vIDExIEFNIFVUQyA9IDMgQU0gUFNULCB0aGVuIGV2ZXJ5IDMgaG91cnNcbiAgICAgIGRlc2NyaXB0aW9uOiBgRnJlcXVlbnQgZGF0YSBjb2xsZWN0aW9uIChldmVyeSAzIGhvdXJzIHN0YXJ0aW5nIDMgQU0gUFNUKSBmb3IgJHtlbnZpcm9ubWVudH0gZW52aXJvbm1lbnRgLFxuICAgIH0pO1xuXG4gICAgLy8gUFIgdmVsb2NpdHkgYW5kIGlzc3VlIGhlYWx0aDogb25jZSBkYWlseSBhdCAxMTo1MCBQTSBQU1QgKDc6NTAgQU0gVVRDIG5leHQgZGF5KVxuICAgIGNvbnN0IGRhaWx5RGF0YUNvbGxlY3Rpb25SdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdEYWlseURhdGFDb2xsZWN0aW9uUnVsZScsIHtcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuZXhwcmVzc2lvbignY3Jvbig1MCA3ICogKiA/ICopJyksIC8vIDc6NTAgQU0gVVRDID0gMTE6NTAgUE0gUFNUXG4gICAgICBkZXNjcmlwdGlvbjogYERhaWx5IGRhdGEgY29sbGVjdGlvbiAoMTE6NTAgUE0gUFNUKSBmb3IgJHtlbnZpcm9ubWVudH0gZW52aXJvbm1lbnRgLFxuICAgIH0pO1xuXG4gICAgLy8gUGFja2FnZSBkb3dubG9hZHM6IG9uY2UgZXZlcnkgNyBkYXlzIHN0YXJ0aW5nIG9uIHRoZSAyOXRoIGF0IDExOjUwIFBNIFBTVCAoNzo1MCBBTSBVVEMgbmV4dCBkYXkpXG4gICAgY29uc3Qgd2Vla2x5RGF0YUNvbGxlY3Rpb25SdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdXZWVrbHlEYXRhQ29sbGVjdGlvblJ1bGUnLCB7XG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmV4cHJlc3Npb24oJ2Nyb24oNTAgNyA/ICogU1VOICopJyksIC8vIDc6NTAgQU0gVVRDID0gMTE6NTAgUE0gUFNUIG9uIFN1bmRheXNcbiAgICAgIGRlc2NyaXB0aW9uOiBgV2Vla2x5IGRhdGEgY29sbGVjdGlvbiAoZXZlcnkgU3VuZGF5IGF0IDExOjUwIFBNIFBTVCkgZm9yICR7ZW52aXJvbm1lbnR9IGVudmlyb25tZW50YCxcbiAgICB9KTtcblxuICAgIC8vIEFkZCB0YXJnZXRzIHRvIHRoZSBmcmVxdWVudCBydWxlIChldmVyeSAzIGhvdXJzKVxuICAgIGZyZXF1ZW50RGF0YUNvbGxlY3Rpb25SdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihzdGFyR3Jvd3RoQ29sbGVjdG9yKSk7XG5cbiAgICAvLyBBZGQgdGFyZ2V0cyB0byB0aGUgZGFpbHkgcnVsZSAob25jZSBwZXIgZGF5KVxuICAgIGRhaWx5RGF0YUNvbGxlY3Rpb25SdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihwclZlbG9jaXR5Q29sbGVjdG9yKSk7XG4gICAgZGFpbHlEYXRhQ29sbGVjdGlvblJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKGlzc3VlSGVhbHRoQ29sbGVjdG9yKSk7XG5cbiAgICAvLyBBZGQgdGFyZ2V0cyB0byB0aGUgd2Vla2x5IHJ1bGUgKG9uY2UgcGVyIHdlZWspXG4gICAgd2Vla2x5RGF0YUNvbGxlY3Rpb25SdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihwYWNrYWdlRG93bmxvYWRzQ29sbGVjdG9yKSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheVxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ09wZW5Tb3VyY2VUcmFja2VyQVBJJywge1xuICAgICAgcmVzdEFwaU5hbWU6IGAke2Vudmlyb25tZW50fS1vcGVuLXNvdXJjZS10cmFja2VyLWFwaWAsXG4gICAgICBkZXNjcmlwdGlvbjogYEFQSSBmb3IgT3BlbiBTb3VyY2UgVHJhY2tlciAke2Vudmlyb25tZW50fSBlbnZpcm9ubWVudGAsXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ1gtQW16LURhdGUnLCAnQXV0aG9yaXphdGlvbicsICdYLUFwaS1LZXknXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSBJbnRlZ3JhdGlvblxuICAgIGNvbnN0IGFwaUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBpRnVuY3Rpb24pO1xuXG4gICAgLy8gQVBJIFJvdXRlc1xuICAgIGFwaS5yb290LmFkZFByb3h5KHtcbiAgICAgIGRlZmF1bHRJbnRlZ3JhdGlvbjogYXBpSW50ZWdyYXRpb24sXG4gICAgICBhbnlNZXRob2Q6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBTMyBCdWNrZXQgZm9yIEZyb250ZW5kXG4gICAgY29uc3QgZnJvbnRlbmRCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdGcm9udGVuZEJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGAke2Vudmlyb25tZW50fS1vcGVuLXNvdXJjZS10cmFja2VyLWZyb250ZW5kLSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICB3ZWJzaXRlSW5kZXhEb2N1bWVudDogJ2luZGV4Lmh0bWwnLFxuICAgICAgd2Vic2l0ZUVycm9yRG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IHRydWUsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUNMUyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGVudmlyb25tZW50ID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IGVudmlyb25tZW50ICE9PSAncHJvZCcsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwdWJsaWMgcmVhZCBhY2Nlc3MgdG8gdGhlIGJ1Y2tldFxuICAgIGZyb250ZW5kQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydzMzpHZXRPYmplY3QnXSxcbiAgICAgIHJlc291cmNlczogW2Zyb250ZW5kQnVja2V0LmFybkZvck9iamVjdHMoJyonKV0sXG4gICAgICBwcmluY2lwYWxzOiBbbmV3IGlhbS5BbnlQcmluY2lwYWwoKV0sXG4gICAgfSkpO1xuXG4gICAgLy8gVXNlIFMzT3JpZ2luIHdpdGggcHJvcGVyIGNvbmZpZ3VyYXRpb25cbiAgICBjb25zdCBzM09yaWdpbiA9IG5ldyBvcmlnaW5zLlMzT3JpZ2luKGZyb250ZW5kQnVja2V0KTtcblxuICAgIC8vIExhbWJkYUBFZGdlIGZ1bmN0aW9uIGZvciBkZXYgZW52aXJvbm1lbnQgYXV0aGVudGljYXRpb25cbiAgICBsZXQgYXV0aEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb24gfCB1bmRlZmluZWQ7XG4gICAgaWYgKGVudmlyb25tZW50ID09PSAnZGV2Jykge1xuICAgICAgYXV0aEZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXV0aEZ1bmN0aW9uJywge1xuICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgICAgaGFuZGxlcjogJ2F1dGgtZnVuY3Rpb24uaGFuZGxlcicsXG4gICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhLWVkZ2UnKSksXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDUpLFxuICAgICAgICBtZW1vcnlTaXplOiAxMjgsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBDbG91ZEZyb250IERpc3RyaWJ1dGlvblxuICAgIGNvbnN0IGRpc3RyaWJ1dGlvbiA9IG5ldyBjbG91ZGZyb250LkRpc3RyaWJ1dGlvbih0aGlzLCAnRnJvbnRlbmREaXN0cmlidXRpb24nLCB7XG4gICAgICBkZWZhdWx0QmVoYXZpb3I6IHtcbiAgICAgICAgb3JpZ2luOiBzM09yaWdpbixcbiAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgICAuLi4oZW52aXJvbm1lbnQgPT09ICdkZXYnICYmIGF1dGhGdW5jdGlvbiA/IHtcbiAgICAgICAgICBlZGdlTGFtYmRhczogW3tcbiAgICAgICAgICAgIGZ1bmN0aW9uVmVyc2lvbjogYXV0aEZ1bmN0aW9uLmN1cnJlbnRWZXJzaW9uLFxuICAgICAgICAgICAgZXZlbnRUeXBlOiBjbG91ZGZyb250LkxhbWJkYUVkZ2VFdmVudFR5cGUuVklFV0VSX1JFUVVFU1QsXG4gICAgICAgICAgfV0sXG4gICAgICAgIH0gOiB7fSksXG4gICAgICB9LFxuICAgICAgZXJyb3JSZXNwb25zZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwNCxcbiAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQVBJRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogYXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgZW5kcG9pbnQgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudmlyb25tZW50fS1hcGktZW5kcG9pbnRgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kVVJMJywge1xuICAgICAgdmFsdWU6IGRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7ZW52aXJvbm1lbnR9LWZyb250ZW5kLXVybGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRnJvbnRlbmRCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IGZyb250ZW5kQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBuYW1lIGZvciBmcm9udGVuZCcsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZpcm9ubWVudH0tZnJvbnRlbmQtYnVja2V0YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdHaXRIdWJUb2tlblNlY3JldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogZ2l0aHViVG9rZW5TZWNyZXQuc2VjcmV0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2l0SHViIHRva2VuIHNlY3JldCBuYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudmlyb25tZW50fS1naXRodWItdG9rZW4tc2VjcmV0YCxcbiAgICB9KTtcbiAgfVxufSAiXX0=