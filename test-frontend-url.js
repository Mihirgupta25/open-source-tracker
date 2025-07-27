const puppeteer = require('puppeteer');

async function testFrontendURL() {
  console.log('🧪 Testing frontend URL...');
  
  const frontendURL = 'https://dci8qqj8zzoob.cloudfront.net';
  
  try {
    console.log(`🌐 Opening frontend URL: ${frontendURL}`);
    
    const browser = await puppeteer.launch({ 
      headless: false, // Set to true for headless mode
      defaultViewport: { width: 1200, height: 800 }
    });
    
    const page = await browser.newPage();
    
    // Navigate to the frontend
    await page.goto(frontendURL, { waitUntil: 'networkidle2' });
    
    console.log('✅ Frontend loaded successfully');
    
    // Wait for the charts to load
    await page.waitForTimeout(5000);
    
    // Check if the debug information is visible
    const debugElements = await page.$$('[style*="fontSize: 0.8rem"]');
    console.log(`📊 Found ${debugElements.length} debug elements`);
    
    // Take a screenshot
    await page.screenshot({ path: 'frontend-test-screenshot.png', fullPage: true });
    console.log('📸 Screenshot saved as frontend-test-screenshot.png');
    
    // Check for any console errors
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
      console.log(`🔍 Console: ${msg.text()}`);
    });
    
    // Wait a bit more to capture any delayed console messages
    await page.waitForTimeout(3000);
    
    console.log('\n📋 Console Logs Summary:');
    consoleLogs.forEach(log => {
      if (log.includes('Debug:') || log.includes('data points loaded')) {
        console.log(`  ✅ ${log}`);
      }
    });
    
    await browser.close();
    console.log('✅ Frontend test completed successfully');
    
  } catch (error) {
    console.error('❌ Error testing frontend:', error);
  }
}

// Check if puppeteer is available
try {
  require('puppeteer');
  testFrontendURL();
} catch (error) {
  console.log('📝 Puppeteer not available. Please install it with: npm install puppeteer');
  console.log('🌐 You can manually test the frontend at: https://dci8qqj8zzoob.cloudfront.net');
  console.log('📊 Look for the debug information showing data points loaded for each chart');
} 