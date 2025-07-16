#!/usr/bin/env tsx
/**
 * Check current stats collection progress
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkProgress() {
  console.log(chalk.bold.cyan('📊 STATS COLLECTION PROGRESS CHECK\n'));
  
  // Total stats
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.yellow(`Total player_game_logs: ${totalStats?.toLocaleString() || 0}`));
  
  // Check by sport
  const sports = ['NBA', 'NFL', 'NHL', 'MLB'];
  
  for (const sport of sports) {
    // Get games for this sport
    const { data: games } = await supabase
      .from('games')
      .select('id')
      .or(`sport_id.eq.${sport.toLowerCase()},sport_id.eq.${sport}`)
      .eq('status', 'completed');
      
    if (games && games.length > 0) {
      const gameIds = games.map(g => g.id);
      
      // Count stats for these games
      const { count: sportStats } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .in('game_id', gameIds);
        
      // Count games
      const { count: gameCount } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .or(`sport_id.eq.${sport.toLowerCase()},sport_id.eq.${sport}`)
        .eq('status', 'completed');
        
      console.log(chalk.white(`\n${sport}:`));
      console.log(chalk.gray(`  Games: ${gameCount?.toLocaleString() || 0}`));
      console.log(chalk.gray(`  Stats: ${sportStats?.toLocaleString() || 0}`));
      console.log(chalk.gray(`  Avg per game: ${gameCount ? ((sportStats || 0) / gameCount).toFixed(1) : 0}`));
    }
  }
  
  // Phase 3 targets
  console.log(chalk.bold.green('\n📈 Phase 3 Progress:'));
  console.log(chalk.white('  NBA: Target 15K+ stats'));
  console.log(chalk.white('  NFL: Target 25K+ stats'));
  console.log(chalk.white('  NHL: Target 50K+ stats'));
  console.log(chalk.white('  MLB: Target 100K+ stats'));
  console.log(chalk.yellow(`  TOTAL TARGET: 190K+ stats`));
  console.log(chalk.cyan(`  CURRENT TOTAL: ${totalStats?.toLocaleString() || 0} stats`));
  
  if ((totalStats || 0) >= 190000) {
    console.log(chalk.bold.green('\n🎯 PHASE 3 TARGET ACHIEVED! 🎯'));
  } else {
    console.log(chalk.red(`\n📊 Still need ${(190000 - (totalStats || 0)).toLocaleString()} more stats`));
  }
}

checkProgress().catch(console.error);