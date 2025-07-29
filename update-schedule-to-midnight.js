const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

async function updateScheduleToMidnight() {
  console.log('🕛 Updating schedules to start at 12:00 AM PDT...\n');

  const events = new AWS.EventBridge();

  try {
    // Update production rule
    console.log('📊 Updating production schedule...');
    await events.putRule({
      Name: 'OpenSourceTrackerProdV2-FrequentDataCollectionRule5-6eUBaFqODdoA',
      Description: 'Frequent collection: Star Growth data (every 3 hours starting 12:00 AM PDT) for production environment',
      ScheduleExpression: 'cron(0 0,3,6,9,12,15,18,21 * * ? *)',
      State: 'ENABLED'
    }).promise();
    console.log('✅ Production schedule updated');

    // Update staging rule
    console.log('\n📊 Updating staging schedule...');
    await events.putRule({
      Name: 'OpenSourceTrackerStagingV-FrequentDataCollectionRul-COTdQ1LCVQnu',
      Description: 'Frequent collection: Star Growth data (every 3 hours starting 12:00 AM PDT) for staging environment',
      ScheduleExpression: 'cron(0 0,3,6,9,12,15,18,21 * * ? *)',
      State: 'ENABLED'
    }).promise();
    console.log('✅ Staging schedule updated');

    // Wait for changes to propagate
    console.log('\n⏳ Waiting for changes to propagate...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Verify the changes
    console.log('\n🔍 Verifying updated schedules...');
    const rules = await events.listRules().promise();
    
    const starCollectionRules = rules.Rules.filter(rule => 
      rule.Name.includes('StarGrowth') || 
      rule.Name.includes('star-collection') ||
      rule.Description && rule.Description.includes('Star Growth')
    );
    
    console.log(`📊 Found ${starCollectionRules.length} star collection rules:`);
    
    for (const rule of starCollectionRules) {
      console.log(`\n📋 Rule: ${rule.Name}`);
      console.log(`   Description: ${rule.Description || 'No description'}`);
      console.log(`   Schedule: ${rule.ScheduleExpression || 'No schedule'}`);
      console.log(`   State: ${rule.State}`);
    }

    // Calculate next execution times with new schedule
    console.log('\n⏰ Calculating next execution times with new schedule...');
    
    const now = new Date();
    console.log(`Current time: ${now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PDT`);
    
    // New schedule: cron(0 0,3,6,9,12,15,18,21 * * ? *) - every 3 hours starting at 12:00 AM PDT
    const newHours = [0, 3, 6, 9, 12, 15, 18, 21];
    
    // Find next execution for both environments
    const currentHour = now.getHours();
    let nextHour = newHours.find(hour => hour > currentHour);
    if (!nextHour) {
      nextHour = newHours[0]; // Next day
    }
    
    // Calculate next execution time
    const nextTime = new Date(now);
    if (nextHour <= currentHour) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
    nextTime.setHours(nextHour, 0, 0, 0);
    
    console.log(`\n📊 Next execution (both environments): ${nextTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PDT`);
    
    // Calculate time until next execution
    const timeUntilNext = nextTime.getTime() - now.getTime();
    const hoursUntilNext = Math.floor(timeUntilNext / (1000 * 60 * 60));
    const minutesUntilNext = Math.floor((timeUntilNext % (1000 * 60 * 60)) / (1000 * 60));
    
    console.log(`\n⏱️ Time until next execution: ${hoursUntilNext}h ${minutesUntilNext}m`);
    
    // Show today's schedule
    console.log(`\n📅 Today's schedule (${now.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })}):`);
    console.log(`   Both environments: ${newHours.join(', ')}:00 PDT`);

    console.log('\n🎉 Schedule updated successfully!');
    console.log('📊 Both production and staging now start at 12:00 AM PDT');
    console.log('⏰ Next data collection will be at the next 3-hour interval');

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

updateScheduleToMidnight().catch(console.error); 