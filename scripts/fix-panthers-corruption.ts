#!/usr/bin/env tsx
/**
 * Fix Florida Panthers data corruption
 * - Team 145 is wrongly marked as NFL but has NHL data
 * - Team 809307 is the correct NHL Florida Panthers without ESPN ID
 * - Migrate all references from 145 to 809307
 * - Delete team 145
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixPanthersCorruption() {
  console.log(chalk.bold.cyan('🔧 FIXING FLORIDA PANTHERS DATA CORRUPTION\n'));
  
  const oldId = 145;  // Corrupted team (marked as NFL but has NHL data)
  const correctId = 809307;  // Correct NHL Florida Panthers
  
  // 1. Migrate all game references
  console.log(chalk.yellow('1. Migrating game references...'));
  
  // Home games
  const { data: homeGames, error: homeError } = await supabase
    .from('games')
    .update({ home_team_id: correctId })
    .eq('home_team_id', oldId)
    .select();
    
  if (!homeError) {
    console.log(chalk.green(`  ✅ Updated ${homeGames?.length || 0} home games`));
  }
  
  // Away games
  const { data: awayGames, error: awayError } = await supabase
    .from('games')
    .update({ away_team_id: correctId })
    .eq('away_team_id', oldId)
    .select();
    
  if (!awayError) {
    console.log(chalk.green(`  ✅ Updated ${awayGames?.length || 0} away games`));
  }
  
  // 2. Migrate any player references (shouldn't be any)
  console.log(chalk.yellow('\n2. Checking for player references...'));
  const { data: players } = await supabase
    .from('players')
    .update({ team_id: correctId })
    .eq('team_id', oldId)
    .select();
    
  console.log(chalk.green(`  ✅ Updated ${players?.length || 0} players`));
  
  // 3. Migrate player game logs
  console.log(chalk.yellow('\n3. Migrating player game log references...'));
  
  // Team references
  const { data: teamLogs } = await supabase
    .from('player_game_logs')
    .update({ team_id: correctId })
    .eq('team_id', oldId)
    .select();
    
  console.log(chalk.green(`  ✅ Updated ${teamLogs?.length || 0} team references`));
  
  // Opponent references
  const { data: oppLogs } = await supabase
    .from('player_game_logs')
    .update({ opponent_id: correctId })
    .eq('opponent_id', oldId)
    .select();
    
  console.log(chalk.green(`  ✅ Updated ${oppLogs?.length || 0} opponent references`));
  
  // 4. Delete the corrupted team
  console.log(chalk.yellow('\n4. Deleting corrupted team...'));
  const { error: deleteError } = await supabase
    .from('teams')
    .delete()
    .eq('id', oldId);
    
  if (!deleteError) {
    console.log(chalk.green('  ✅ Deleted corrupted team 145'));
  } else {
    console.error(chalk.red(`  Error: ${deleteError.message}`));
  }
  
  // 5. Add ESPN ID to the correct team
  console.log(chalk.yellow('\n5. Adding ESPN ID to correct team...'));
  const { error: updateError } = await supabase
    .from('teams')
    .update({ external_id: 'espn_nhl_4' })
    .eq('id', correctId);
    
  if (!updateError) {
    console.log(chalk.green('  ✅ Added espn_nhl_4 to team 809307'));
  } else {
    console.error(chalk.red(`  Error: ${updateError.message}`));
  }
  
  // 6. Final verification
  console.log(chalk.bold.cyan('\n📊 FINAL VERIFICATION'));
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  const expected: Record<string, number> = {
    'NFL': 32,
    'NBA': 30,
    'MLB': 30,
    'NHL': 32
  };
  
  for (const sport of sports) {
    const { count: total } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
      
    const { count: withEspn } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .not('external_id', 'is', null);
      
    const isCorrect = total === expected[sport] && total === withEspn;
    const status = isCorrect ? '✅' : '❌';
    
    console.log(chalk.white(`${status} ${sport}: ${total} teams (${withEspn} with ESPN IDs, expected ${expected[sport]})`));
  }
}

fixPanthersCorruption().catch(console.error);