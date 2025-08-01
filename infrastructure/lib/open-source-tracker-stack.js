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
            // Reference existing tables for this environment
            starGrowthTable = dynamodb.Table.fromTableName(this, 'StarGrowthTable', `${tableSuffix}-star-growth`);
            prVelocityTable = dynamodb.Table.fromTableName(this, 'PRVelocityTable', `${tableSuffix}-pr-velocity`);
            issueHealthTable = dynamodb.Table.fromTableName(this, 'IssueHealthTable', `${tableSuffix}-issue-health`);
            packageDownloadsTable = dynamodb.Table.fromTableName(this, 'PackageDownloadsTable', `${tableSuffix}-package-downloads`);
        }
        // GitHub Token Secret
        let githubTokenSecret;
        if (useSharedDatabase && environment !== sharedDatabaseEnvironment) {
            // Reference existing secret from the shared environment
            githubTokenSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubTokenSecret', githubTokenSecretName);
        }
        else {
            // Reference existing secret for this environment
            githubTokenSecret = secretsmanager.Secret.fromSecretNameV2(this, 'GitHubTokenSecret', githubTokenSecretName);
        }
        // Staging Credentials Secret (only for staging environment)
        let devCredentialsSecret;
        if (environment === 'staging' && devCredentialsSecretName) {
            if (useSharedDatabase && environment !== sharedDatabaseEnvironment) {
                // Reference existing secret from the shared environment
                devCredentialsSecret = secretsmanager.Secret.fromSecretNameV2(this, 'StagingCredentialsSecret', devCredentialsSecretName);
            }
            else {
                // Reference existing secret for this environment
                devCredentialsSecret = secretsmanager.Secret.fromSecretNameV2(this, 'StagingCredentialsSecret', devCredentialsSecretName);
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
            handler: 'index.handler',
            code: lambda.Code.fromAsset('../backend'),
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
            handler: 'index.handler',
            code: lambda.Code.fromAsset('../backend'),
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
            handler: 'index.handler',
            code: lambda.Code.fromAsset('../backend'),
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
            handler: 'index.handler',
            code: lambda.Code.fromAsset('../backend'),
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
        // Star growth: using dataCollectionSchedule parameter
        const frequentDataCollectionRule = new events.Rule(this, 'FrequentDataCollectionRule', {
            schedule: events.Schedule.expression(dataCollectionSchedule),
            description: `Frequent data collection (${dataCollectionSchedule}) for ${environment} environment`,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3Blbi1zb3VyY2UtdHJhY2tlci1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9wZW4tc291cmNlLXRyYWNrZXItc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLGlEQUFpRDtBQUNqRCxxREFBcUQ7QUFDckQseUNBQXlDO0FBQ3pDLHlEQUF5RDtBQUN6RCw4REFBOEQ7QUFDOUQseURBQXlEO0FBQ3pELGlEQUFpRDtBQUNqRCwwREFBMEQ7QUFDMUQsMkNBQTJDO0FBQzNDLGlFQUFpRTtBQUNqRSw2Q0FBNkM7QUFDN0MsNkJBQTZCO0FBYTdCLE1BQWEsc0JBQXVCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDbkQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFrQztRQUMxRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxxQkFBcUIsRUFBRSx3QkFBd0IsRUFBRSxzQkFBc0IsRUFBRSxpQkFBaUIsR0FBRyxLQUFLLEVBQUUseUJBQXlCLEdBQUcsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRWxMLGtCQUFrQjtRQUNsQixNQUFNLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQztRQUVoRiw2RUFBNkU7UUFDN0UsSUFBSSxlQUFnQyxDQUFDO1FBQ3JDLElBQUksZUFBZ0MsQ0FBQztRQUNyQyxJQUFJLGdCQUFpQyxDQUFDO1FBQ3RDLElBQUkscUJBQXNDLENBQUM7UUFFM0MsSUFBSSxpQkFBaUIsSUFBSSxXQUFXLEtBQUsseUJBQXlCLEVBQUUsQ0FBQztZQUNuRSx3REFBd0Q7WUFDeEQsZUFBZSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRSxHQUFHLFdBQVcsY0FBYyxD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QyxzQkFBc0I7WUFDMUMsV0FBVyxFQUFFLDZCQUE2QjtZQUMxQyxVQUFVLEVBQUUsR0FBRyxXQUFXLGVBQWU7U0FDMUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUM1QyxLQUFLLEVBQUUsY0FBYyxDQUFDLFVBQVU7WUFDaEMsV0FBVyxFQUFFLDZCQUE2QjtZQUMxQyxVQUFVLEVBQUUsR0FBRyxXQUFXLGtCQUFrQjtTQUM3QyxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLHVCQUF1QixFQUFFO1lBQy9DLEtBQUssRUFBRSxpQkFBaUIsQ0FBQyxVQUFVO1lBQ25DLFdBQVcsRUFBRSwwQkFBMEI7WUFDdkMsVUFBVSxFQUFFLEdBQUcsV0FBVyxzQkFBc0I7U0FDakQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBalNELHdEQWlTQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBkeW5hbW9kYiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGInO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCAqIGFzIGNsb3VkZnJvbnQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQnO1xuaW1wb3J0ICogYXMgb3JpZ2lucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udC1vcmlnaW5zJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCAqIGFzIGxvZ3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxvZ3MnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIE9wZW5Tb3VyY2VUcmFja2VyU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgZG9tYWluTmFtZT86IHN0cmluZztcbiAgZ2l0aHViVG9rZW5TZWNyZXROYW1lOiBzdHJpbmc7XG4gIGRldkNyZWRlbnRpYWxzU2VjcmV0TmFtZT86IHN0cmluZztcbiAgZGF0YUNvbGxlY3Rpb25TY2hlZHVsZTogc3RyaW5nO1xuICB1c2VTaGFyZWREYXRhYmFzZT86IGJvb2xlYW47XG4gIHNoYXJlZERhdGFiYXNlRW52aXJvbm1lbnQ/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBPcGVuU291cmNlVHJhY2tlclN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE9wZW5Tb3VyY2VUcmFja2VyU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBlbnZpcm9ubWVudCwgZG9tYWluTmFtZSwgZ2l0aHViVG9rZW5TZWNyZXROYW1lLCBkZXZDcmVkZW50aWFsc1NlY3JldE5hbWUsIGRhdGFDb2xsZWN0aW9uU2NoZWR1bGUsIHVzZVNoYXJlZERhdGFiYXNlID0gZmFsc2UsIHNoYXJlZERhdGFiYXNlRW52aXJvbm1lbnQgPSAncHJvZCcgfSA9IHByb3BzO1xuXG4gICAgLy8gRHluYW1vREIgVGFibGVzXG4gICAgY29uc3QgdGFibGVTdWZmaXggPSB1c2VTaGFyZWREYXRhYmFzZSA/IHNoYXJlZERhdGFiYXNlRW52aXJvbm1lbnQgOiBlbnZpcm9ubWVudDtcbiAgICBcbiAgICAvLyBDcmVhdGUgb3IgcmVmZXJlbmNlIER5bmFtb0RCIHRhYmxlcyBiYXNlZCBvbiBzaGFyZWQgZGF0YWJhc2UgY29uZmlndXJhdGlvblxuICAgIGxldCBzdGFyR3Jvd3RoVGFibGU6IGR5bmFtb2RiLklUYWJsZTtcbiAgICBsZXQgcHJWZWxvY2l0eVRhYmxlOiBkeW5hbW9kYi5JVGFibGU7XG4gICAgbGV0IGlzc3VlSGVhbHRoVGFibGU6IGR5bmFtb2RiLklUYWJsZTtcbiAgICBsZXQgcGFja2FnZURvd25sb2Fkc1RhYmxlOiBkeW5hbW9kYi5JVGFibGU7XG5cbiAgICBpZiAodXNlU2hhcmVkRGF0YWJhc2UgJiYgZW52aXJvbm1lbnQgIT09IHNoYXJlZERhdGFiYXNlRW52aXJvbm1lbnQpIHtcbiAgICAgIC8vIFJlZmVyZW5jZSBleGlzdGluZyB0YWJsZXMgZnJvbSB0aGUgc2hhcmVkIGVudmlyb25tZW50XG4gICAgICBzdGFyR3Jvd3RoVGFibGUgPSBkeW5hbW9kYi5UYWJsZS5mcm9tVGFibGVOYW1lKHRoaXMsICdTdGFyR3Jvd3RoVGFibGUnLCBgJHt0YWJsZVN1ZmZpeH0tc3Rhci1ncm93dGhgKTtcbiAgICAgIHByVmVsb2NpdHlUYWJsZSA9IGR5bmFtb2RiLlRhYmxlLmZyb21UYWJsZU5hbWUodGhpcywgJ1BSVmVsb2NpdHlUYWJsZScsIGAke3RhYmxlU3VmZml4fS1wci12ZWxvY2l0eWApO1xuICAgICAgaXNzdWVIZWFsdGhUYWJsZSA9IGR5bmFtb2RiLlRhYmxlLmZyb21UYWJsZU5hbWUodGhpcywgJ0lzc3VlSGVhbHRoVGFibGUnLCBgJHt0YWJsZVN1ZmZpeH0taXNzdWUtaGVhbHRoYCk7XG4gICAgICBwYWNrYWdlRG93bmxvYWRzVGFibGUgPSBkeW5hbW9kYi5UYWJsZS5mcm9tVGFibGVOYW1lKHRoaXMsICdQYWNrYWdlRG93bmxvYWRzVGFibGUnLCBgJHt0YWJsZVN1ZmZpeH0tcGFja2FnZS1kb3dubG9hZHNgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gUmVmZXJlbmNlIGV4aXN0aW5nIHRhYmxlcyBmb3IgdGhpcyBlbnZpcm9ubWVudFxuICAgICAgc3Rhckdyb3d0aFRhYmxlID0gZHluYW1vZGIuVGFibGUuZnJvbVRhYmxlTmFtZSh0aGlzLCAnU3Rhckdyb3d0aFRhYmxlJywgYCR7dGFibGVTdWZmaXh9LXN0YXItZ3Jvd3RoYCk7XG4gICAgICBwclZlbG9jaXR5VGFibGUgPSBkeW5hbW9kYi5UYWJsZS5mcm9tVGFibGVOYW1lKHRoaXMsICdQUlZlbG9jaXR5VGFibGUnLCBgJHt0YWJsZVN1ZmZpeH0tcHItdmVsb2NpdHlgKTtcbiAgICAgIGlzc3VlSGVhbHRoVGFibGUgPSBkeW5hbW9kYi5UYWJsZS5mcm9tVGFibGVOYW1lKHRoaXMsICdJc3N1ZUhlYWx0aFRhYmxlJywgYCR7dGFibGVTdWZmaXh9LWlzc3VlLWhlYWx0aGApO1xuICAgICAgcGFja2FnZURvd25sb2Fkc1RhYmxlID0gZHluYW1vZGIuVGFibGUuZnJvbVRhYmxlTmFtZSh0aGlzLCAnUGFja2FnZURvd25sb2Fkc1RhYmxlJywgYCR7dGFibGVTdWZmaXh9LXBhY2thZ2UtZG93bmxvYWRzYCk7XG4gICAgfVxuXG4gICAgLy8gR2l0SHViIFRva2VuIFNlY3JldFxuICAgIGxldCBnaXRodWJUb2tlblNlY3JldDogc2VjcmV0c21hbmFnZXIuSVNlY3JldDtcbiAgICBpZiAodXNlU2hhcmVkRGF0YWJhc2UgJiYgZW52aXJvbm1lbnQgIT09IHNoYXJlZERhdGFiYXNlRW52aXJvbm1lbnQpIHtcbiAgICAgIC8vIFJlZmVyZW5jZSBleGlzdGluZyBzZWNyZXQgZnJvbSB0aGUgc2hhcmVkIGVudmlyb25tZW50XG4gICAgICBnaXRodWJUb2tlblNlY3JldCA9IHNlY3JldHNtYW5hZ2VyLlNlY3JldC5mcm9tU2VjcmV0TmFtZVYyKHRoaXMsICdHaXRIdWJUb2tlblNlY3JldCcsIGdpdGh1YlRva2VuU2VjcmV0TmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFJlZmVyZW5jZSBleGlzdGluZyBzZWNyZXQgZm9yIHRoaXMgZW52aXJvbm1lbnRcbiAgICAgIGdpdGh1YlRva2VuU2VjcmV0ID0gc2VjcmV0c21hbmFnZXIuU2VjcmV0LmZyb21TZWNyZXROYW1lVjIodGhpcywgJ0dpdEh1YlRva2VuU2VjcmV0JywgZ2l0aHViVG9rZW5TZWNyZXROYW1lKTtcbiAgICB9XG5cbiAgICAvLyBTdGFnaW5nIENyZWRlbnRpYWxzIFNlY3JldCAob25seSBmb3Igc3RhZ2luZyBlbnZpcm9ubWVudClcbiAgICBsZXQgZGV2Q3JlZGVudGlhbHNTZWNyZXQ6IHNlY3JldHNtYW5hZ2VyLklTZWNyZXQgfCB1bmRlZmluZWQ7XG4gICAgaWYgKGVudmlyb25tZW50ID09PSAnc3RhZ2luZycgJiYgZGV2Q3JlZGVudGlhbHNTZWNyZXROYW1lKSB7XG4gICAgICBpZiAodXNlU2hhcmVkRGF0YWJhc2UgJiYgZW52aXJvbm1lbnQgIT09IHNoYXJlZERhdGFiYXNlRW52aXJvbm1lbnQpIHtcbiAgICAgICAgLy8gUmVmZXJlbmNlIGV4aXN0aW5nIHNlY3JldCBmcm9tIHRoZSBzaGFyZWQgZW52aXJvbm1lbnRcbiAgICAgICAgZGV2Q3JlZGVudGlhbHNTZWNyZXQgPSBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMih0aGlzLCAnU3RhZ2luZ0NyZWRlbnRpYWxzU2VjcmV0JywgZGV2Q3JlZGVudGlhbHNTZWNyZXROYW1lKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFJlZmVyZW5jZSBleGlzdGluZyBzZWNyZXQgZm9yIHRoaXMgZW52aXJvbm1lbnRcbiAgICAgICAgZGV2Q3JlZGVudGlhbHNTZWNyZXQgPSBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMih0aGlzLCAnU3RhZ2luZ0NyZWRlbnRpYWxzU2VjcmV0JywgZGV2Q3JlZGVudGlhbHNTZWNyZXROYW1lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBMYW1iZGEgTGF5ZXIgZm9yIHNoYXJlZCBkZXBlbmRlbmNpZXNcbiAgICBjb25zdCBzaGFyZWRMYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdTaGFyZWRMYXllcicsIHtcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnbGFtYmRhLWxheWVyJyksXG4gICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWF0sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NoYXJlZCBkZXBlbmRlbmNpZXMgZm9yIE9wZW4gU291cmNlIFRyYWNrZXIgTGFtYmRhIGZ1bmN0aW9ucycsXG4gICAgICBsYXllclZlcnNpb25OYW1lOiBgJHtlbnZpcm9ubWVudH0tc2hhcmVkLWxheWVyYCxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBMYW1iZGEgRnVuY3Rpb25cbiAgICBjb25zdCBhcGlGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0FQSUZ1bmN0aW9uJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnbGFtYmRhLWluZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kJyksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBFTlZJUk9OTUVOVDogZW52aXJvbm1lbnQsXG4gICAgICAgIFNUQVJfR1JPV1RIX1RBQkxFOiBzdGFyR3Jvd3RoVGFibGUudGFibGVOYW1lLFxuICAgICAgICBQUl9WRUxPQ0lUWV9UQUJMRTogcHJWZWxvY2l0eVRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgSVNTVUVfSEVBTFRIX1RBQkxFOiBpc3N1ZUhlYWx0aFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgUEFDS0FHRV9ET1dOTE9BRFNfVEFCTEU6IHBhY2thZ2VEb3dubG9hZHNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEdJVEhVQl9UT0tFTl9TRUNSRVRfTkFNRTogZ2l0aHViVG9rZW5TZWNyZXROYW1lLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIGxheWVyczogW3NoYXJlZExheWVyXSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gTGFtYmRhXG4gICAgc3Rhckdyb3d0aFRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhcGlGdW5jdGlvbik7XG4gICAgcHJWZWxvY2l0eVRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhcGlGdW5jdGlvbik7XG4gICAgaXNzdWVIZWFsdGhUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXBpRnVuY3Rpb24pO1xuICAgIHBhY2thZ2VEb3dubG9hZHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEoYXBpRnVuY3Rpb24pO1xuICAgIGdpdGh1YlRva2VuU2VjcmV0LmdyYW50UmVhZChhcGlGdW5jdGlvbik7XG5cbiAgICAvLyBEYXRhIENvbGxlY3Rpb24gTGFtYmRhIEZ1bmN0aW9uc1xuICAgIGNvbnN0IHN0YXJHcm93dGhDb2xsZWN0b3IgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTdGFyR3Jvd3RoQ29sbGVjdG9yJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQnKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEVOVklST05NRU5UOiBlbnZpcm9ubWVudCxcbiAgICAgICAgU1RBUl9HUk9XVEhfVEFCTEU6IHN0YXJHcm93dGhUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEdJVEhVQl9UT0tFTl9TRUNSRVRfTkFNRTogZ2l0aHViVG9rZW5TZWNyZXROYW1lLFxuICAgICAgICBSRVBPOiAncHJvbXB0Zm9vL3Byb21wdGZvbycsXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgbGF5ZXJzOiBbc2hhcmVkTGF5ZXJdLFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICBjb25zdCBwclZlbG9jaXR5Q29sbGVjdG9yID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUFJWZWxvY2l0eUNvbGxlY3RvcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kJyksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBFTlZJUk9OTUVOVDogZW52aXJvbm1lbnQsXG4gICAgICAgIFBSX1ZFTE9DSVRZX1RBQkxFOiBwclZlbG9jaXR5VGFibGUudGFibGVOYW1lLFxuICAgICAgICBHSVRIVUJfVE9LRU5fU0VDUkVUX05BTUU6IGdpdGh1YlRva2VuU2VjcmV0TmFtZSxcbiAgICAgICAgUkVQTzogJ3Byb21wdGZvby9wcm9tcHRmb28nLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGxheWVyczogW3NoYXJlZExheWVyXSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgY29uc3QgaXNzdWVIZWFsdGhDb2xsZWN0b3IgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdJc3N1ZUhlYWx0aENvbGxlY3RvcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kJyksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBFTlZJUk9OTUVOVDogZW52aXJvbm1lbnQsXG4gICAgICAgIElTU1VFX0hFQUxUSF9UQUJMRTogaXNzdWVIZWFsdGhUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEdJVEhVQl9UT0tFTl9TRUNSRVRfTkFNRTogZ2l0aHViVG9rZW5TZWNyZXROYW1lLFxuICAgICAgICBSRVBPOiAncHJvbXB0Zm9vL3Byb21wdGZvbycsXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgICAgbGF5ZXJzOiBbc2hhcmVkTGF5ZXJdLFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICBjb25zdCBwYWNrYWdlRG93bmxvYWRzQ29sbGVjdG9yID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnUGFja2FnZURvd25sb2Fkc0NvbGxlY3RvcicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi9iYWNrZW5kJyksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBFTlZJUk9OTUVOVDogZW52aXJvbm1lbnQsXG4gICAgICAgIFBBQ0tBR0VfRE9XTkxPQURTX1RBQkxFOiBwYWNrYWdlRG93bmxvYWRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBHSVRIVUJfVE9LRU5fU0VDUkVUX05BTUU6IGdpdGh1YlRva2VuU2VjcmV0TmFtZSxcbiAgICAgICAgUkVQTzogJ3Byb21wdGZvby9wcm9tcHRmb28nLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDI1NixcbiAgICAgIGxheWVyczogW3NoYXJlZExheWVyXSxcbiAgICAgIGxvZ1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9XRUVLLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgcGVybWlzc2lvbnMgdG8gY29sbGVjdG9yc1xuICAgIHN0YXJHcm93dGhUYWJsZS5ncmFudFdyaXRlRGF0YShzdGFyR3Jvd3RoQ29sbGVjdG9yKTtcbiAgICBwclZlbG9jaXR5VGFibGUuZ3JhbnRXcml0ZURhdGEocHJWZWxvY2l0eUNvbGxlY3Rvcik7XG4gICAgaXNzdWVIZWFsdGhUYWJsZS5ncmFudFdyaXRlRGF0YShpc3N1ZUhlYWx0aENvbGxlY3Rvcik7XG4gICAgcGFja2FnZURvd25sb2Fkc1RhYmxlLmdyYW50V3JpdGVEYXRhKHBhY2thZ2VEb3dubG9hZHNDb2xsZWN0b3IpO1xuICAgIGdpdGh1YlRva2VuU2VjcmV0LmdyYW50UmVhZChzdGFyR3Jvd3RoQ29sbGVjdG9yKTtcbiAgICBnaXRodWJUb2tlblNlY3JldC5ncmFudFJlYWQocHJWZWxvY2l0eUNvbGxlY3Rvcik7XG4gICAgZ2l0aHViVG9rZW5TZWNyZXQuZ3JhbnRSZWFkKGlzc3VlSGVhbHRoQ29sbGVjdG9yKTtcbiAgICBnaXRodWJUb2tlblNlY3JldC5ncmFudFJlYWQocGFja2FnZURvd25sb2Fkc0NvbGxlY3Rvcik7XG5cbiAgICAvLyBFdmVudEJyaWRnZSBSdWxlcyBmb3Igc2NoZWR1bGVkIGRhdGEgY29sbGVjdGlvblxuICAgIC8vIFN0YXIgZ3Jvd3RoOiB1c2luZyBkYXRhQ29sbGVjdGlvblNjaGVkdWxlIHBhcmFtZXRlclxuICAgIGNvbnN0IGZyZXF1ZW50RGF0YUNvbGxlY3Rpb25SdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdGcmVxdWVudERhdGFDb2xsZWN0aW9uUnVsZScsIHtcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuZXhwcmVzc2lvbihkYXRhQ29sbGVjdGlvblNjaGVkdWxlKSxcbiAgICAgIGRlc2NyaXB0aW9uOiBgRnJlcXVlbnQgZGF0YSBjb2xsZWN0aW9uICgke2RhdGFDb2xsZWN0aW9uU2NoZWR1bGV9KSBmb3IgJHtlbnZpcm9ubWVudH0gZW52aXJvbm1lbnRgLFxuICAgIH0pO1xuXG4gICAgLy8gUFIgdmVsb2NpdHkgYW5kIGlzc3VlIGhlYWx0aDogb25jZSBkYWlseSBhdCAxMTo1MCBQTSBQU1QgKDc6NTAgQU0gVVRDIG5leHQgZGF5KVxuICAgIGNvbnN0IGRhaWx5RGF0YUNvbGxlY3Rpb25SdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdEYWlseURhdGFDb2xsZWN0aW9uUnVsZScsIHtcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuZXhwcmVzc2lvbignY3Jvbig1MCA3ICogKiA/ICopJyksIC8vIDc6NTAgQU0gVVRDID0gMTE6NTAgUE0gUFNUXG4gICAgICBkZXNjcmlwdGlvbjogYERhaWx5IGRhdGEgY29sbGVjdGlvbiAoMTE6NTAgUE0gUFNUKSBmb3IgJHtlbnZpcm9ubWVudH0gZW52aXJvbm1lbnRgLFxuICAgIH0pO1xuXG4gICAgLy8gUGFja2FnZSBkb3dubG9hZHM6IG9uY2UgZXZlcnkgNyBkYXlzIHN0YXJ0aW5nIG9uIHRoZSAyOXRoIGF0IDExOjUwIFBNIFBTVCAoNzo1MCBBTSBVVEMgbmV4dCBkYXkpXG4gICAgY29uc3Qgd2Vla2x5RGF0YUNvbGxlY3Rpb25SdWxlID0gbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdXZWVrbHlEYXRhQ29sbGVjdGlvblJ1bGUnLCB7XG4gICAgICBzY2hlZHVsZTogZXZlbnRzLlNjaGVkdWxlLmV4cHJlc3Npb24oJ2Nyb24oNTAgNyA/ICogU1VOICopJyksIC8vIDc6NTAgQU0gVVRDID0gMTE6NTAgUE0gUFNUIG9uIFN1bmRheXNcbiAgICAgIGRlc2NyaXB0aW9uOiBgV2Vla2x5IGRhdGEgY29sbGVjdGlvbiAoZXZlcnkgU3VuZGF5IGF0IDExOjUwIFBNIFBTVCkgZm9yICR7ZW52aXJvbm1lbnR9IGVudmlyb25tZW50YCxcbiAgICB9KTtcblxuICAgIC8vIEFkZCB0YXJnZXRzIHRvIHRoZSBmcmVxdWVudCBydWxlIChldmVyeSAzIGhvdXJzKVxuICAgIGZyZXF1ZW50RGF0YUNvbGxlY3Rpb25SdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihzdGFyR3Jvd3RoQ29sbGVjdG9yKSk7XG5cbiAgICAvLyBBZGQgdGFyZ2V0cyB0byB0aGUgZGFpbHkgcnVsZSAob25jZSBwZXIgZGF5KVxuICAgIGRhaWx5RGF0YUNvbGxlY3Rpb25SdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihwclZlbG9jaXR5Q29sbGVjdG9yKSk7XG4gICAgZGFpbHlEYXRhQ29sbGVjdGlvblJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKGlzc3VlSGVhbHRoQ29sbGVjdG9yKSk7XG5cbiAgICAvLyBBZGQgdGFyZ2V0cyB0byB0aGUgd2Vla2x5IHJ1bGUgKG9uY2UgcGVyIHdlZWspXG4gICAgd2Vla2x5RGF0YUNvbGxlY3Rpb25SdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbihwYWNrYWdlRG93bmxvYWRzQ29sbGVjdG9yKSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheVxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ09wZW5Tb3VyY2VUcmFja2VyQVBJJywge1xuICAgICAgcmVzdEFwaU5hbWU6IGAke2Vudmlyb25tZW50fS1vcGVuLXNvdXJjZS10cmFja2VyLWFwaWAsXG4gICAgICBkZXNjcmlwdGlvbjogYEFQSSBmb3IgT3BlbiBTb3VyY2UgVHJhY2tlciAke2Vudmlyb25tZW50fSBlbnZpcm9ubWVudGAsXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ1gtQW16LURhdGUnLCAnQXV0aG9yaXphdGlvbicsICdYLUFwaS1LZXknXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgR2F0ZXdheSBJbnRlZ3JhdGlvblxuICAgIGNvbnN0IGFwaUludGVncmF0aW9uID0gbmV3IGFwaWdhdGV3YXkuTGFtYmRhSW50ZWdyYXRpb24oYXBpRnVuY3Rpb24pO1xuXG4gICAgLy8gQVBJIFJvdXRlc1xuICAgIGFwaS5yb290LmFkZFByb3h5KHtcbiAgICAgIGRlZmF1bHRJbnRlZ3JhdGlvbjogYXBpSW50ZWdyYXRpb24sXG4gICAgICBhbnlNZXRob2Q6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBTMyBCdWNrZXQgZm9yIEZyb250ZW5kXG4gICAgY29uc3QgZnJvbnRlbmRCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdGcm9udGVuZEJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGAke2Vudmlyb25tZW50fS1vcGVuLXNvdXJjZS10cmFja2VyLWZyb250ZW5kLSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICB3ZWJzaXRlSW5kZXhEb2N1bWVudDogJ2luZGV4Lmh0bWwnLFxuICAgICAgd2Vic2l0ZUVycm9yRG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IHRydWUsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUNMUyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGVudmlyb25tZW50ID09PSAncHJvZCcgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4gOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IGVudmlyb25tZW50ICE9PSAncHJvZCcsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwdWJsaWMgcmVhZCBhY2Nlc3MgdG8gdGhlIGJ1Y2tldFxuICAgIGZyb250ZW5kQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydzMzpHZXRPYmplY3QnXSxcbiAgICAgIHJlc291cmNlczogW2Zyb250ZW5kQnVja2V0LmFybkZvck9iamVjdHMoJyonKV0sXG4gICAgICBwcmluY2lwYWxzOiBbbmV3IGlhbS5BbnlQcmluY2lwYWwoKV0sXG4gICAgfSkpO1xuXG4gICAgLy8gVXNlIFMzT3JpZ2luIHdpdGggcHJvcGVyIGNvbmZpZ3VyYXRpb25cbiAgICBjb25zdCBzM09yaWdpbiA9IG5ldyBvcmlnaW5zLlMzT3JpZ2luKGZyb250ZW5kQnVja2V0KTtcblxuICAgIC8vIExhbWJkYUBFZGdlIGZ1bmN0aW9uIGZvciBzdGFnaW5nIGVudmlyb25tZW50IGF1dGhlbnRpY2F0aW9uXG4gICAgbGV0IGF1dGhGdW5jdGlvbjogbGFtYmRhLkZ1bmN0aW9uIHwgdW5kZWZpbmVkO1xuICAgIGlmIChlbnZpcm9ubWVudCA9PT0gJ3N0YWdpbmcnKSB7XG4gICAgICBhdXRoRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBdXRoRnVuY3Rpb24nLCB7XG4gICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgICBoYW5kbGVyOiAnYXV0aC1mdW5jdGlvbi5oYW5kbGVyJyxcbiAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9sYW1iZGEtZWRnZScpKSxcbiAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNSksXG4gICAgICAgIG1lbW9yeVNpemU6IDEyOCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIENsb3VkRnJvbnQgRGlzdHJpYnV0aW9uXG4gICAgY29uc3QgZGlzdHJpYnV0aW9uID0gbmV3IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uKHRoaXMsICdGcm9udGVuZERpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IHMzT3JpZ2luLFxuICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19PUFRJTUlaRUQsXG4gICAgICAgIC4uLihlbnZpcm9ubWVudCA9PT0gJ3N0YWdpbmcnICYmIGF1dGhGdW5jdGlvbiA/IHtcbiAgICAgICAgICBlZGdlTGFtYmRhczogW3tcbiAgICAgICAgICAgIGZ1bmN0aW9uVmVyc2lvbjogYXV0aEZ1bmN0aW9uLmN1cnJlbnRWZXJzaW9uLFxuICAgICAgICAgICAgZXZlbnRUeXBlOiBjbG91ZGZyb250LkxhbWJkYUVkZ2VFdmVudFR5cGUuVklFV0VSX1JFUVVFU1QsXG4gICAgICAgICAgfV0sXG4gICAgICAgIH0gOiB7fSksXG4gICAgICB9LFxuICAgICAgZXJyb3JSZXNwb25zZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGh0dHBTdGF0dXM6IDQwNCxcbiAgICAgICAgICByZXNwb25zZUh0dHBTdGF0dXM6IDIwMCxcbiAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiAnL2luZGV4Lmh0bWwnLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQVBJRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogYXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgZW5kcG9pbnQgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudmlyb25tZW50fS1hcGktZW5kcG9pbnRgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kVVJMJywge1xuICAgICAgdmFsdWU6IGRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IGRpc3RyaWJ1dGlvbiBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7ZW52aXJvbm1lbnR9LWZyb250ZW5kLXVybGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRnJvbnRlbmRCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IGZyb250ZW5kQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIGJ1Y2tldCBuYW1lIGZvciBmcm9udGVuZCcsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZpcm9ubWVudH0tZnJvbnRlbmQtYnVja2V0YCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdHaXRIdWJUb2tlblNlY3JldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogZ2l0aHViVG9rZW5TZWNyZXQuc2VjcmV0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnR2l0SHViIHRva2VuIHNlY3JldCBuYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudmlyb25tZW50fS1naXRodWItdG9rZW4tc2VjcmV0YCxcbiAgICB9KTtcbiAgfVxufSAiXX0=