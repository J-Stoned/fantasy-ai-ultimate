#!/usr/bin/env tsx
/**
 * 🏀 QUICK NCAA BASKETBALL STATS CHECK
 * Fast analysis without hitting query limits
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function quickNCAABasketballStatsCheck() {
  console.log(chalk.bold.blue('🏀 QUICK NCAA BASKETBALL STATS CHECK\n'));
  
  // 1. Get total counts efficiently
  console.log(chalk.yellow('1. Database Summary:'));
  
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  const { count: ncaaGamesCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BB');
  
  const { count: ncaaPlayersCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BB');
  
  console.log(`Total stats in database: ${totalStats?.toLocaleString()}`);
  console.log(`NCAA Basketball games: ${ncaaGamesCount?.toLocaleString()}`);
  console.log(`NCAA Basketball players: ${ncaaPlayersCount?.toLocaleString()}`);
  
  // 2. Sample 10 games to estimate stats
  console.log(chalk.yellow('\n2. Sampling NCAA Basketball stats:'));
  
  const { data: sampleGames } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NCAA_BB')
    .limit(10);
  
  let totalSampleStats = 0;
  let gamesWithStats = 0;
  
  if (sampleGames) {
    for (const game of sampleGames) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if (count && count > 0) {
        totalSampleStats += count;
        gamesWithStats++;
      }
    }
  }
  
  const avgStatsPerGame = gamesWithStats > 0 ? totalSampleStats / gamesWithStats : 0;
  const estimatedTotalNCAAStats = Math.round(avgStatsPerGame * (ncaaGamesCount || 0));
  
  console.log(`Sample size: 10 games`);
  console.log(`Games with stats: ${gamesWithStats}/10`);
  console.log(`Average stats per game: ${avgStatsPerGame.toFixed(1)}`);
  console.log(`Estimated total NCAA stats: ${estimatedTotalNCAAStats.toLocaleString()}`);
  
  // 3. Check the collection log
  console.log(chalk.yellow('\n3. Collection Status:'));
  console.log(`Expected from collection: 156,792 stats`);
  console.log(`Current estimate: ${estimatedTotalNCAAStats.toLocaleString()} stats`);
  console.log(chalk.red(`Potential missing: ~${Math.max(0, 156792 - estimatedTotalNCAAStats).toLocaleString()} stats`));
  
  // 4. Quick recommendation
  console.log(chalk.bold.green('\n💡 QUICK ANALYSIS:'));
  
  if (avgStatsPerGame < 20) {
    console.log(chalk.red('⚠️  Stats collection appears incomplete!'));
    console.log(`Only ${avgStatsPerGame.toFixed(1)} stats per game (expected ~29)`);
    console.log('\nRECOMMENDATION: Re-run the collection script');
    console.log('The script will check for existing stats and only add missing ones.');
  } else {
    console.log(chalk.green('✅ Stats collection appears mostly complete!'));
    console.log(`${avgStatsPerGame.toFixed(1)} stats per game is reasonable`);
  }
  
  // 5. Show next steps
  console.log(chalk.yellow('\n📋 Next Steps:'));
  console.log('1. Run: npx tsx scripts/collect-ncaa-basketball-stats.ts');
  console.log('   (It will skip existing stats automatically)');
  console.log('2. The script will only insert missing stats');
  console.log('3. Monitor the log file for progress');
}

quickNCAABasketballStatsCheck().catch(console.error);