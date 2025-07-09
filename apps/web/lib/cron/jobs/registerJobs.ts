import { cronManager } from '../CronManager';
import { NFLCollector } from '../collectors/NFLCollector';
import { NBACollector } from '../collectors/NBACollector';
import { NewsCollector } from '../collectors/NewsCollector';
import { supabase } from '../../supabase/client';
import { cronLogger } from '../../utils/logger';

export async function registerAllCronJobs() {
  cronLogger.info('Registering all cron jobs');

  const nflCollector = new NFLCollector();
  const nbaCollector = new NBACollector();
  const newsCollector = new NewsCollector();

  // NFL Jobs
  await cronManager.registerJob({
    name: 'nfl-live-scores',
    schedule: '*/30 * * * * *', // Every 30 seconds during games
    handler: async () => await nflCollector.collectLiveScores(),
    runOnInit: false,
  });

  await cronManager.registerJob({
    name: 'nfl-player-stats',
    schedule: '*/2 * * * *', // Every 2 minutes
    handler: async () => await nflCollector.collectPlayerStats(),
  });

  await cronManager.registerJob({
    name: 'nfl-injury-reports',
    schedule: '0 */30 * * *', // Every 30 minutes
    handler: async () => await nflCollector.collectInjuryReports(),
  });

  // NBA Jobs
  await cronManager.registerJob({
    name: 'nba-live-scores',
    schedule: '*/30 * * * * *', // Every 30 seconds during games
    handler: async () => await nbaCollector.collectLiveScores(),
    runOnInit: false,
  });

  await cronManager.registerJob({
    name: 'nba-player-stats',
    schedule: '*/2 * * * *', // Every 2 minutes
    handler: async () => await nbaCollector.collectPlayerStats(),
  });

  // News Collection
  await cronManager.registerJob({
    name: 'sports-news',
    schedule: '0 */15 * * *', // Every 15 minutes
    handler: async () => await newsCollector.collectSportsNews(),
    runOnInit: true, // Run immediately on start
  });

  await cronManager.registerJob({
    name: 'social-mentions',
    schedule: '0 */10 * * *', // Every 10 minutes
    handler: async () => await newsCollector.collectSocialMentions(),
  });

  // Daily Jobs
  await cronManager.registerJob({
    name: 'daily-cleanup',
    schedule: '0 0 3 * * *', // 3 AM daily
    handler: async () => {
      cronLogger.info('Running daily cleanup');
      // Clean up old logs, expired data, etc.
      const { error } = await supabase
        .from('cron_job_logs')
        .delete()
        .lt('executed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      
      if (!error) {
        cronLogger.info('Cleanup completed', { deletedSessions, deletedLogs });
      }
    },
  });

  // Weekly Jobs
  await cronManager.registerJob({
    name: 'weekly-stats-aggregation',
    schedule: '0 0 2 * * 1', // Mondays at 2 AM
    handler: async () => {
      cronLogger.info('Aggregating weekly stats');
      // Aggregate player stats, calculate trends, etc.
    },
  });

  cronLogger.info('All cron jobs registered successfully');
}

// Helper function to check if games are active
async function areGamesActive(sport: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data } = await supabase
    .from('games')
    .select('id')
    .eq('game_date', today)
    .eq('sport_id', sport)
    .in('status', ['scheduled', 'in_progress'])
    .limit(1);
  
  return data && data.length > 0;
}

// Function to start/stop jobs based on game schedules
export async function manageDynamicJobs() {
  // Check if NFL games are today
  const nflGamesActive = await areGamesActive('football');
  if (nflGamesActive) {
    cronManager.startJob('nfl-live-scores');
    cronManager.startJob('nfl-player-stats');
  } else {
    cronManager.stopJob('nfl-live-scores');
    cronManager.stopJob('nfl-player-stats');
  }

  // Check if NBA games are today
  const nbaGamesActive = await areGamesActive('basketball');
  if (nbaGamesActive) {
    cronManager.startJob('nba-live-scores');
    cronManager.startJob('nba-player-stats');
  } else {
    cronManager.stopJob('nba-live-scores');
    cronManager.stopJob('nba-player-stats');
  }
}