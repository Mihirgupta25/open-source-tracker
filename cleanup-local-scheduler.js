const { exec } = require('child_process');

console.log('🛑 Stopping local star collection scheduler...');

// Kill any running scheduler processes
exec('pkill -f schedule-3hour-stars', (error, stdout, stderr) => {
  if (error) {
    console.log('ℹ️  No local scheduler processes found to stop');
  } else {
    console.log('✅ Local scheduler stopped');
  }
  
  console.log('💡 You can now deploy to AWS Lambda + EventBridge');
  console.log('🚀 Run: node deploy-cloud-star-collector.js');
}); 