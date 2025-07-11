import { ultimateStatsService } from '../lib/services/ultimate-stats-service';
import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Ultimate Stats Scheduler - Automates real-time data updates
 * 
 * Update Frequencies:
 * - Live games: Every 30 seconds
 * - Recent games: Every 2 minutes  
 * - Completed games: Every 5 minutes
 * - Historical: Every hour
 */

console.log('🚀 ULTIMATE STATS SCHEDULER STARTING...');
console.log('=====================================\n');

// Track scheduler state
const schedulerState = {
  isRunning: false,
  lastUpdate: null as Date | null,
  totalUpdates: 0,
  errors: 0,
  sports: {
    NBA: { updates: 0, lastUpdate: null },
    NFL: { updates: 0, lastUpdate: null },
    NHL: { updates: 0, lastUpdate: null },
    MLB: { updates: 0, lastUpdate: null }
  }
};

// Main update function
async function runScheduledUpdate(updateType: string) {
  if (schedulerState.isRunning) {
    console.log('⏳ Update already in progress, skipping...');
    return;
  }
  
  schedulerState.isRunning = true;
  const startTime = Date.now();
  
  try {
    console.log(`\n🔄 Running ${updateType} update...`);
    
    // Process updates for all sports
    const result = await ultimateStatsService.processLatestStats();
    
    // Update state
    schedulerState.lastUpdate = new Date();
    schedulerState.totalUpdates++;
    
    // Track sport-specific updates
    result.sports.forEach((sport: string) => {
      if (schedulerState.sports[sport as keyof typeof schedulerState.sports]) {
        schedulerState.sports[sport as keyof typeof schedulerState.sports].updates++;
        schedulerState.sports[sport as keyof typeof schedulerState.sports].lastUpdate = new Date();
      }
    });
    
    const duration = Date.now() - startTime;
    console.log(`✅ ${updateType} update completed in ${duration}ms`);
    console.log(`   Games processed: ${result.totalGamesProcessed}`);
    console.log(`   Logs updated: ${result.totalLogsUpdated}`);
    console.log(`   Sports: ${result.sports.join(', ')}`);
    
  } catch (error) {
    schedulerState.errors++;
    console.error(`❌ ${updateType} update failed:`, error);
  } finally {
    schedulerState.isRunning = false;
  }
}

// Schedule different update frequencies
const schedules = {
  // Every 30 seconds - for live games during prime hours (7 PM - 11 PM ET)
  liveGames: cron.schedule('*/30 * 19-23 * * *', () => {
    runScheduledUpdate('LIVE_GAMES');
  }, { scheduled: false }),
  
  // Every 2 minutes - standard update frequency
  regular: cron.schedule('*/2 * * * *', () => {
    runScheduledUpdate('REGULAR');
  }, { scheduled: false }),
  
  // Every 5 minutes - for completed recent games
  recent: cron.schedule('*/5 * * * *', () => {
    runScheduledUpdate('RECENT_GAMES');
  }, { scheduled: false }),
  
  // Every hour - cleanup and historical data
  historical: cron.schedule('0 * * * *', () => {
    runScheduledUpdate('HISTORICAL');
  }, { scheduled: false })
};

// Health check endpoint
async function healthCheck() {
  const uptime = process.uptime();
  const health = {
    status: 'healthy',
    uptime: `${Math.floor(uptime / 60)} minutes`,
    lastUpdate: schedulerState.lastUpdate,
    totalUpdates: schedulerState.totalUpdates,
    errors: schedulerState.errors,
    errorRate: schedulerState.totalUpdates > 0 
      ? (schedulerState.errors / schedulerState.totalUpdates * 100).toFixed(2) + '%'
      : '0%',
    sports: schedulerState.sports
  };
  
  console.log('\n📊 SCHEDULER HEALTH CHECK:');
  console.log(JSON.stringify(health, null, 2));
  
  return health;
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down scheduler...');
  
  Object.values(schedules).forEach(schedule => schedule.stop());
  
  console.log('✅ Scheduler stopped gracefully');
  process.exit(0);
});

// Start the scheduler
function startScheduler() {
  console.log('🎯 Starting scheduled tasks...\n');
  
  // Start all schedules
  schedules.regular.start();
  schedules.recent.start();
  schedules.liveGames.start();
  schedules.historical.start();
  
  console.log('✅ Scheduled tasks started:');
  console.log('   - Regular updates: Every 2 minutes');
  console.log('   - Recent games: Every 5 minutes');
  console.log('   - Live games: Every 30 seconds (7-11 PM ET)');
  console.log('   - Historical: Every hour');
  
  // Run initial update
  runScheduledUpdate('INITIAL');
  
  // Health check every 10 minutes
  setInterval(healthCheck, 600000);
}

// Command line arguments
const args = process.argv.slice(2);

if (args.includes('--once')) {
  // Run once and exit
  console.log('🎯 Running single update...');
  runScheduledUpdate('MANUAL')
    .then(() => {
      console.log('✅ Single update completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Update failed:', error);
      process.exit(1);
    });
} else if (args.includes('--health')) {
  // Show health and exit
  healthCheck().then(() => process.exit(0));
} else {
  // Start continuous scheduler
  startScheduler();
}

// Export for testing
export { runScheduledUpdate, healthCheck, schedulerState };