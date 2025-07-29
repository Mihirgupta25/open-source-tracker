const AWS = require('aws-sdk');

const cloudfront = new AWS.CloudFront();

async function invalidateStagingFinalWorking() {
  try {
    const params = {
      DistributionId: 'E2ZUSLRM9KYVOO',
      InvalidationBatch: {
        CallerReference: `staging-final-working-invalidation-${Date.now()}`,
        Paths: {
          Quantity: 1,
          Items: ['/*']
        }
      }
    };

    const result = await cloudfront.createInvalidation(params).promise();
    console.log('Final working staging CloudFront invalidation created successfully:');
    console.log('Invalidation ID:', result.Invalidation.Id);
    console.log('Status:', result.Invalidation.Status);
    console.log('Create Time:', result.Invalidation.CreateTime);
    
    return result;
  } catch (error) {
    console.error('Error creating final working staging CloudFront invalidation:', error);
    throw error;
  }
}

invalidateStagingFinalWorking(); 