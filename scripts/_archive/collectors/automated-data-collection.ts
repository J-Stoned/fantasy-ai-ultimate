#!/usr/bin/env tsx
/**
 * 🔥 AUTOMATED DATA COLLECTION SERVICE
 * 
 * Runs on schedule to keep data fresh
 * Collects real player stats and detects patterns
 */

import * as cron from 'node-cron';
import chalk from 'chalk';
import { realStatsCollector } from './data-collection/real-player-stats-collector';
import { realPatternDetector } from './real-pattern-detector';
import { enhancedDb } from '../lib/services/enhanced-database-service';

class AutomatedDataCollectionService {
  private jobs: cron.ScheduledTask[] = [];

  start() {
    console.log(chalk.bold.red('🤖 AUTOMATED DATA COLLECTION SERVICE'));
    console.log(chalk.yellow('Starting scheduled tasks...\n'));

    // Task 1: Collect player stats every 6 hours
    const statsJob = cron.schedule('0 */6 * * *', async () => {
      console.log(chalk.cyan(`\n[${new Date().toISOString()}] Running player stats collection...`));
      try {
        await realStatsCollector.run();
        console.log(chalk.green('✅ Player stats collection complete'));
      } catch (error) {
        console.error(chalk.red('❌ Stats collection error:'), error);
      }
    });

    // Task 2: Detect patterns for upcoming games every 2 hours
    const patternJob = cron.schedule('0 */2 * * *', async () => {
      console.log(chalk.cyan(`\n[${new Date().toISOString()}] Running pattern detection...`));
      try {
        await this.detectPatternsForUpcomingGames();
        console.log(chalk.green('✅ Pattern detection complete'));
      } catch (error) {
        console.error(chalk.red('❌ Pattern detection error:'), error);
      }
    });

    // Task 3: Check accuracy of past predictions daily
    const accuracyJob = cron.schedule('0 0 * * *', async () => {
      console.log(chalk.cyan(`\n[${new Date().toISOString()}] Checking prediction accuracy...`));
      try {
        await this.checkPredictionAccuracy();
        console.log(chalk.green('✅ Accuracy check complete'));
      } catch (error) {
        console.error(chalk.red('❌ Accuracy check error:'), error);
      }
    });

    // Task 4: Quick update for live games every 30 minutes
    const liveJob = cron.schedule('*/30 * * * *', async () => {
      console.log(chalk.cyan(`\n[${new Date().toISOString()}] Updating live games...`));
      try {
        await this.updateLiveGames();
        console.log(chalk.green('✅ Live games updated'));
      } catch (error) {
        console.error(chalk.red('❌ Live update error:'), error);
      }
    });

    this.jobs = [statsJob, patternJob, accuracyJob, liveJob];

    // Start all jobs
    this.jobs.forEach(job => job.start());

    console.log(chalk.green('✅ Scheduled tasks started:'));
    console.log(chalk.white('  • Player stats collection: Every 6 hours'));
    console.log(chalk.white('  • Pattern detection: Every 2 hours'));
    console.log(chalk.white('  • Accuracy check: Daily at midnight'));
    console.log(chalk.white('  • Live game updates: Every 30 minutes'));

    // Run initial tasks
    console.log(chalk.yellow('\n🚀 Running initial data collection...'));
    this.runInitialTasks();
  }

  stop() {
    console.log(chalk.yellow('\n🛑 Stopping automated collection...'));
    this.jobs.forEach(job => job.stop());
    console.log(chalk.green('✅ All scheduled tasks stopped'));
  }

  private async runInitialTasks() {
    // Run pattern detection immediately
    await this.detectPatternsForUpcomingGames();
    
    // Check if we need fresh stats
    const { data: recentStats } = await enhancedDb.getClient()
      .from('player_game_logs')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);

    const lastUpdate = recentStats?.[0]?.created_at;
    const hoursSinceUpdate = lastUpdate 
      ? (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60)
      : 999;

    if (hoursSinceUpdate > 6) {
      console.log(chalk.yellow('Stats are stale, running collection...'));
      await realStatsCollector.run();
    }
  }

  private async detectPatternsForUpcomingGames() {
    // Get upcoming games
    const { data: upcomingGames } = await enhancedDb.getClient()
      .from('games')
      .select('id, home_team_id, away_team_id, start_time, sport')
      .gte('start_time', new Date().toISOString())
      .lte('start_time', new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()) // Next 48 hours
      .order('start_time', { ascending: true })
      .limit(50);

    if (!upcomingGames || upcomingGames.length === 0) {
      console.log(chalk.gray('No upcoming games found'));
      return;
    }

    console.log(chalk.cyan(`Analyzing ${upcomingGames.length} upcoming games...`));

    const patternResults: any[] = [];
    
    for (const game of upcomingGames) {
      const patterns = await realPatternDetector.detectPatterns(game.id);
      
      if (patterns.length > 0) {
        patternResults.push({
          game_id: game.id,
          patterns: patterns.map(p => ({
            name: p.pattern,
            confidence: p.confidence,
            recommendation: p.betRecommendation
          })),
          created_at: new Date().toISOString()
        });
      }
    }

    // Store pattern predictions
    if (patternResults.length > 0) {
      console.log(chalk.green(`Found patterns in ${patternResults.length} games`));
      
      // Create pattern_predictions table if needed
      await enhancedDb.enhancedUpsert('pattern_predictions', patternResults, {
        skipValidation: true
      });
    }
  }

  private async checkPredictionAccuracy() {
    // Get completed games with predictions
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const { data: completedGames } = await enhancedDb.getClient()
      .from('games')
      .select('id, home_score, away_score')
      .not('home_score', 'is', null)
      .gte('start_time', yesterday.toISOString())
      .lte('start_time', new Date().toISOString());

    if (!completedGames) return;

    let checked = 0;
    for (const game of completedGames) {
      await realPatternDetector.checkAccuracy(game.id);
      checked++;
    }

    const stats = realPatternDetector.getAccuracyStats();
    
    console.log(chalk.yellow(`\n📊 Accuracy Report:`));
    console.log(chalk.white(`Checked ${checked} games`));
    console.log(chalk.white(`Overall accuracy: ${stats.overall}`));
    
    // Store accuracy metrics
    const accuracyRecord = {
      date: new Date().toISOString(),
      overall_accuracy: parseFloat(stats.overall),
      total_predictions: stats.totalPredictions,
      correct_predictions: stats.correctPredictions,
      pattern_stats: stats.patternStats
    };

    await enhancedDb.enhancedUpsert('accuracy_metrics', [accuracyRecord], {
      skipValidation: true
    });
  }

  private async updateLiveGames() {
    // Get live games
    const { data: liveGames } = await enhancedDb.getClient()
      .from('games')
      .select('id, external_id, sport')
      .eq('status', 'in_progress')
      .limit(20);

    if (!liveGames || liveGames.length === 0) {
      console.log(chalk.gray('No live games'));
      return;
    }

    console.log(chalk.cyan(`Updating ${liveGames.length} live games...`));

    // TODO: Fetch live scores from ESPN
    // For now, just log
    console.log(chalk.yellow('Live score updates not yet implemented'));
  }
}

// Create service instance
const automatedService = new AutomatedDataCollectionService();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down automated collection...'));
  automatedService.stop();
  process.exit(0);
});

// Run the service
if (require.main === module) {
  automatedService.start();
  
  // Keep the process running
  console.log(chalk.cyan('\n🤖 Service is running. Press Ctrl+C to stop.\n'));
}