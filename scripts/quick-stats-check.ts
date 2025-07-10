#!/usr/bin/env tsx
/**
 * Quick check on stats insertion
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function quickCheck() {
  console.log(chalk.blue('\n=== QUICK STATS CHECK ===\n'));
  
  // Get total unique games with stats
  const { data: allStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .order('created_at', { ascending: false })
    .limit(10000);
  
  const uniqueGames = new Set(allStats?.map(s => s.game_id) || []);
  console.log(chalk.cyan('Unique games with stats:'), uniqueGames.size);
  
  // Check recent insertions
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: recentStats } = await supabase
    .from('player_stats')
    .select('game_id, stat_type, created_at')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (recentStats && recentStats.length > 0) {
    const recentGames = new Set(recentStats.map(s => s.game_id));
    console.log(chalk.green(`\n✓ Stats are being inserted! ${recentStats.length} stats for ${recentGames.size} games in last hour`));
    
    // Show sample
    console.log(chalk.yellow('\nSample recent stats:'));
    const gameGroups = new Map();
    recentStats.slice(0, 20).forEach(stat => {
      if (!gameGroups.has(stat.game_id)) {
        gameGroups.set(stat.game_id, []);
      }
      gameGroups.get(stat.game_id).push(stat.stat_type);
    });
    
    Array.from(gameGroups.entries()).slice(0, 3).forEach(([gameId, types]) => {
      console.log(`  Game ${gameId}: ${types.length} stats (${types.slice(0, 3).join(', ')}...)`);
    });
  }
  
  // Check if collector is running now
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count: veryRecent } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', fiveMinutesAgo);
  
  if (veryRecent && veryRecent > 0) {
    console.log(chalk.bgGreen.black(`\n🚀 COLLECTOR IS ACTIVE! ${veryRecent} stats in last 5 minutes`));
  } else {
    console.log(chalk.yellow('\n⚠️  No stats in last 5 minutes - collector might be idle'));
  }
  
  // Get actual game coverage
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
  
  const actualCoverage = ((uniqueGames.size / (totalGames || 1)) * 100).toFixed(1);
  console.log(chalk.cyan(`\nActual Coverage: ${uniqueGames.size}/${totalGames} games (${actualCoverage}%)`));
}

quickCheck().catch(console.error);