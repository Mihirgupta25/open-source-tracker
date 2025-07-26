// Simulate the frontend data processing logic
const API_BASE_URL = 'https://l97n7ozrb0.execute-api.us-east-1.amazonaws.com/prod';

async function testFrontendLogic() {
  console.log('🧪 Testing frontend data processing logic...\n');
  
  try {
    // Test PR Velocity
    console.log('📈 Testing PR Velocity:');
    const prRes = await fetch(`${API_BASE_URL}/api/pr-velocity`);
    const prData = await prRes.json();
    console.log('Raw API response:', prData);
    
    if (Array.isArray(prData)) {
      console.log(`Array length: ${prData.length}`);
      
      // Apply the same logic as frontend
      const byDate = {};
      prData.forEach(d => {
        byDate[d.date] = d; // Keep the latest entry for each date
      });
      const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
      console.log('After processing:', sorted);
      console.log(`Final array length: ${sorted.length}`);
      
      // Add dummy data point
      let chartData = [...sorted.map(d => ({
        ...d,
        date: d.date,
        ratio: d.ratio !== undefined ? Number(d.ratio) : 0
      }))];
      
      if (chartData.length > 0) {
        const lastDate = new Date(chartData[chartData.length - 1].date + 'T00:00:00Z');
        const nextDate = new Date(lastDate);
        nextDate.setDate(lastDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().slice(0, 10);
        chartData.push({ date: nextDateStr, ratio: null });
      }
      
      console.log('Final chart data:', chartData);
      console.log(`Chart data length: ${chartData.length}`);
    }
    
    console.log('\n🐛 Testing Issue Health:');
    const issueRes = await fetch(`${API_BASE_URL}/api/issue-health`);
    const issueData = await issueRes.json();
    console.log('Raw API response:', issueData);
    
    if (Array.isArray(issueData)) {
      console.log(`Array length: ${issueData.length}`);
      
      // Apply the same logic as frontend
      const byDate = {};
      issueData.forEach(d => {
        byDate[d.date] = d; // Keep the latest entry for each date
      });
      const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
      console.log('After processing:', sorted);
      console.log(`Final array length: ${sorted.length}`);
      
      // Add dummy data point
      let chartData = [...sorted.map(d => ({
        ...d,
        date: d.date,
        ratio: d.ratio !== undefined ? Number(d.ratio) : 0
      }))];
      
      if (chartData.length > 0) {
        const lastDate = new Date(chartData[chartData.length - 1].date + 'T00:00:00Z');
        const nextDate = new Date(lastDate);
        nextDate.setDate(lastDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().slice(0, 10);
        chartData.push({ date: nextDateStr, ratio: null });
      }
      
      console.log('Final chart data:', chartData);
      console.log(`Chart data length: ${chartData.length}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFrontendLogic(); 