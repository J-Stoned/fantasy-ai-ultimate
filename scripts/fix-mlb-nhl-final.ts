#!/usr/bin/env tsx
/**
 * 🔧 FIX MLB & NHL FINAL ISSUES
 * 
 * - Remove Bradley Braves from MLB (not an MLB team)
 * - Consolidate Vegas Golden Knights duplicates
 * - Fix Florida Panthers ESPN ID
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixMLBNHL() {
  console.log(chalk.bold.cyan('🔧 FIXING MLB & NHL FINAL ISSUES\n'));
  
  // 1. Remove Bradley Braves from MLB
  console.log(chalk.yellow('⚾ MLB: Removing Bradley Braves (not an MLB team)...'));
  
  // Check if it has any data
  const { count: bradleyGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .or('home_team_id.eq.71,away_team_id.eq.71');
    
  const { count: bradleyPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', 71);
    
  console.log(chalk.gray(`  Bradley Braves has ${bradleyGames} games, ${bradleyPlayers} players`));
  
  if (!bradleyGames && !bradleyPlayers) {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', 71);
      
    if (error) {
      console.error(chalk.red(`  Error deleting Bradley Braves: ${error.message}`));
    } else {
      console.log(chalk.green('  ✅ Deleted Bradley Braves'));
    }
  } else {
    console.log(chalk.yellow('  ⚠️  Bradley Braves has data, skipping deletion'));
  }
  
  // 2. Consolidate Vegas Golden Knights
  console.log(chalk.yellow('\n🏒 NHL: Consolidating Vegas Golden Knights...'));
  
  // Keep the one with the standard ID (37 is their actual NHL ID)
  const keepVegas = { id: 809324, external_id: 'espn_nhl_37' };
  const oldVegas = { id: 163, external_id: 'espn_nhl_32' };
  
  // Migrate all references
  await supabase.from('players').update({ team_id: keepVegas.id }).eq('team_id', oldVegas.id);
  await supabase.from('player_game_logs').update({ team_id: keepVegas.id }).eq('team_id', oldVegas.id);
  await supabase.from('games').update({ home_team_id: keepVegas.id }).eq('home_team_id', oldVegas.id);
  await supabase.from('games').update({ away_team_id: keepVegas.id }).eq('away_team_id', oldVegas.id);
  await supabase.from('team_synergy_stats').update({ team_id: keepVegas.id }).eq('team_id', oldVegas.id);
  
  // Delete the old entry
  const { error: vegasError } = await supabase
    .from('teams')
    .delete()
    .eq('id', oldVegas.id);
    
  if (vegasError) {
    console.error(chalk.red(`  Error deleting old Vegas: ${vegasError.message}`));
  } else {
    console.log(chalk.green('  ✅ Consolidated Vegas Golden Knights'));
  }
  
  // 3. Fix Florida Panthers
  console.log(chalk.yellow('\n🏒 NHL: Fixing Florida Panthers...'));
  
  // Find the Panthers with ESPN ID
  const { data: panthersWithEspn } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', 'NHL')
    .eq('name', 'Florida Panthers')
    .not('external_id', 'is', null)
    .single();
    
  if (panthersWithEspn) {
    // Migrate from the one without ESPN ID
    await supabase.from('players').update({ team_id: panthersWithEspn.id }).eq('team_id', 809307);
    await supabase.from('player_game_logs').update({ team_id: panthersWithEspn.id }).eq('team_id', 809307);
    await supabase.from('games').update({ home_team_id: panthersWithEspn.id }).eq('home_team_id', 809307);
    await supabase.from('games').update({ away_team_id: panthersWithEspn.id }).eq('away_team_id', 809307);
    await supabase.from('team_synergy_stats').update({ team_id: panthersWithEspn.id }).eq('team_id', 809307);
    
    // Delete the one without ESPN ID
    const { error: panthersError } = await supabase
      .from('teams')
      .delete()
      .eq('id', 809307);
      
    if (panthersError) {
      console.error(chalk.red(`  Error deleting old Panthers: ${panthersError.message}`));
    } else {
      console.log(chalk.green(`  ✅ Consolidated Florida Panthers to ID ${panthersWithEspn.id}`));
    }
  } else {
    // If no Panthers with ESPN ID exists, update the existing one
    const { error } = await supabase
      .from('teams')
      .update({ external_id: 'espn_nhl_13' }) // Florida Panthers ESPN ID
      .eq('id', 809307);
      
    if (error) {
      console.error(chalk.red(`  Error updating Panthers: ${error.message}`));
    } else {
      console.log(chalk.green('  ✅ Added ESPN ID to Florida Panthers'));
    }
  }
  
  // Final verification
  console.log(chalk.bold.cyan('\n📊 FINAL VERIFICATION:'));
  
  const { count: mlbCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB');
    
  const { count: nhlCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NHL');
    
  const { count: nhlWithEspn } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NHL')
    .not('external_id', 'is', null);
    
  console.log(chalk.white(`MLB teams: ${mlbCount} (expected 30)`));
  console.log(chalk.white(`NHL teams: ${nhlCount} (expected 32)`));
  console.log(chalk.white(`NHL teams with ESPN IDs: ${nhlWithEspn}`));
  
  const mlbStatus = mlbCount === 30 ? '✅' : '❌';
  const nhlStatus = nhlCount === 32 && nhlWithEspn === 32 ? '✅' : '❌';
  
  console.log(chalk.white(`\n${mlbStatus} MLB fixed`));
  console.log(chalk.white(`${nhlStatus} NHL fixed`));
}

fixMLBNHL().catch(console.error);