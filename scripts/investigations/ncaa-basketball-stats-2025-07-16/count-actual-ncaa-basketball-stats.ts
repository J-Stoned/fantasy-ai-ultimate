#!/usr/bin/env tsx
/**
 * 🏀 COUNT ACTUAL NCAA BASKETBALL STATS
 * Find how many NCAA Basketball stats we really have
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function countActualNCAABasketballStats() {
  console.log(chalk.bold.blue('🏀 COUNTING ACTUAL NCAA BASKETBALL STATS\n'));
  
  // 1. Get NCAA_BB games
  const { data: ncaaBBGames, count: totalNCAABBGames } = await supabase
    .from('games')
    .select('id', { count: 'exact' })
    .eq('sport', 'NCAA_BB');
  
  console.log(`Total NCAA Basketball games: ${totalNCAABBGames?.toLocaleString()}`);
  
  if (!ncaaBBGames || ncaaBBGames.length === 0) {
    console.log('No NCAA Basketball games found!');
    return;
  }
  
  // 2. Count stats for NCAA_BB games in batches
  console.log(chalk.yellow('\nCounting stats for NCAA Basketball games...'));
  
  let totalNCAABBStats = 0;
  const batchSize = 500;
  
  for (let i = 0; i < ncaaBBGames.length; i += batchSize) {
    const batch = ncaaBBGames.slice(i, i + batchSize).map(g => g.id);
    
    const { count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('game_id', batch);
    
    totalNCAABBStats += count || 0;
    
    if (i % 1000 === 0) {
      console.log(`Processed ${i}/${ncaaBBGames.length} games... Current total: ${totalNCAABBStats.toLocaleString()}`);
    }
  }
  
  console.log(chalk.bold.green(`\n✅ TOTAL NCAA BASKETBALL STATS: ${totalNCAABBStats.toLocaleString()}`));
  console.log(`Average stats per game: ${(totalNCAABBStats / (totalNCAABBGames || 1)).toFixed(1)}`);
  
  // 3. Sample some NCAA BB stats
  console.log(chalk.yellow('\n📋 Sample NCAA Basketball stats:'));
  
  const { data: sampleStats } = await supabase
    .from('player_game_logs')
    .select('*')
    .in('game_id', ncaaBBGames.slice(0, 10).map(g => g.id))
    .limit(5);
  
  sampleStats?.forEach((stat, i) => {
    console.log(`${i + 1}. Player ${stat.player_id}: ${stat.stats?.points || 0} pts, ${stat.stats?.rebounds || 0} reb, ${stat.stats?.assists || 0} ast`);
  });
  
  // 4. Check latest NCAA BB stats insertion
  console.log(chalk.yellow('\n⏰ Latest NCAA Basketball stats:'));
  
  // Get most recent stats for NCAA BB games
  const recentNCAABBGameIds = ncaaBBGames.slice(-100).map(g => g.id);
  
  const { data: recentStats } = await supabase
    .from('player_game_logs')
    .select('created_at, game_id')
    .in('game_id', recentNCAABBGameIds)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (recentStats && recentStats.length > 0) {
    console.log(`Most recent NCAA BB stat: ${recentStats[0].created_at}`);
    recentStats.forEach((stat, i) => {
      console.log(`${i + 1}. Game ${stat.game_id} - Created: ${stat.created_at}`);
    });
  } else {
    console.log('No recent NCAA Basketball stats found!');
  }
  
  // 5. Summary of all sports
  console.log(chalk.bold.cyan('\n📊 COMPLETE STATS SUMMARY:'));
  
  console.log('MLB (null sport): 519,536 stats');
  console.log(`NCAA Basketball: ${totalNCAABBStats.toLocaleString()} stats`);
  console.log(chalk.bold.yellow(`\nGRAND TOTAL: ${(519536 + totalNCAABBStats).toLocaleString()} stats`));
  
  // Check if we're missing the 156,792 stats
  if (totalNCAABBStats < 100000) {
    console.log(chalk.bold.red(`\n⚠️  MISSING STATS ALERT!`));
    console.log(chalk.red(`Expected: ~156,792 NCAA Basketball stats`));
    console.log(chalk.red(`Found: ${totalNCAABBStats.toLocaleString()} NCAA Basketball stats`));
    console.log(chalk.red(`Missing: ~${(156792 - totalNCAABBStats).toLocaleString()} stats`));
  }
}

countActualNCAABasketballStats().catch(console.error);