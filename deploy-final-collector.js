const AWS = require('aws-sdk');
const fs = require('fs');
const archiver = require('archiver');

// Configure AWS
AWS.config.update({
  region: 'us-east-1'
});

// Initialize AWS services
const lambda = new AWS.Lambda();
const events = new AWS.EventBridge();
const iam = new AWS.IAM();

// Configuration
const FUNCTION_NAME = 'prod-star-collector-final';
const RULE_NAME = 'prod-star-collection-schedule-final';
const TARGET_ID = 'prod-star-collector-final-target';

// Create deployment package
async function createDeploymentPackage() {
  console.log('📦 Creating deployment package...');
  
  const output = fs.createWriteStream('lambda-star-collector-final.zip');
  const archive = archiver('zip', { zlib: { level: 9 } });
  
  return new Promise((resolve, reject) => {
    output.on('close', () => {
      console.log('✅ Deployment package created');
      resolve();
    });
    
    archive.on('error', (err) => {
      reject(err);
    });
    
    archive.pipe(output);
    
    // Add the Lambda function (no external dependencies needed)
    archive.file('lambda-star-collector-final.js', { name: 'index.js' });
    
    archive.finalize();
  });
}

// Create IAM role for Lambda
async function createIAMRole() {
  console.log('🔐 Creating IAM role...');
  
  const trustPolicy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: {
          Service: 'lambda.amazonaws.com'
        },
        Action: 'sts:AssumeRole'
      }
    ]
  };
  
  const policyDocument = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents'
        ],
        Resource: 'arn:aws:logs:us-east-1:*:*'
      },
      {
        Effect: 'Allow',
        Action: [
          'dynamodb:PutItem',
          'dynamodb:GetItem',
          'dynamodb:Query',
          'dynamodb:Scan'
        ],
        Resource: 'arn:aws:dynamodb:us-east-1:*:table/prod-star-growth'
      },
      {
        Effect: 'Allow',
        Action: [
          'secretsmanager:GetSecretValue'
        ],
        Resource: 'arn:aws:secretsmanager:us-east-1:*:secret:prod-github-token*'
      }
    ]
  };
  
  try {
    // Create role
    const createRoleParams = {
      RoleName: `${FUNCTION_NAME}-role`,
      AssumeRolePolicyDocument: JSON.stringify(trustPolicy),
      Description: 'Role for star collection Lambda function (final)'
    };
    
    const role = await iam.createRole(createRoleParams).promise();
    console.log('✅ IAM role created');
    
    // Attach policy
    const putRolePolicyParams = {
      RoleName: `${FUNCTION_NAME}-role`,
      PolicyName: `${FUNCTION_NAME}-policy`,
      PolicyDocument: JSON.stringify(policyDocument)
    };
    
    await iam.putRolePolicy(putRolePolicyParams).promise();
    console.log('✅ IAM policy attached');
    
    // Wait for role to be ready (IAM propagation delay)
    console.log('⏳ Waiting for IAM role to propagate...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
    
    return role.Role.Arn;
    
  } catch (error) {
    if (error.code === 'EntityAlreadyExists') {
      console.log('ℹ️  IAM role already exists');
      // Get the account ID properly
      const sts = new AWS.STS();
      const identity = await sts.getCallerIdentity().promise();
      return `arn:aws:iam::${identity.Account}:role/${FUNCTION_NAME}-role`;
    }
    throw error;
  }
}

// Create Lambda function
async function createLambdaFunction(roleArn) {
  console.log('🚀 Creating Lambda function...');
  
  const zipBuffer = fs.readFileSync('lambda-star-collector-final.zip');
  
  const params = {
    FunctionName: FUNCTION_NAME,
    Runtime: 'nodejs18.x',
    Role: roleArn,
    Handler: 'index.handler',
    Code: {
      ZipFile: zipBuffer
    },
    Description: 'Star collection Lambda function (final version)',
    Timeout: 30,
    MemorySize: 128,
    Environment: {
      Variables: {
        ENVIRONMENT: 'prod',
        STAR_GROWTH_TABLE: 'prod-star-growth',
        GITHUB_TOKEN_SECRET_NAME: 'prod-github-token'
      }
    }
  };
  
  try {
    const result = await lambda.createFunction(params).promise();
    console.log('✅ Lambda function created');
    return result.FunctionArn;
  } catch (error) {
    if (error.code === 'ResourceConflictException') {
      console.log('ℹ️  Lambda function already exists, updating...');
      
      // Update function code
      await lambda.updateFunctionCode({
        FunctionName: FUNCTION_NAME,
        ZipFile: zipBuffer
      }).promise();
      
      // Update function configuration
      await lambda.updateFunctionConfiguration({
        FunctionName: FUNCTION_NAME,
        Timeout: 30,
        MemorySize: 128,
        Environment: {
          Variables: {
            ENVIRONMENT: 'prod',
            STAR_GROWTH_TABLE: 'prod-star-growth',
            GITHUB_TOKEN_SECRET_NAME: 'prod-github-token'
          }
        }
      }).promise();
      
      console.log('✅ Lambda function updated');
      // Get the account ID properly
      const sts = new AWS.STS();
      const identity = await sts.getCallerIdentity().promise();
      return `arn:aws:lambda:us-east-1:${identity.Account}:function:${FUNCTION_NAME}`;
    }
    throw error;
  }
}

// Create EventBridge rule
async function createEventBridgeRule(functionArn) {
  console.log('⏰ Creating EventBridge rule...');
  
  // Create rule
  const ruleParams = {
    Name: RULE_NAME,
    Description: 'Schedule for star collection every 3 hours',
    ScheduleExpression: 'rate(3 hours)',
    State: 'ENABLED'
  };
  
  try {
    await events.putRule(ruleParams).promise();
    console.log('✅ EventBridge rule created');
  } catch (error) {
    if (error.code === 'ResourceAlreadyExistsException') {
      console.log('ℹ️  EventBridge rule already exists');
    } else {
      throw error;
    }
  }
  
  // Add target
  const targetParams = {
    Rule: RULE_NAME,
    Targets: [
      {
        Id: TARGET_ID,
        Arn: functionArn
      }
    ]
  };
  
  try {
    await events.putTargets(targetParams).promise();
    console.log('✅ EventBridge target added');
  } catch (error) {
    if (error.code === 'ResourceAlreadyExistsException') {
      console.log('ℹ️  EventBridge target already exists');
    } else {
      throw error;
    }
  }
}

// Main deployment function
async function deploy() {
  try {
    console.log('🚀 Starting final cloud deployment for star collection...');
    
    // Create deployment package
    await createDeploymentPackage();
    
    // Create IAM role
    const roleArn = await createIAMRole();
    
    // Create Lambda function
    const functionArn = await createLambdaFunction(roleArn);
    
    // Create EventBridge rule
    await createEventBridgeRule(functionArn);
    
    console.log('🎉 Cloud deployment completed successfully!');
    console.log('📊 Lambda function ARN:', functionArn);
    console.log('⏰ EventBridge rule:', RULE_NAME);
    console.log('💡 The star collection will now run every 3 hours in the cloud');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  }
}

// Run deployment
deploy()
  .then(() => {
    console.log('✅ Cloud deployment completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Cloud deployment failed:', error);
    process.exit(1);
  }); 