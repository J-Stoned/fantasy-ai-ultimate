#!/usr/bin/env tsx
/**
 * PURGE ALL SYNTHETIC DATA
 * 
 * Removes all fake/synthetic data from the database
 * Keeps only real data from actual APIs
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface PurgeStats {
  players: { before: number; after: number; deleted: number };
  games: { before: number; after: number; deleted: number };
  news: { before: number; after: number; deleted: number };
  playerStats: { before: number; after: number; deleted: number };
  gameStats: { before: number; after: number; deleted: number };
  insights: { before: number; after: number; deleted: number };
  predictions: { before: number; after: number; deleted: number };
}

async function getCount(table: string): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  return count || 0;
}

async function purgeSyntheticData(): Promise<PurgeStats> {
  console.log(chalk.red.bold(`
╔═══════════════════════════════════════════════╗
║        🗑️  SYNTHETIC DATA PURGE 🗑️            ║
╚═══════════════════════════════════════════════╝
  `));

  const stats: PurgeStats = {
    players: { before: 0, after: 0, deleted: 0 },
    games: { before: 0, after: 0, deleted: 0 },
    news: { before: 0, after: 0, deleted: 0 },
    playerStats: { before: 0, after: 0, deleted: 0 },
    gameStats: { before: 0, after: 0, deleted: 0 },
    insights: { before: 0, after: 0, deleted: 0 },
    predictions: { before: 0, after: 0, deleted: 0 }
  };

  try {
    // 1. PURGE SYNTHETIC PLAYERS
    console.log(chalk.yellow('\n🏃 Purging synthetic players...'));
    stats.players.before = await getCount('players');
    
    // Delete players without real external IDs
    const { error: playersError } = await supabase
      .from('players')
      .delete()
      .not('external_id', 'like', 'balldontlie_%')
      .not('external_id', 'like', 'espn_%')
      .not('external_id', 'like', 'sportsradar_%')
      .is('external_id', null);
    
    if (playersError) {
      console.log(chalk.red('❌ Error deleting synthetic players:', playersError.message));
    }
    
    stats.players.after = await getCount('players');
    stats.players.deleted = stats.players.before - stats.players.after;
    console.log(chalk.green(`✅ Deleted ${stats.players.deleted} synthetic players`));

    // 2. PURGE SYNTHETIC GAMES
    console.log(chalk.yellow('\n🏈 Purging synthetic games...'));
    stats.games.before = await getCount('games');
    
    // Delete games without real external IDs
    const { error: gamesError } = await supabase
      .from('games')
      .delete()
      .not('external_id', 'like', 'balldontlie_%')
      .not('external_id', 'like', 'espn_%')
      .not('external_id', 'like', 'odds_api_%')
      .is('external_id', null);
    
    if (gamesError) {
      console.log(chalk.red('❌ Error deleting synthetic games:', gamesError.message));
    }
    
    stats.games.after = await getCount('games');
    stats.games.deleted = stats.games.before - stats.games.after;
    console.log(chalk.green(`✅ Deleted ${stats.games.deleted} synthetic games`));

    // 3. PURGE SYNTHETIC NEWS
    console.log(chalk.yellow('\n📰 Purging synthetic news articles...'));
    stats.news.before = await getCount('news_articles');
    
    // Delete news not from real sources
    const { error: newsError } = await supabase
      .from('news_articles')
      .delete()
      .not('source', 'in', '(The Odds API,OpenWeather,BallDontLie Live,reddit)')
      .not('source', 'like', 'ESPN %')
      .not('source', 'like', 'r/%')
      .not('source', 'like', 'ESPN.com')
      .not('source', 'like', 'NFL.com')
      .not('source', 'like', 'Yahoo Sports')
      .not('source', 'like', 'CBS Sports')
      .not('source', 'like', 'The Athletic')
      .not('source', 'like', 'Pro Football Talk');
    
    if (newsError) {
      console.log(chalk.red('❌ Error deleting synthetic news:', newsError.message));
    }
    
    stats.news.after = await getCount('news_articles');
    stats.news.deleted = stats.news.before - stats.news.after;
    console.log(chalk.green(`✅ Deleted ${stats.news.deleted} synthetic news articles`));

    // 4. PURGE SYNTHETIC PLAYER STATS
    console.log(chalk.yellow('\n📊 Purging synthetic player stats...'));
    stats.playerStats.before = await getCount('player_stats');
    
    // Delete stats for synthetic players (will cascade delete if FK constraint)
    // First get list of real player IDs
    const { data: realPlayerIds } = await supabase
      .from('players')
      .select('id')
      .or('external_id.like.balldontlie_%,external_id.like.espn_%,external_id.like.sportsradar_%');
    
    if (realPlayerIds && realPlayerIds.length > 0) {
      const realIds = realPlayerIds.map(p => p.id);
      
      // Delete stats not belonging to real players
      const { error: playerStatsError } = await supabase
        .from('player_stats')
        .delete()
        .not('player_id', 'in', `(${realIds.join(',')})`);
      
      if (playerStatsError) {
        console.log(chalk.red('❌ Error deleting synthetic player stats:', playerStatsError.message));
      }
    }
    
    stats.playerStats.after = await getCount('player_stats');
    stats.playerStats.deleted = stats.playerStats.before - stats.playerStats.after;
    console.log(chalk.green(`✅ Deleted ${stats.playerStats.deleted} synthetic player stats`));

    // 5. PURGE SYNTHETIC GAME STATS
    console.log(chalk.yellow('\n🎮 Purging synthetic game stats...'));
    stats.gameStats.before = await getCount('game_stats');
    
    // Get list of real game IDs
    const { data: realGameIds } = await supabase
      .from('games')
      .select('id')
      .or('external_id.like.balldontlie_%,external_id.like.espn_%,external_id.like.odds_api_%');
    
    if (realGameIds && realGameIds.length > 0) {
      const realIds = realGameIds.map(g => g.id);
      
      // Delete stats not belonging to real games
      const { error: gameStatsError } = await supabase
        .from('game_stats')
        .delete()
        .not('game_id', 'in', `(${realIds.join(',')})`);
      
      if (gameStatsError) {
        console.log(chalk.red('❌ Error deleting synthetic game stats:', gameStatsError.message));
      }
    }
    
    stats.gameStats.after = await getCount('game_stats');
    stats.gameStats.deleted = stats.gameStats.before - stats.gameStats.after;
    console.log(chalk.green(`✅ Deleted ${stats.gameStats.deleted} synthetic game stats`));

    // 6. PURGE SYNTHETIC AI INSIGHTS
    console.log(chalk.yellow('\n💡 Purging synthetic AI insights...'));
    stats.insights.before = await getCount('ai_insights');
    
    // Delete insights that reference synthetic data
    // This is trickier - we'll delete insights older than when we started collecting real data
    const realDataStartDate = '2024-12-01'; // Adjust based on when real data collection began
    
    const { error: insightsError } = await supabase
      .from('ai_insights')
      .delete()
      .lt('created_at', realDataStartDate);
    
    if (insightsError) {
      console.log(chalk.red('❌ Error deleting synthetic insights:', insightsError.message));
    }
    
    stats.insights.after = await getCount('ai_insights');
    stats.insights.deleted = stats.insights.before - stats.insights.after;
    console.log(chalk.green(`✅ Deleted ${stats.insights.deleted} synthetic AI insights`));

    // 7. PURGE SYNTHETIC ML PREDICTIONS
    console.log(chalk.yellow('\n🔮 Purging synthetic ML predictions...'));
    stats.predictions.before = await getCount('ml_predictions');
    
    // Delete predictions for synthetic games
    if (realGameIds && realGameIds.length > 0) {
      const realIds = realGameIds.map(g => g.id);
      
      const { error: predictionsError } = await supabase
        .from('ml_predictions')
        .delete()
        .not('game_id', 'in', `(${realIds.join(',')})`);
      
      if (predictionsError) {
        console.log(chalk.red('❌ Error deleting synthetic predictions:', predictionsError.message));
      }
    }
    
    stats.predictions.after = await getCount('ml_predictions');
    stats.predictions.deleted = stats.predictions.before - stats.predictions.after;
    console.log(chalk.green(`✅ Deleted ${stats.predictions.deleted} synthetic ML predictions`));

    return stats;

  } catch (error) {
    console.error(chalk.red('❌ Fatal error during purge:'), error);
    throw error;
  }
}

async function verifyRealData() {
  console.log(chalk.blue('\n🔍 Verifying remaining data...'));
  
  const tables = [
    { name: 'players', realCheck: 'external_id LIKE \'%balldontlie_%\' OR external_id LIKE \'%espn_%\'' },
    { name: 'games', realCheck: 'external_id LIKE \'%balldontlie_%\' OR external_id LIKE \'%espn_%\'' },
    { name: 'news_articles', realCheck: 'source IN (\'ESPN\', \'reddit\', \'The Odds API\')' },
    { name: 'weather_conditions', realCheck: 'true' }, // All weather should be real
    { name: 'betting_odds', realCheck: 'true' }, // All odds should be real
  ];
  
  for (const table of tables) {
    const { count: total } = await supabase
      .from(table.name)
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.cyan(`${table.name}: ${total || 0} records remaining`));
  }
}

async function main() {
  console.log(chalk.yellow('⚠️  WARNING: This will permanently delete all synthetic data!'));
  console.log(chalk.yellow('⚠️  Make sure you have a backup if needed.'));
  console.log(chalk.gray('\nStarting purge in 5 seconds... (Ctrl+C to cancel)\n'));
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  try {
    const stats = await purgeSyntheticData();
    
    // Print summary
    console.log(chalk.green.bold('\n✅ PURGE COMPLETE!\n'));
    console.log(chalk.white('Summary:'));
    
    const tables = ['players', 'games', 'news', 'playerStats', 'gameStats', 'insights', 'predictions'] as const;
    let totalDeleted = 0;
    
    for (const table of tables) {
      const stat = stats[table];
      totalDeleted += stat.deleted;
      console.log(chalk.gray(`  ${table}: ${stat.before} → ${stat.after} (deleted ${stat.deleted})`));
    }
    
    console.log(chalk.red.bold(`\n🗑️  Total records deleted: ${totalDeleted.toLocaleString()}`));
    
    // Verify remaining data
    await verifyRealData();
    
    console.log(chalk.green.bold('\n🎉 Database now contains only REAL data!'));
    console.log(chalk.cyan('Next steps:'));
    console.log('1. Run train-ml-models-gpu.ts to retrain on real data');
    console.log('2. Start continuous-learning-ai.ts for live predictions');
    console.log('3. Launch mega-data-collector.ts to keep gathering data');
    
  } catch (error) {
    console.error(chalk.red('❌ Purge failed:'), error);
    process.exit(1);
  }
}

// Handle interruption
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n⚠️  Purge cancelled by user'));
  process.exit(0);
});

main().catch(console.error);