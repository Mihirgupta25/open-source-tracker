const AWS = require('aws-sdk');

const cloudfront = new AWS.CloudFront();

async function invalidateStagingCache() {
  try {
    const params = {
      DistributionId: 'E2ZUSLRM9KYVOO',
      InvalidationBatch: {
        CallerReference: `staging-invalidation-${Date.now()}`,
        Paths: {
          Quantity: 1,
          Items: ['/*']
        }
      }
    };

    const result = await cloudfront.createInvalidation(params).promise();
    console.log('Staging CloudFront invalidation created successfully:');
    console.log('Invalidation ID:', result.Invalidation.Id);
    console.log('Status:', result.Invalidation.Status);
    console.log('Create Time:', result.Invalidation.CreateTime);
    
    return result;
  } catch (error) {
    console.error('Error creating staging CloudFront invalidation:', error);
    throw error;
  }
}

invalidateStagingCache(); 