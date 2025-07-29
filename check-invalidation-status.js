const AWS = require('aws-sdk');

const cloudfront = new AWS.CloudFront();

async function checkInvalidationStatus() {
  try {
    const params = {
      DistributionId: 'E1YYTJZXHOIMIQ',
      Id: 'I59GUF6Y1HG56B6PXXVXRZW1QT'
    };

    const result = await cloudfront.getInvalidation(params).promise();
    console.log('Invalidation Status:');
    console.log('ID:', result.Invalidation.Id);
    console.log('Status:', result.Invalidation.Status);
    console.log('Create Time:', result.Invalidation.CreateTime);
    
    if (result.Invalidation.InvalidationBatch) {
      console.log('Paths:', result.Invalidation.InvalidationBatch.Paths.Items);
    }
    
    return result;
  } catch (error) {
    console.error('Error checking invalidation status:', error);
    throw error;
  }
}

checkInvalidationStatus(); 