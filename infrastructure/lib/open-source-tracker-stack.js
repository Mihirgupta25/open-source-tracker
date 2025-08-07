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
        let repositoriesTable;
        if (useSharedDatabase && environment !== sharedDatabaseEnvironment) {
            // Reference existing tables from the shared environment
            starGrowthTable = dynamodb.Table.fromTableName(this, 'StarGrowthTable', `${tableSuffix}-star-growth`);
            prVelocityTable = dynamodb.Table.fromTableName(this, 'PRVelocityTable', `${tableSuffix}-pr-velocity`);
            issueHealthTable = dynamodb.Table.fromTableName(this, 'IssueHealthTable', `${tableSuffix}-issue-health`);
            packageDownloadsTable = dynamodb.Table.fromTableName(this, 'PackageDownloadsTable', `${tableSuffix}-package-downloads`);
            repositoriesTable = dynamodb.Table.fromTableName(this, 'RepositoriesTable', `${tableSuffix}-repositories`);
        }
        else {
            // Reference existing tables for this environment
            starGrowthTable = dynamodb.Table.fromTableName(this, 'StarGrowthTable', `${tableSuffix}-star-growth`);
            prVelocityTable = dynamodb.Table.fromTableName(this, 'PRVelocityTable', `${tableSuffix}-pr-velocity`);
            issueHealthTable = dynamodb.Table.fromTableName(this, 'IssueHealthTable', `${tableSuffix}-issue-health`);
            packageDownloadsTable = dynamodb.Table.fromTableName(this, 'PackageDownloadsTable', `${tableSuffix}-package-downloads`);
            repositoriesTable = dynamodb.Table.fromTableName(this, 'RepositoriesTable', `${tableSuffix}-repositories`);
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
                REPOSITORIES_TABLE: repositoriesTable.tableName,
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
        repositoriesTable.grantReadData(apiFunction);
        githubTokenSecret.grantRead(apiFunction);
        // Unified Data Collection Lambda Function (replaces individual collectors)
        const unifiedCollector = new lambda.Function(this, 'UnifiedCollector', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset('../backend'),
            environment: {
                ENVIRONMENT: environment,
                STAR_GROWTH_TABLE: starGrowthTable.tableName,
                PR_VELOCITY_TABLE: prVelocityTable.tableName,
                ISSUE_HEALTH_TABLE: issueHealthTable.tableName,
                PACKAGE_DOWNLOADS_TABLE: packageDownloadsTable.tableName,
                REPOSITORIES_TABLE: repositoriesTable.tableName,
                GITHUB_TOKEN_SECRET_NAME: githubTokenSecretName,
            },
            timeout: cdk.Duration.seconds(300), // 5 minutes for unified collection
            memorySize: 512,
            layers: [sharedLayer],
            logRetention: logs.RetentionDays.ONE_WEEK,
        });
        // Grant permissions to unified collector
        starGrowthTable.grantWriteData(unifiedCollector);
        prVelocityTable.grantWriteData(unifiedCollector);
        issueHealthTable.grantWriteData(unifiedCollector);
        packageDownloadsTable.grantWriteData(unifiedCollector);
        repositoriesTable.grantReadData(unifiedCollector);
        githubTokenSecret.grantRead(unifiedCollector);
        // EventBridge Rules for scheduled data collection
        // Star growth: using dataCollectionSchedule parameter
        const frequentDataCollectionRule = new events.Rule(this, 'FrequentDataCollectionRule', {
            schedule: events.Schedule.expression(dataCollectionSchedule),
            description: `Frequent data collection (${dataCollectionSchedule}) for ${environment} environment`,
        });
        // Daily collection: PR velocity and issue health at 11:50 PM PST (7:50 AM UTC next day)
        const dailyDataCollectionRule = new events.Rule(this, 'DailyDataCollectionRule', {
            schedule: events.Schedule.expression('cron(50 7 * * ? *)'), // 7:50 AM UTC = 11:50 PM PST
            description: `Daily collection: Star Growth, PR Velocity & Issue Health data (11:50 PM PST) for ${environment} environment`,
        });
        // Weekly collection: Package downloads every Sunday at 11:50 PM PST (7:50 AM UTC next day)
        const weeklyDataCollectionRule = new events.Rule(this, 'WeeklyDataCollectionRule', {
            schedule: events.Schedule.expression('cron(50 7 ? * SUN *)'), // 7:50 AM UTC = 11:50 PM PST on Sundays
            description: `Weekly collection: Package Downloads data (every Sunday at 11:50 PM PST) for ${environment} environment`,
        });
        // Add targets to the rules
        frequentDataCollectionRule.addTarget(new targets.LambdaFunction(unifiedCollector));
        dailyDataCollectionRule.addTarget(new targets.LambdaFunction(unifiedCollector));
        weeklyDataCollectionRule.addTarget(new targets.LambdaFunction(unifiedCollector));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3Blbi1zb3VyY2UtdHJhY2tlci1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm9wZW4tc291cmNlLXRyYWNrZXItc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLGlEQUFpRDtBQUNqRCxxREFBcUQ7QUFDckQseUNBQXlDO0FBQ3pDLHlEQUF5RDtBQUN6RCw4REFBOEQ7QUFDOUQseURBQXlEO0FBQ3pELGlEQUFpRDtBQUNqRCwwREFBMEQ7QUFDMUQsMkNBQTJDO0FBQzNDLGlFQUFpRTtBQUNqRSw2Q0FBNkM7QUFDN0MsNkJBQTZCO0FBYTdCLE1BQWEsc0JBQXVCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDbkQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFrQztRQUMxRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsV0FBVyxFQUFFLFVBQVUsRUFBRSxxQkFBcUIsRUFBRSx3QkFBd0IsRUFBRSxzQkFBc0IsRUFBRSxpQkFBaUIsR0FBRyxLQUFLLEVBQUUseUJBQXlCLEdBQUcsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBRWxMLGtCQUFrQjtRQUNsQixNQUFNLFdBQVcsR0FBRyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQztRQUVoRiw2RUFBNkU7UUFDN0UsSUFBSSxlQUFnQyxDQUFDO1FBQ3JDLElBQUksZUFBZ0MsQ0FBQztRQUNyQyxJQUFJLGdCQUFpQyxDQUFDO1FBQ3RDLElBQUkscUJBQXNDLENBQUM7UUFDM0MsSUFBSSxpQkFBa0MsQ0FBQztRQUV2QyxJQUFJLGlCQUFpQixJQUFJLFdBQVcsS0FBSyx5QkFBeUIsRUFBRSxDQUFDO1lBQ25FLHdEQUF3RDtZQUN4RCxlQUFlLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLGlCQUFp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QUFpQixDQUFDLFVBQVU7WUFDbkMsV0FBVyxFQUFFLDBCQUEwQjtZQUN2QyxVQUFVLEVBQUUsR0FBRyxXQUFXLHNCQUFzQjtTQUNqRCxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFsUEQsd0RBa1BDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gJ2F3cy1jZGstbGliL2F3cy1keW5hbW9kYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgYXBpZ2F0ZXdheSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheSc7XG5pbXBvcnQgKiBhcyBldmVudHMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWV2ZW50cyc7XG5pbXBvcnQgKiBhcyB0YXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMtdGFyZ2V0cyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBzZWNyZXRzbWFuYWdlciBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXInO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgT3BlblNvdXJjZVRyYWNrZXJTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICBkb21haW5OYW1lPzogc3RyaW5nO1xuICBnaXRodWJUb2tlblNlY3JldE5hbWU6IHN0cmluZztcbiAgZGV2Q3JlZGVudGlhbHNTZWNyZXROYW1lPzogc3RyaW5nO1xuICBkYXRhQ29sbGVjdGlvblNjaGVkdWxlOiBzdHJpbmc7XG4gIHVzZVNoYXJlZERhdGFiYXNlPzogYm9vbGVhbjtcbiAgc2hhcmVkRGF0YWJhc2VFbnZpcm9ubWVudD86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIE9wZW5Tb3VyY2VUcmFja2VyU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogT3BlblNvdXJjZVRyYWNrZXJTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7IGVudmlyb25tZW50LCBkb21haW5OYW1lLCBnaXRodWJUb2tlblNlY3JldE5hbWUsIGRldkNyZWRlbnRpYWxzU2VjcmV0TmFtZSwgZGF0YUNvbGxlY3Rpb25TY2hlZHVsZSwgdXNlU2hhcmVkRGF0YWJhc2UgPSBmYWxzZSwgc2hhcmVkRGF0YWJhc2VFbnZpcm9ubWVudCA9ICdwcm9kJyB9ID0gcHJvcHM7XG5cbiAgICAvLyBEeW5hbW9EQiBUYWJsZXNcbiAgICBjb25zdCB0YWJsZVN1ZmZpeCA9IHVzZVNoYXJlZERhdGFiYXNlID8gc2hhcmVkRGF0YWJhc2VFbnZpcm9ubWVudCA6IGVudmlyb25tZW50O1xuICAgIFxuICAgIC8vIENyZWF0ZSBvciByZWZlcmVuY2UgRHluYW1vREIgdGFibGVzIGJhc2VkIG9uIHNoYXJlZCBkYXRhYmFzZSBjb25maWd1cmF0aW9uXG4gICAgbGV0IHN0YXJHcm93dGhUYWJsZTogZHluYW1vZGIuSVRhYmxlO1xuICAgIGxldCBwclZlbG9jaXR5VGFibGU6IGR5bmFtb2RiLklUYWJsZTtcbiAgICBsZXQgaXNzdWVIZWFsdGhUYWJsZTogZHluYW1vZGIuSVRhYmxlO1xuICAgIGxldCBwYWNrYWdlRG93bmxvYWRzVGFibGU6IGR5bmFtb2RiLklUYWJsZTtcbiAgICBsZXQgcmVwb3NpdG9yaWVzVGFibGU6IGR5bmFtb2RiLklUYWJsZTtcblxuICAgIGlmICh1c2VTaGFyZWREYXRhYmFzZSAmJiBlbnZpcm9ubWVudCAhPT0gc2hhcmVkRGF0YWJhc2VFbnZpcm9ubWVudCkge1xuICAgICAgLy8gUmVmZXJlbmNlIGV4aXN0aW5nIHRhYmxlcyBmcm9tIHRoZSBzaGFyZWQgZW52aXJvbm1lbnRcbiAgICAgIHN0YXJHcm93dGhUYWJsZSA9IGR5bmFtb2RiLlRhYmxlLmZyb21UYWJsZU5hbWUodGhpcywgJ1N0YXJHcm93dGhUYWJsZScsIGAke3RhYmxlU3VmZml4fS1zdGFyLWdyb3d0aGApO1xuICAgICAgcHJWZWxvY2l0eVRhYmxlID0gZHluYW1vZGIuVGFibGUuZnJvbVRhYmxlTmFtZSh0aGlzLCAnUFJWZWxvY2l0eVRhYmxlJywgYCR7dGFibGVTdWZmaXh9LXByLXZlbG9jaXR5YCk7XG4gICAgICBpc3N1ZUhlYWx0aFRhYmxlID0gZHluYW1vZGIuVGFibGUuZnJvbVRhYmxlTmFtZSh0aGlzLCAnSXNzdWVIZWFsdGhUYWJsZScsIGAke3RhYmxlU3VmZml4fS1pc3N1ZS1oZWFsdGhgKTtcbiAgICAgIHBhY2thZ2VEb3dubG9hZHNUYWJsZSA9IGR5bmFtb2RiLlRhYmxlLmZyb21UYWJsZU5hbWUodGhpcywgJ1BhY2thZ2VEb3dubG9hZHNUYWJsZScsIGAke3RhYmxlU3VmZml4fS1wYWNrYWdlLWRvd25sb2Fkc2ApO1xuICAgICAgcmVwb3NpdG9yaWVzVGFibGUgPSBkeW5hbW9kYi5UYWJsZS5mcm9tVGFibGVOYW1lKHRoaXMsICdSZXBvc2l0b3JpZXNUYWJsZScsIGAke3RhYmxlU3VmZml4fS1yZXBvc2l0b3JpZXNgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gUmVmZXJlbmNlIGV4aXN0aW5nIHRhYmxlcyBmb3IgdGhpcyBlbnZpcm9ubWVudFxuICAgICAgc3Rhckdyb3d0aFRhYmxlID0gZHluYW1vZGIuVGFibGUuZnJvbVRhYmxlTmFtZSh0aGlzLCAnU3Rhckdyb3d0aFRhYmxlJywgYCR7dGFibGVTdWZmaXh9LXN0YXItZ3Jvd3RoYCk7XG4gICAgICBwclZlbG9jaXR5VGFibGUgPSBkeW5hbW9kYi5UYWJsZS5mcm9tVGFibGVOYW1lKHRoaXMsICdQUlZlbG9jaXR5VGFibGUnLCBgJHt0YWJsZVN1ZmZpeH0tcHItdmVsb2NpdHlgKTtcbiAgICAgIGlzc3VlSGVhbHRoVGFibGUgPSBkeW5hbW9kYi5UYWJsZS5mcm9tVGFibGVOYW1lKHRoaXMsICdJc3N1ZUhlYWx0aFRhYmxlJywgYCR7dGFibGVTdWZmaXh9LWlzc3VlLWhlYWx0aGApO1xuICAgICAgcGFja2FnZURvd25sb2Fkc1RhYmxlID0gZHluYW1vZGIuVGFibGUuZnJvbVRhYmxlTmFtZSh0aGlzLCAnUGFja2FnZURvd25sb2Fkc1RhYmxlJywgYCR7dGFibGVTdWZmaXh9LXBhY2thZ2UtZG93bmxvYWRzYCk7XG4gICAgICByZXBvc2l0b3JpZXNUYWJsZSA9IGR5bmFtb2RiLlRhYmxlLmZyb21UYWJsZU5hbWUodGhpcywgJ1JlcG9zaXRvcmllc1RhYmxlJywgYCR7dGFibGVTdWZmaXh9LXJlcG9zaXRvcmllc2ApO1xuICAgIH1cblxuICAgIC8vIEdpdEh1YiBUb2tlbiBTZWNyZXRcbiAgICBsZXQgZ2l0aHViVG9rZW5TZWNyZXQ6IHNlY3JldHNtYW5hZ2VyLklTZWNyZXQ7XG4gICAgaWYgKHVzZVNoYXJlZERhdGFiYXNlICYmIGVudmlyb25tZW50ICE9PSBzaGFyZWREYXRhYmFzZUVudmlyb25tZW50KSB7XG4gICAgICAvLyBSZWZlcmVuY2UgZXhpc3Rpbmcgc2VjcmV0IGZyb20gdGhlIHNoYXJlZCBlbnZpcm9ubWVudFxuICAgICAgZ2l0aHViVG9rZW5TZWNyZXQgPSBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMih0aGlzLCAnR2l0SHViVG9rZW5TZWNyZXQnLCBnaXRodWJUb2tlblNlY3JldE5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBSZWZlcmVuY2UgZXhpc3Rpbmcgc2VjcmV0IGZvciB0aGlzIGVudmlyb25tZW50XG4gICAgICBnaXRodWJUb2tlblNlY3JldCA9IHNlY3JldHNtYW5hZ2VyLlNlY3JldC5mcm9tU2VjcmV0TmFtZVYyKHRoaXMsICdHaXRIdWJUb2tlblNlY3JldCcsIGdpdGh1YlRva2VuU2VjcmV0TmFtZSk7XG4gICAgfVxuXG4gICAgLy8gU3RhZ2luZyBDcmVkZW50aWFscyBTZWNyZXQgKG9ubHkgZm9yIHN0YWdpbmcgZW52aXJvbm1lbnQpXG4gICAgbGV0IGRldkNyZWRlbnRpYWxzU2VjcmV0OiBzZWNyZXRzbWFuYWdlci5JU2VjcmV0IHwgdW5kZWZpbmVkO1xuICAgIGlmIChlbnZpcm9ubWVudCA9PT0gJ3N0YWdpbmcnICYmIGRldkNyZWRlbnRpYWxzU2VjcmV0TmFtZSkge1xuICAgICAgaWYgKHVzZVNoYXJlZERhdGFiYXNlICYmIGVudmlyb25tZW50ICE9PSBzaGFyZWREYXRhYmFzZUVudmlyb25tZW50KSB7XG4gICAgICAgIC8vIFJlZmVyZW5jZSBleGlzdGluZyBzZWNyZXQgZnJvbSB0aGUgc2hhcmVkIGVudmlyb25tZW50XG4gICAgICAgIGRldkNyZWRlbnRpYWxzU2VjcmV0ID0gc2VjcmV0c21hbmFnZXIuU2VjcmV0LmZyb21TZWNyZXROYW1lVjIodGhpcywgJ1N0YWdpbmdDcmVkZW50aWFsc1NlY3JldCcsIGRldkNyZWRlbnRpYWxzU2VjcmV0TmFtZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBSZWZlcmVuY2UgZXhpc3Rpbmcgc2VjcmV0IGZvciB0aGlzIGVudmlyb25tZW50XG4gICAgICAgIGRldkNyZWRlbnRpYWxzU2VjcmV0ID0gc2VjcmV0c21hbmFnZXIuU2VjcmV0LmZyb21TZWNyZXROYW1lVjIodGhpcywgJ1N0YWdpbmdDcmVkZW50aWFsc1NlY3JldCcsIGRldkNyZWRlbnRpYWxzU2VjcmV0TmFtZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gTGFtYmRhIExheWVyIGZvciBzaGFyZWQgZGVwZW5kZW5jaWVzXG4gICAgY29uc3Qgc2hhcmVkTGF5ZXIgPSBuZXcgbGFtYmRhLkxheWVyVmVyc2lvbih0aGlzLCAnU2hhcmVkTGF5ZXInLCB7XG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJ2xhbWJkYS1sYXllcicpLFxuICAgICAgY29tcGF0aWJsZVJ1bnRpbWVzOiBbbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1hdLFxuICAgICAgZGVzY3JpcHRpb246ICdTaGFyZWQgZGVwZW5kZW5jaWVzIGZvciBPcGVuIFNvdXJjZSBUcmFja2VyIExhbWJkYSBmdW5jdGlvbnMnLFxuICAgICAgbGF5ZXJWZXJzaW9uTmFtZTogYCR7ZW52aXJvbm1lbnR9LXNoYXJlZC1sYXllcmAsXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgTGFtYmRhIEZ1bmN0aW9uXG4gICAgY29uc3QgYXBpRnVuY3Rpb24gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdBUElGdW5jdGlvbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2xhbWJkYS1pbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vYmFja2VuZCcpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgRU5WSVJPTk1FTlQ6IGVudmlyb25tZW50LFxuICAgICAgICBTVEFSX0dST1dUSF9UQUJMRTogc3Rhckdyb3d0aFRhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgUFJfVkVMT0NJVFlfVEFCTEU6IHByVmVsb2NpdHlUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIElTU1VFX0hFQUxUSF9UQUJMRTogaXNzdWVIZWFsdGhUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFBBQ0tBR0VfRE9XTkxPQURTX1RBQkxFOiBwYWNrYWdlRG93bmxvYWRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBSRVBPU0lUT1JJRVNfVEFCTEU6IHJlcG9zaXRvcmllc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgR0lUSFVCX1RPS0VOX1NFQ1JFVF9OQU1FOiBnaXRodWJUb2tlblNlY3JldE5hbWUsXG4gICAgICB9LFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgbGF5ZXJzOiBbc2hhcmVkTGF5ZXJdLFxuICAgICAgbG9nUmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX1dFRUssXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBwZXJtaXNzaW9ucyB0byBMYW1iZGFcbiAgICBzdGFyR3Jvd3RoVGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGFwaUZ1bmN0aW9uKTtcbiAgICBwclZlbG9jaXR5VGFibGUuZ3JhbnRSZWFkV3JpdGVEYXRhKGFwaUZ1bmN0aW9uKTtcbiAgICBpc3N1ZUhlYWx0aFRhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhcGlGdW5jdGlvbik7XG4gICAgcGFja2FnZURvd25sb2Fkc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShhcGlGdW5jdGlvbik7XG4gICAgcmVwb3NpdG9yaWVzVGFibGUuZ3JhbnRSZWFkRGF0YShhcGlGdW5jdGlvbik7XG4gICAgZ2l0aHViVG9rZW5TZWNyZXQuZ3JhbnRSZWFkKGFwaUZ1bmN0aW9uKTtcblxuICAgIC8vIFVuaWZpZWQgRGF0YSBDb2xsZWN0aW9uIExhbWJkYSBGdW5jdGlvbiAocmVwbGFjZXMgaW5kaXZpZHVhbCBjb2xsZWN0b3JzKVxuICAgIGNvbnN0IHVuaWZpZWRDb2xsZWN0b3IgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdVbmlmaWVkQ29sbGVjdG9yJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICBoYW5kbGVyOiAnaW5kZXguaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoJy4uL2JhY2tlbmQnKSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEVOVklST05NRU5UOiBlbnZpcm9ubWVudCxcbiAgICAgICAgU1RBUl9HUk9XVEhfVEFCTEU6IHN0YXJHcm93dGhUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIFBSX1ZFTE9DSVRZX1RBQkxFOiBwclZlbG9jaXR5VGFibGUudGFibGVOYW1lLFxuICAgICAgICBJU1NVRV9IRUFMVEhfVEFCTEU6IGlzc3VlSGVhbHRoVGFibGUudGFibGVOYW1lLFxuICAgICAgICBQQUNLQUdFX0RPV05MT0FEU19UQUJMRTogcGFja2FnZURvd25sb2Fkc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgUkVQT1NJVE9SSUVTX1RBQkxFOiByZXBvc2l0b3JpZXNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIEdJVEhVQl9UT0tFTl9TRUNSRVRfTkFNRTogZ2l0aHViVG9rZW5TZWNyZXROYW1lLFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwMCksIC8vIDUgbWludXRlcyBmb3IgdW5pZmllZCBjb2xsZWN0aW9uXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgICBsYXllcnM6IFtzaGFyZWRMYXllcl0sXG4gICAgICBsb2dSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfV0VFSyxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHBlcm1pc3Npb25zIHRvIHVuaWZpZWQgY29sbGVjdG9yXG4gICAgc3Rhckdyb3d0aFRhYmxlLmdyYW50V3JpdGVEYXRhKHVuaWZpZWRDb2xsZWN0b3IpO1xuICAgIHByVmVsb2NpdHlUYWJsZS5ncmFudFdyaXRlRGF0YSh1bmlmaWVkQ29sbGVjdG9yKTtcbiAgICBpc3N1ZUhlYWx0aFRhYmxlLmdyYW50V3JpdGVEYXRhKHVuaWZpZWRDb2xsZWN0b3IpO1xuICAgIHBhY2thZ2VEb3dubG9hZHNUYWJsZS5ncmFudFdyaXRlRGF0YSh1bmlmaWVkQ29sbGVjdG9yKTtcbiAgICByZXBvc2l0b3JpZXNUYWJsZS5ncmFudFJlYWREYXRhKHVuaWZpZWRDb2xsZWN0b3IpO1xuICAgIGdpdGh1YlRva2VuU2VjcmV0LmdyYW50UmVhZCh1bmlmaWVkQ29sbGVjdG9yKTtcblxuICAgIC8vIEV2ZW50QnJpZGdlIFJ1bGVzIGZvciBzY2hlZHVsZWQgZGF0YSBjb2xsZWN0aW9uXG4gICAgLy8gU3RhciBncm93dGg6IHVzaW5nIGRhdGFDb2xsZWN0aW9uU2NoZWR1bGUgcGFyYW1ldGVyXG4gICAgY29uc3QgZnJlcXVlbnREYXRhQ29sbGVjdGlvblJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0ZyZXF1ZW50RGF0YUNvbGxlY3Rpb25SdWxlJywge1xuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5leHByZXNzaW9uKGRhdGFDb2xsZWN0aW9uU2NoZWR1bGUpLFxuICAgICAgZGVzY3JpcHRpb246IGBGcmVxdWVudCBkYXRhIGNvbGxlY3Rpb24gKCR7ZGF0YUNvbGxlY3Rpb25TY2hlZHVsZX0pIGZvciAke2Vudmlyb25tZW50fSBlbnZpcm9ubWVudGAsXG4gICAgfSk7XG5cbiAgICAvLyBEYWlseSBjb2xsZWN0aW9uOiBQUiB2ZWxvY2l0eSBhbmQgaXNzdWUgaGVhbHRoIGF0IDExOjUwIFBNIFBTVCAoNzo1MCBBTSBVVEMgbmV4dCBkYXkpXG4gICAgY29uc3QgZGFpbHlEYXRhQ29sbGVjdGlvblJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0RhaWx5RGF0YUNvbGxlY3Rpb25SdWxlJywge1xuICAgICAgc2NoZWR1bGU6IGV2ZW50cy5TY2hlZHVsZS5leHByZXNzaW9uKCdjcm9uKDUwIDcgKiAqID8gKiknKSwgLy8gNzo1MCBBTSBVVEMgPSAxMTo1MCBQTSBQU1RcbiAgICAgIGRlc2NyaXB0aW9uOiBgRGFpbHkgY29sbGVjdGlvbjogU3RhciBHcm93dGgsIFBSIFZlbG9jaXR5ICYgSXNzdWUgSGVhbHRoIGRhdGEgKDExOjUwIFBNIFBTVCkgZm9yICR7ZW52aXJvbm1lbnR9IGVudmlyb25tZW50YCxcbiAgICB9KTtcblxuICAgIC8vIFdlZWtseSBjb2xsZWN0aW9uOiBQYWNrYWdlIGRvd25sb2FkcyBldmVyeSBTdW5kYXkgYXQgMTE6NTAgUE0gUFNUICg3OjUwIEFNIFVUQyBuZXh0IGRheSlcbiAgICBjb25zdCB3ZWVrbHlEYXRhQ29sbGVjdGlvblJ1bGUgPSBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1dlZWtseURhdGFDb2xsZWN0aW9uUnVsZScsIHtcbiAgICAgIHNjaGVkdWxlOiBldmVudHMuU2NoZWR1bGUuZXhwcmVzc2lvbignY3Jvbig1MCA3ID8gKiBTVU4gKiknKSwgLy8gNzo1MCBBTSBVVEMgPSAxMTo1MCBQTSBQU1Qgb24gU3VuZGF5c1xuICAgICAgZGVzY3JpcHRpb246IGBXZWVrbHkgY29sbGVjdGlvbjogUGFja2FnZSBEb3dubG9hZHMgZGF0YSAoZXZlcnkgU3VuZGF5IGF0IDExOjUwIFBNIFBTVCkgZm9yICR7ZW52aXJvbm1lbnR9IGVudmlyb25tZW50YCxcbiAgICB9KTtcblxuICAgIC8vIEFkZCB0YXJnZXRzIHRvIHRoZSBydWxlc1xuICAgIGZyZXF1ZW50RGF0YUNvbGxlY3Rpb25SdWxlLmFkZFRhcmdldChuZXcgdGFyZ2V0cy5MYW1iZGFGdW5jdGlvbih1bmlmaWVkQ29sbGVjdG9yKSk7XG4gICAgZGFpbHlEYXRhQ29sbGVjdGlvblJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKHVuaWZpZWRDb2xsZWN0b3IpKTtcbiAgICB3ZWVrbHlEYXRhQ29sbGVjdGlvblJ1bGUuYWRkVGFyZ2V0KG5ldyB0YXJnZXRzLkxhbWJkYUZ1bmN0aW9uKHVuaWZpZWRDb2xsZWN0b3IpKTtcblxuICAgIC8vIEFQSSBHYXRld2F5XG4gICAgY29uc3QgYXBpID0gbmV3IGFwaWdhdGV3YXkuUmVzdEFwaSh0aGlzLCAnT3BlblNvdXJjZVRyYWNrZXJBUEknLCB7XG4gICAgICByZXN0QXBpTmFtZTogYCR7ZW52aXJvbm1lbnR9LW9wZW4tc291cmNlLXRyYWNrZXItYXBpYCxcbiAgICAgIGRlc2NyaXB0aW9uOiBgQVBJIGZvciBPcGVuIFNvdXJjZSBUcmFja2VyICR7ZW52aXJvbm1lbnR9IGVudmlyb25tZW50YCxcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBhcGlnYXRld2F5LkNvcnMuQUxMX01FVEhPRFMsXG4gICAgICAgIGFsbG93SGVhZGVyczogWydDb250ZW50LVR5cGUnLCAnWC1BbXotRGF0ZScsICdBdXRob3JpemF0aW9uJywgJ1gtQXBpLUtleSddLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBHYXRld2F5IEludGVncmF0aW9uXG4gICAgY29uc3QgYXBpSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihhcGlGdW5jdGlvbik7XG5cbiAgICAvLyBBUEkgUm91dGVzXG4gICAgYXBpLnJvb3QuYWRkUHJveHkoe1xuICAgICAgZGVmYXVsdEludGVncmF0aW9uOiBhcGlJbnRlZ3JhdGlvbixcbiAgICAgIGFueU1ldGhvZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIFMzIEJ1Y2tldCBmb3IgRnJvbnRlbmRcbiAgICBjb25zdCBmcm9udGVuZEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0Zyb250ZW5kQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYCR7ZW52aXJvbm1lbnR9LW9wZW4tc291cmNlLXRyYWNrZXItZnJvbnRlbmQtJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIHdlYnNpdGVJbmRleERvY3VtZW50OiAnaW5kZXguaHRtbCcsXG4gICAgICB3ZWJzaXRlRXJyb3JEb2N1bWVudDogJ2luZGV4Lmh0bWwnLFxuICAgICAgcHVibGljUmVhZEFjY2VzczogdHJ1ZSxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BQ0xTLFxuICAgICAgcmVtb3ZhbFBvbGljeTogZW52aXJvbm1lbnQgPT09ICdwcm9kJyA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTiA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogZW52aXJvbm1lbnQgIT09ICdwcm9kJyxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IHB1YmxpYyByZWFkIGFjY2VzcyB0byB0aGUgYnVja2V0XG4gICAgZnJvbnRlbmRCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ3MzOkdldE9iamVjdCddLFxuICAgICAgcmVzb3VyY2VzOiBbZnJvbnRlbmRCdWNrZXQuYXJuRm9yT2JqZWN0cygnKicpXSxcbiAgICAgIHByaW5jaXBhbHM6IFtuZXcgaWFtLkFueVByaW5jaXBhbCgpXSxcbiAgICB9KSk7XG5cbiAgICAvLyBVc2UgUzNPcmlnaW4gd2l0aCBwcm9wZXIgY29uZmlndXJhdGlvblxuICAgIGNvbnN0IHMzT3JpZ2luID0gbmV3IG9yaWdpbnMuUzNPcmlnaW4oZnJvbnRlbmRCdWNrZXQpO1xuXG4gICAgLy8gTGFtYmRhQEVkZ2UgZnVuY3Rpb24gZm9yIHN0YWdpbmcgZW52aXJvbm1lbnQgYXV0aGVudGljYXRpb25cbiAgICBsZXQgYXV0aEZ1bmN0aW9uOiBsYW1iZGEuRnVuY3Rpb24gfCB1bmRlZmluZWQ7XG4gICAgaWYgKGVudmlyb25tZW50ID09PSAnc3RhZ2luZycpIHtcbiAgICAgIGF1dGhGdW5jdGlvbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0F1dGhGdW5jdGlvbicsIHtcbiAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzE4X1gsXG4gICAgICAgIGhhbmRsZXI6ICdhdXRoLWZ1bmN0aW9uLmhhbmRsZXInLFxuICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL2xhbWJkYS1lZGdlJykpLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg1KSxcbiAgICAgICAgbWVtb3J5U2l6ZTogMTI4LFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQ2xvdWRGcm9udCBEaXN0cmlidXRpb25cbiAgICBjb25zdCBkaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ0Zyb250ZW5kRGlzdHJpYnV0aW9uJywge1xuICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgIG9yaWdpbjogczNPcmlnaW4sXG4gICAgICAgIHZpZXdlclByb3RvY29sUG9saWN5OiBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICBjYWNoZVBvbGljeTogY2xvdWRmcm9udC5DYWNoZVBvbGljeS5DQUNISU5HX09QVElNSVpFRCxcbiAgICAgICAgLi4uKGVudmlyb25tZW50ID09PSAnc3RhZ2luZycgJiYgYXV0aEZ1bmN0aW9uID8ge1xuICAgICAgICAgIGVkZ2VMYW1iZGFzOiBbe1xuICAgICAgICAgICAgZnVuY3Rpb25WZXJzaW9uOiBhdXRoRnVuY3Rpb24uY3VycmVudFZlcnNpb24sXG4gICAgICAgICAgICBldmVudFR5cGU6IGNsb3VkZnJvbnQuTGFtYmRhRWRnZUV2ZW50VHlwZS5WSUVXRVJfUkVRVUVTVCxcbiAgICAgICAgICB9XSxcbiAgICAgICAgfSA6IHt9KSxcbiAgICAgIH0sXG4gICAgICBlcnJvclJlc3BvbnNlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaHR0cFN0YXR1czogNDA0LFxuICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogMjAwLFxuICAgICAgICAgIHJlc3BvbnNlUGFnZVBhdGg6ICcvaW5kZXguaHRtbCcsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBUElFbmRwb2ludCcsIHtcbiAgICAgIHZhbHVlOiBhcGkudXJsLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgR2F0ZXdheSBlbmRwb2ludCBVUkwnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7ZW52aXJvbm1lbnR9LWFwaS1lbmRwb2ludGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRnJvbnRlbmRVUkwnLCB7XG4gICAgICB2YWx1ZTogZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0Nsb3VkRnJvbnQgZGlzdHJpYnV0aW9uIFVSTCcsXG4gICAgICBleHBvcnROYW1lOiBgJHtlbnZpcm9ubWVudH0tZnJvbnRlbmQtdXJsYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdGcm9udGVuZEJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogZnJvbnRlbmRCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUzMgYnVja2V0IG5hbWUgZm9yIGZyb250ZW5kJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke2Vudmlyb25tZW50fS1mcm9udGVuZC1idWNrZXRgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0dpdEh1YlRva2VuU2VjcmV0TmFtZScsIHtcbiAgICAgIHZhbHVlOiBnaXRodWJUb2tlblNlY3JldC5zZWNyZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdHaXRIdWIgdG9rZW4gc2VjcmV0IG5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7ZW52aXJvbm1lbnR9LWdpdGh1Yi10b2tlbi1zZWNyZXRgLFxuICAgIH0pO1xuICB9XG59ICJdfQ==