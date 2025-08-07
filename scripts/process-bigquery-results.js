const fs = require('fs');

// Configuration
const REPO = 'promptfoo/promptfoo';

function processBigQueryResults(inputFile, outputFile) {
  try {
    console.log('🔄 Processing BigQuery results...');
    
    // Read BigQuery results
    const rawData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    console.log(`📊 Loaded ${rawData.length} events from BigQuery`);
    
    // Process events into timeline format
    const timeline = [];
    let runningCount = 0;
    
    rawData.forEach((event, index) => {
      const timestamp = new Date(event.created_at);
      const action = event.action; // 'started' or 'deleted'
      
      if (action === 'started') {
        runningCount++;
      } else if (action === 'deleted') {
        runningCount = Math.max(0, runningCount - 1);
      }
      
      timeline.push({
        timestamp: timestamp.toISOString(),
        displayTimestamp: timestamp.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Los_Angeles'
        }),
        count: runningCount,
        action: action,
        user: event.user
      });
    });
    
    // Create summary data
    const summary = {
      repository: REPO,
      dateRange: {
        start: timeline.length > 0 ? timeline[0].timestamp : null,
        end: timeline.length > 0 ? timeline[timeline.length - 1].timestamp : null
      },
      summary: {
        totalEvents: rawData.length,
        timelineEntries: timeline.length,
        finalStarCount: timeline.length > 0 ? timeline[timeline.length - 1].count : 0,
        source: 'BigQuery GitHub Archive'
      },
      timeline: timeline
    };
    
    // Save processed data
    fs.writeFileSync(outputFile, JSON.stringify(summary, null, 2));
    
    console.log('✅ Processing completed!');
    console.log(`📊 Summary:`);
    console.log(`- Total events: ${rawData.length}`);
    console.log(`- Timeline entries: ${timeline.length}`);
    console.log(`- Final star count: ${summary.summary.finalStarCount}`);
    
    if (timeline.length > 0) {
      console.log(`- Date range: ${timeline[0].displayTimestamp} to ${timeline[timeline.length - 1].displayTimestamp}`);
    }
    
    // Show sample data
    console.log('\n📋 Sample timeline entries:');
    timeline.slice(0, 10).forEach((entry, index) => {
      console.log(`${index + 1}. ${entry.displayTimestamp} - ${entry.count} stars (${entry.action}) by ${entry.user}`);
    });
    
    if (timeline.length > 10) {
      console.log(`... and ${timeline.length - 10} more entries`);
    }
    
    return summary;
    
  } catch (error) {
    console.error('❌ Error processing BigQuery results:', error.message);
    throw error;
  }
}

function createDailySummary(timeline) {
  console.log('📊 Creating daily summary...');
  
  const dailyData = {};
  
  timeline.forEach(entry => {
    const date = new Date(entry.timestamp).toISOString().split('T')[0];
    
    if (!dailyData[date]) {
      dailyData[date] = {
        date: date,
        stars_added: 0,
        stars_removed: 0,
        final_count: 0,
        events: []
      };
    }
    
    if (entry.action === 'started') {
      dailyData[date].stars_added++;
    } else if (entry.action === 'deleted') {
      dailyData[date].stars_removed++;
    }
    
    dailyData[date].final_count = entry.count;
    dailyData[date].events.push({
      time: entry.displayTimestamp,
      action: entry.action,
      user: entry.user,
      count: entry.count
    });
  });
  
  return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
}

function createMonthlySummary(timeline) {
  console.log('📊 Creating monthly summary...');
  
  const monthlyData = {};
  
  timeline.forEach(entry => {
    const month = new Date(entry.timestamp).toISOString().slice(0, 7); // YYYY-MM
    
    if (!monthlyData[month]) {
      monthlyData[month] = {
        month: month,
        stars_added: 0,
        stars_removed: 0,
        final_count: 0,
        events: []
      };
    }
    
    if (entry.action === 'started') {
      monthlyData[month].stars_added++;
    } else if (entry.action === 'deleted') {
      monthlyData[month].stars_removed++;
    }
    
    monthlyData[month].final_count = entry.count;
    monthlyData[month].events.push({
      time: entry.displayTimestamp,
      action: entry.action,
      user: entry.user,
      count: entry.count
    });
  });
  
  return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
}

function generateGrowthAnalysis(timeline) {
  console.log('📈 Generating growth analysis...');
  
  const analysis = {
    totalGrowth: timeline.length > 0 ? timeline[timeline.length - 1].count : 0,
    totalEvents: timeline.length,
    growthRate: {
      daily: {},
      monthly: {},
      overall: {}
    },
    milestones: []
  };
  
  // Calculate milestones
  const milestoneCounts = [100, 500, 1000, 2500, 5000, 7500];
  milestoneCounts.forEach(milestone => {
    const milestoneEvent = timeline.find(entry => entry.count >= milestone);
    if (milestoneEvent) {
      analysis.milestones.push({
        count: milestone,
        date: milestoneEvent.displayTimestamp,
        user: milestoneEvent.user
      });
    }
  });
  
  // Calculate growth periods
  if (timeline.length > 1) {
    const firstEvent = timeline[0];
    const lastEvent = timeline[timeline.length - 1];
    const totalDays = (new Date(lastEvent.timestamp) - new Date(firstEvent.timestamp)) / (1000 * 60 * 60 * 24);
    
    analysis.growthRate.overall = {
      totalDays: Math.round(totalDays),
      averagePerDay: (lastEvent.count - firstEvent.count) / totalDays,
      totalGrowth: lastEvent.count - firstEvent.count
    };
  }
  
  return analysis;
}

async function main() {
  try {
    console.log('🚀 BigQuery Results Processor');
    console.log('============================\n');
    
    const inputFile = process.argv[2] || 'promptfoo-historical-stars-bigquery.json';
    const outputFile = process.argv[3] || 'promptfoo-processed-timeline.json';
    
    if (!fs.existsSync(inputFile)) {
      console.log('📋 Usage: node process-bigquery-results.js [input-file] [output-file]');
      console.log('📋 Example: node process-bigquery-results.js bigquery-results.json processed-timeline.json');
      console.log('\n📋 Or place your BigQuery results in: promptfoo-historical-stars-bigquery.json');
      return;
    }
    
    // Process the data
    const summary = processBigQueryResults(inputFile, outputFile);
    
    // Create additional summaries
    const dailySummary = createDailySummary(summary.timeline);
    const monthlySummary = createMonthlySummary(summary.timeline);
    const growthAnalysis = generateGrowthAnalysis(summary.timeline);
    
    // Save additional files
    fs.writeFileSync('promptfoo-daily-summary.json', JSON.stringify(dailySummary, null, 2));
    fs.writeFileSync('promptfoo-monthly-summary.json', JSON.stringify(monthlySummary, null, 2));
    fs.writeFileSync('promptfoo-growth-analysis.json', JSON.stringify(growthAnalysis, null, 2));
    
    console.log('\n💾 Generated files:');
    console.log(`- ${outputFile} (main timeline)`);
    console.log('- promptfoo-daily-summary.json (daily breakdown)');
    console.log('- promptfoo-monthly-summary.json (monthly breakdown)');
    console.log('- promptfoo-growth-analysis.json (growth analysis)');
    
    // Display growth analysis
    console.log('\n📈 Growth Analysis:');
    console.log(`- Total growth: ${growthAnalysis.totalGrowth} stars`);
    console.log(`- Total events: ${growthAnalysis.totalEvents}`);
    
    if (growthAnalysis.growthRate.overall) {
      const rate = growthAnalysis.growthRate.overall;
      console.log(`- Growth period: ${rate.totalDays} days`);
      console.log(`- Average growth: ${rate.averagePerDay.toFixed(2)} stars/day`);
    }
    
    if (growthAnalysis.milestones.length > 0) {
      console.log('\n🏆 Milestones:');
      growthAnalysis.milestones.forEach(milestone => {
        console.log(`- ${milestone.count} stars: ${milestone.date} by ${milestone.user}`);
      });
    }
    
    console.log('\n✅ Processing completed successfully!');
    console.log('📊 You can now use these files in your tracking system.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { 
  processBigQueryResults, 
  createDailySummary, 
  createMonthlySummary, 
  generateGrowthAnalysis 
}; 