const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-east-1' });

async function checkNextSchedule() {
  console.log('📅 Checking next scheduled data collection...\n');

  const events = new AWS.EventBridge();
  const lambda = new AWS.Lambda();

  try {
    // Get EventBridge rules
    console.log('🔍 Getting EventBridge rules...');
    const rules = await events.listRules().promise();
    
    // Filter for star collection rules
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
      
      // Get targets for this rule
      const targets = await events.listTargetsByRule({
        Rule: rule.Name
      }).promise();
      
      console.log(`   Targets: ${targets.Targets.length}`);
      targets.Targets.forEach(target => {
        console.log(`     - ${target.Id}: ${target.Arn}`);
      });
    }

    // Calculate next execution times based on cron expressions
    console.log('\n⏰ Calculating next execution times...');
    
    const now = new Date();
    console.log(`Current time: ${now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PDT`);
    
    // Production schedule: cron(0 3,6,9,12,15,18,21 * * ? *) - every 3 hours starting at 3:00 AM PDT
    // Staging schedule: cron(0 12,15,18,21,0,3,6,9 * * ? *) - every 3 hours starting at 12:00 PM PDT
    
    const prodHours = [3, 6, 9, 12, 15, 18, 21];
    const stagingHours = [12, 15, 18, 21, 0, 3, 6, 9];
    
    // Find next production execution
    const currentHour = now.getHours();
    let nextProdHour = prodHours.find(hour => hour > currentHour);
    if (!nextProdHour) {
      nextProdHour = prodHours[0]; // Next day
    }
    
    // Find next staging execution
    let nextStagingHour = stagingHours.find(hour => hour > currentHour);
    if (!nextStagingHour) {
      nextStagingHour = stagingHours[0]; // Next day
    }
    
    // Calculate next execution times
    const nextProdTime = new Date(now);
    if (nextProdHour <= currentHour) {
      nextProdTime.setDate(nextProdTime.getDate() + 1);
    }
    nextProdTime.setHours(nextProdHour, 0, 0, 0);
    
    const nextStagingTime = new Date(now);
    if (nextStagingHour <= currentHour) {
      nextStagingTime.setDate(nextStagingTime.getDate() + 1);
    }
    nextStagingTime.setHours(nextStagingHour, 0, 0, 0);
    
    console.log(`\n📊 Production next execution: ${nextProdTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PDT`);
    console.log(`📊 Staging next execution: ${nextStagingTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PDT`);
    
    // Calculate time until next execution
    const timeUntilProd = nextProdTime.getTime() - now.getTime();
    const timeUntilStaging = nextStagingTime.getTime() - now.getTime();
    
    const hoursUntilProd = Math.floor(timeUntilProd / (1000 * 60 * 60));
    const minutesUntilProd = Math.floor((timeUntilProd % (1000 * 60 * 60)) / (1000 * 60));
    
    const hoursUntilStaging = Math.floor(timeUntilStaging / (1000 * 60 * 60));
    const minutesUntilStaging = Math.floor((timeUntilStaging % (1000 * 60 * 60)) / (1000 * 60));
    
    console.log(`\n⏱️ Time until next execution:`);
    console.log(`   Production: ${hoursUntilProd}h ${minutesUntilProd}m`);
    console.log(`   Staging: ${hoursUntilStaging}h ${minutesUntilStaging}m`);
    
    // Show today's schedule
    console.log(`\n📅 Today's schedule (${now.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' })}):`);
    console.log(`   Production: ${prodHours.join(', ')}:00 PDT`);
    console.log(`   Staging: ${stagingHours.join(', ')}:00 PDT`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error('Stack:', err.stack);
  }
}

checkNextSchedule().catch(console.error); 