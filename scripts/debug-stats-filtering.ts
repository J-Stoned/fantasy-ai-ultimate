#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugStatsFiltering() {
  console.log(chalk.bold.cyan('🔍 Debugging Stats Filtering Logic'));
  console.log(chalk.gray('='.repeat(60)));

  // First, let's get the actual method the turbo collector uses
  console.log(chalk.cyan('Step 1: Getting games with stats using turbo collector method...'));
  
  const gamesWithStats = new Set<number>();
  let offset = 0;
  
  while (true) {
    const { data } = await supabase
      .from('player_stats')
      .select('game_id')
      .range(offset, offset + 50000);
    
    if (!data || data.length === 0) break;
    
    data.forEach(s => gamesWithStats.add(s.game_id));
    offset += 50000;
    
    console.log(chalk.gray(`  Processed ${offset} stats records...`));
  }
  
  console.log(chalk.green(`Found ${gamesWithStats.size} games with stats`));
  
  // Now let's get some sample games and check their stats
  console.log(chalk.cyan('\nStep 2: Testing sample games...'));
  
  const { data: sampleGames } = await supabase
    .from('games')
    .select('id, home_score, away_score')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .limit(10);
  
  for (const game of sampleGames || []) {
    const hasStats = gamesWithStats.has(game.id);
    
    // Double check by querying directly
    const { count } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', game.id);
    
    console.log(chalk.white(`Game ${game.id}: Set says ${hasStats ? 'HAS' : 'NO'} stats, actual count: ${count}`));
    
    if (hasStats !== (count && count > 0)) {
      console.log(chalk.red(`  ⚠️  MISMATCH! Set and actual count disagree`));
    }
  }
  
  // Let's also check if there are any null game_ids in player_stats
  console.log(chalk.cyan('\nStep 3: Checking for null game_ids...'));
  
  const { count: nullGameIds } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .is('game_id', null);
  
  console.log(chalk.white(`Player stats with null game_id: ${nullGameIds || 0}`));
  
  // Check the data types
  console.log(chalk.cyan('\nStep 4: Sample game_id values...'));
  
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(10);
  
  console.log(chalk.white('Sample game_ids from player_stats:'));
  sampleStats?.forEach(s => {
    console.log(chalk.gray(`  ${s.game_id} (type: ${typeof s.game_id})`));
  });
  
  console.log(chalk.white('Sample game_ids from games:'));
  sampleGames?.forEach(g => {
    console.log(chalk.gray(`  ${g.id} (type: ${typeof g.id})`));
  });
}

debugStatsFiltering().catch(console.error);