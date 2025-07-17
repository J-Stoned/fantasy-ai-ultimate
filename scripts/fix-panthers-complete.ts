#!/usr/bin/env tsx
/**
 * Complete fix for Florida Panthers
 * - Handle ALL references including team_synergy_stats
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function completePanthersFix() {
  console.log(chalk.bold.cyan('🔧 COMPLETE FLORIDA PANTHERS FIX\n'));
  
  const oldId = 145;  // Corrupted team
  const correctId = 809307;  // Correct NHL Florida Panthers
  
  // 1. First, check if we already migrated the games (to avoid duplicate work)
  const { count: oldGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .or(`home_team_id.eq.${oldId},away_team_id.eq.${oldId}`);
    
  if (oldGames === 0) {
    console.log(chalk.yellow('Games already migrated, continuing with cleanup...'));
  }
  
  // 2. Migrate team synergy stats
  console.log(chalk.yellow('\n1. Migrating team synergy stats...'));
  const { data: synStats } = await supabase
    .from('team_synergy_stats')
    .update({ team_id: correctId })
    .eq('team_id', oldId)
    .select();
    
  console.log(chalk.green(`  ✅ Updated ${synStats?.length || 0} synergy stats`));
  
  // 3. Check for any other references
  console.log(chalk.yellow('\n2. Checking for other references...'));
  
  // Enhanced synergies
  const { data: enhSyn } = await supabase
    .from('enhanced_synergies')
    .update({ team_id: correctId })
    .eq('team_id', oldId)
    .select();
    
  if (enhSyn && enhSyn.length > 0) {
    console.log(chalk.green(`  ✅ Updated ${enhSyn.length} enhanced synergies`));
  }
  
  // 4. Now delete the corrupted team
  console.log(chalk.yellow('\n3. Deleting corrupted team...'));
  const { error: deleteError } = await supabase
    .from('teams')
    .delete()
    .eq('id', oldId);
    
  if (!deleteError) {
    console.log(chalk.green('  ✅ Deleted corrupted team 145'));
  } else {
    console.error(chalk.red(`  Error: ${deleteError.message}`));
    
    // If still can't delete, check what's holding it
    console.log(chalk.yellow('\n  Checking remaining references...'));
    
    const tables = ['players', 'games', 'player_game_logs', 'team_synergy_stats', 'enhanced_synergies'];
    for (const table of tables) {
      let query = supabase.from(table).select('*', { count: 'exact', head: true });
      
      if (table === 'games') {
        query = query.or(`home_team_id.eq.${oldId},away_team_id.eq.${oldId}`);
      } else if (table === 'player_game_logs') {
        query = query.or(`team_id.eq.${oldId},opponent_id.eq.${oldId}`);
      } else {
        query = query.eq('team_id', oldId);
      }
      
      const { count } = await query;
      if (count && count > 0) {
        console.log(chalk.red(`    - ${table}: ${count} references`));
      }
    }
  }
  
  // 5. Add ESPN ID to the correct team
  console.log(chalk.yellow('\n4. Adding ESPN ID to correct team...'));
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
  
  // Check NHL teams without ESPN IDs
  const { data: nhlWithoutEspn } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('sport', 'NHL')
    .is('external_id', null);
    
  if (nhlWithoutEspn && nhlWithoutEspn.length > 0) {
    console.log(chalk.red('\nNHL teams still missing ESPN IDs:'));
    nhlWithoutEspn.forEach(t => {
      console.log(chalk.red(`  - ${t.name} (ID: ${t.id})`));
    });
  }
}

completePanthersFix().catch(console.error);