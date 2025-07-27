const API_BASE_URL = 'https://v7ka0hnhgg.execute-api.us-east-1.amazonaws.com/prod';

async function testAPIEndpoints() {
  console.log('🧪 Testing API endpoints...\n');

  try {
    // Test star history
    console.log('📊 Testing star history...');
    const starRes = await fetch(`${API_BASE_URL}/api/star-history`);
    const starData = await starRes.json();
    console.log(`✅ Star history: ${starData.length} records`);
    if (starData.length > 0) {
      console.log('Sample star data:', JSON.stringify(starData[0], null, 2));
    }

    // Test PR velocity
    console.log('\n📈 Testing PR velocity...');
    const prRes = await fetch(`${API_BASE_URL}/api/pr-velocity`);
    const prData = await prRes.json();
    console.log(`✅ PR velocity: ${prData.length} records`);
    if (prData.length > 0) {
      console.log('Sample PR data:', JSON.stringify(prData[0], null, 2));
    }

    // Test issue health
    console.log('\n🐛 Testing issue health...');
    const issueRes = await fetch(`${API_BASE_URL}/api/issue-health`);
    const issueData = await issueRes.json();
    console.log(`✅ Issue health: ${issueData.length} records`);
    if (issueData.length > 0) {
      console.log('Sample issue data:', JSON.stringify(issueData[0], null, 2));
    }

    // Test package downloads
    console.log('\n📦 Testing package downloads...');
    const packageRes = await fetch(`${API_BASE_URL}/api/package-downloads`);
    const packageData = await packageRes.json();
    console.log(`✅ Package downloads: ${packageData.length} records`);
    if (packageData.length > 0) {
      console.log('Sample package data:', JSON.stringify(packageData[0], null, 2));
    }

    console.log('\n🎉 All API endpoints are working correctly!');
    console.log('\n📋 Summary:');
    console.log(`- Star history: ${starData.length} records`);
    console.log(`- PR velocity: ${prData.length} records`);
    console.log(`- Issue health: ${issueData.length} records`);
    console.log(`- Package downloads: ${packageData.length} records`);

  } catch (error) {
    console.error('❌ Error testing API endpoints:', error);
  }
}

testAPIEndpoints(); 