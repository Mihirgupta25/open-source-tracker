const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Running 3-hour star collection immediately...');

const scriptPath = path.join(__dirname, 'collect-stars-3hour.js');
const child = spawn('node', [scriptPath], {
  stdio: 'inherit',
  cwd: __dirname
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Star collection completed successfully');
  } else {
    console.error(`❌ Star collection failed with code ${code}`);
  }
  process.exit(code);
});

child.on('error', (error) => {
  console.error('💥 Error running star collection:', error);
  process.exit(1);
}); 