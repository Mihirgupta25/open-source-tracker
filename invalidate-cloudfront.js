const AWS = require('aws-sdk');

const cloudfront = new AWS.CloudFront();

async function invalidateCache() {
  try {
    const params = {
      DistributionId: 'E1YYTJZXHOIMIQ',
      InvalidationBatch: {
        CallerReference: `invalidation-${Date.now()}`,
        Paths: {
          Quantity: 1,
          Items: ['/*']
        }
      }
    };

    const result = await cloudfront.createInvalidation(params).promise();
    console.log('CloudFront invalidation created successfully:');
    console.log('Invalidation ID:', result.Invalidation.Id);
    console.log('Status:', result.Invalidation.Status);
    console.log('Create Time:', result.Invalidation.CreateTime);
    
    return result;
  } catch (error) {
    console.error('Error creating CloudFront invalidation:', error);
    throw error;
  }
}

invalidateCache(); 