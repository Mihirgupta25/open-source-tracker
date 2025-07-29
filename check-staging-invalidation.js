const AWS = require('aws-sdk');

const cloudfront = new AWS.CloudFront();

async function checkStagingInvalidationStatus() {
  try {
    const params = {
      DistributionId: 'E2ZUSLRM9KYVOO',
      Id: 'IA3V4Q7C5687O02XBY0V7U26C7'
    };

    const result = await cloudfront.getInvalidation(params).promise();
    console.log('Staging Invalidation Status:');
    console.log('ID:', result.Invalidation.Id);
    console.log('Status:', result.Invalidation.Status);
    console.log('Create Time:', result.Invalidation.CreateTime);
    
    if (result.Invalidation.InvalidationBatch) {
      console.log('Paths:', result.Invalidation.InvalidationBatch.Paths.Items);
    }
    
    return result;
  } catch (error) {
    console.error('Error checking staging invalidation status:', error);
    throw error;
  }
}

checkStagingInvalidationStatus(); 