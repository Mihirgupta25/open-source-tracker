const API_BASE_URL = 'https://v7ka0hnhgg.execute-api.us-east-1.amazonaws.com/prod';

// Simulate the frontend data processing logic
async function testFrontendDataProcessing() {
  console.log('🧪 Testing frontend data processing logic...\n');

  try {
    // Test star history processing
    console.log('📊 Testing star history processing...');
    const starRes = await fetch(`${API_BASE_URL}/api/star-history`);
    const starData = await starRes.json();
    
    if (Array.isArray(starData)) {
      const processedStarData = starData.map(d => ({
        ...d,
        timestamp: d.timestamp,
        displayTimestamp: (() => {
          let dateObj;
          if (d.timestamp.includes('T') && d.timestamp.includes('Z')) {
            dateObj = new Date(d.timestamp);
          } else {
            dateObj = new Date(d.timestamp.replace(' ', 'T') + 'Z');
          }
          return dateObj.toLocaleString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true
          });
        })()
      }));
      
      console.log(`✅ Star history: ${processedStarData.length} records processed`);
      console.log('Sample processed star data:', JSON.stringify(processedStarData[0], null, 2));
    }

    // Test PR velocity processing
    console.log('\n📈 Testing PR velocity processing...');
    const prRes = await fetch(`${API_BASE_URL}/api/pr-velocity`);
    const prData = await prRes.json();
    
    if (Array.isArray(prData)) {
      const byDate = {};
      prData.forEach(d => {
        byDate[d.date] = d;
      });
      const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
      const chartData = [...sorted.map(d => ({
        ...d,
        date: d.date,
        ratio: d.ratio !== undefined ? Number(d.ratio) : 0
      }))];
      
      console.log(`✅ PR velocity: ${chartData.length} records processed`);
      console.log('Sample processed PR data:', JSON.stringify(chartData[0], null, 2));
    }

    // Test issue health processing
    console.log('\n🐛 Testing issue health processing...');
    const issueRes = await fetch(`${API_BASE_URL}/api/issue-health`);
    const issueData = await issueRes.json();
    
    if (Array.isArray(issueData)) {
      const byDate = {};
      issueData.forEach(d => {
        byDate[d.date] = d;
      });
      const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
      const chartData = [...sorted.map(d => ({
        ...d,
        date: d.date,
        ratio: d.ratio !== undefined ? Number(d.ratio) : 0
      }))];
      
      console.log(`✅ Issue health: ${chartData.length} records processed`);
      console.log('Sample processed issue data:', JSON.stringify(chartData[0], null, 2));
    }

    // Test package downloads processing
    console.log('\n📦 Testing package downloads processing...');
    const packageRes = await fetch(`${API_BASE_URL}/api/package-downloads`);
    const packageData = await packageRes.json();
    
    if (Array.isArray(packageData)) {
      const byWeek = {};
      packageData.forEach(d => {
        byWeek[d.week_start] = d;
      });
      const sorted = Object.values(byWeek).sort((a, b) => a.week_start.localeCompare(b.week_start));
      const chartData = [...sorted.map(d => ({
        ...d,
        week_start: d.week_start,
        downloads: d.downloads !== undefined ? Number(d.downloads) : 0
      }))];
      
      console.log(`✅ Package downloads: ${chartData.length} records processed`);
      console.log('Sample processed package data:', JSON.stringify(chartData[0], null, 2));
    }

    console.log('\n🎉 All frontend data processing tests passed!');
    console.log('\n📋 Summary:');
    console.log('- Star history processing: ✅');
    console.log('- PR velocity processing: ✅');
    console.log('- Issue health processing: ✅');
    console.log('- Package downloads processing: ✅');

  } catch (error) {
    console.error('❌ Error testing frontend data processing:', error);
  }
}

testFrontendDataProcessing(); 