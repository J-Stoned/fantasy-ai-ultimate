#!/usr/bin/env tsx
/**
 * 🔍 CHECK FINAL 2021 STATS COUNT
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkFinal2021Stats() {
  console.log(chalk.bold.cyan('🔍 CHECKING FINAL 2021 NFL STATS COUNT\n'));

  // Get all 2021 games
  const { data: games, count: gameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact' })
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01');

  console.log(chalk.yellow(`2021 NFL Games: ${gameCount}\n`));

  // Get game IDs
  const gameIds = games?.map(g => g.id) || [];

  // Count stats for these games
  const { count: statsCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', gameIds);

  const avgPerGame = Math.round((statsCount || 0) / (gameCount || 1));

  console.log(chalk.cyan(`Total 2021 Stats: ${statsCount?.toLocaleString()}`));
  console.log(chalk.bold.green(`Average per game: ${avgPerGame}`));
  console.log(chalk.yellow(`Target: 78 stats per game`));
  
  if (avgPerGame >= 78) {
    console.log(chalk.bold.green(`\n🎉 SUCCESS! We've reached ${avgPerGame} stats per game!`));
  } else {
    console.log(chalk.red(`\n❌ Still ${78 - avgPerGame} stats per game short`));
    
    // Sample analysis
    console.log(chalk.yellow('\n📊 Analyzing a sample game...'));
    
    const { data: sampleGame } = await supabase
      .from('games')
      .select('*')
      .eq('sport', 'NFL')
      .gte('start_time', '2021-09-01')
      .limit(1)
      .single();
      
    if (sampleGame) {
      const { data: gameStats } = await supabase
        .from('player_game_logs')
        .select('player_id, stats')
        .eq('game_id', sampleGame.id);
        
      console.log(chalk.gray(`\nSample game ${sampleGame.external_id}:`));
      console.log(chalk.gray(`Stats in DB: ${gameStats?.length}`));
      
      // Group by stat types
      const statTypes = new Set<string>();
      gameStats?.forEach(s => {
        Object.keys(s.stats || {}).forEach(key => statTypes.add(key));
      });
      
      console.log(chalk.gray(`Unique stat types: ${statTypes.size}`));
    }
  }

  // Check player count
  const { count: nflPlayerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL');
    
  console.log(chalk.blue(`\nTotal NFL Players: ${nflPlayerCount?.toLocaleString()}`));
}

checkFinal2021Stats().catch(console.error);