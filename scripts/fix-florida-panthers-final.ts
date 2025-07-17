#!/usr/bin/env tsx
/**
 * Fix Florida Panthers ESPN ID issue
 * - Remove incorrect NFL Florida Panthers
 * - Add correct ESPN ID to NHL Florida Panthers
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixFloridaPanthers() {
  console.log(chalk.bold.cyan('🔧 FIXING FLORIDA PANTHERS\n'));
  
  // 1. Remove the NFL Florida Panthers (doesn't exist in NFL)
  console.log(chalk.yellow('1. Removing incorrect NFL Florida Panthers...'));
  
  // Check if it has any data
  const { count: nflPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', 145);
    
  const { count: nflGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .or('home_team_id.eq.145,away_team_id.eq.145');
    
  console.log(chalk.gray(`  NFL Florida Panthers has ${nflPlayers} players, ${nflGames} games`));
  
  if (!nflPlayers && !nflGames) {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', 145);
      
    if (!error) {
      console.log(chalk.green('  ✅ Deleted NFL Florida Panthers'));
    } else {
      console.error(chalk.red(`  Error: ${error.message}`));
    }
  }
  
  // 2. Add ESPN ID to NHL Florida Panthers
  console.log(chalk.yellow('\n2. Adding ESPN ID to NHL Florida Panthers...'));
  
  const { error: updateError } = await supabase
    .from('teams')
    .update({ external_id: 'espn_nhl_4' })
    .eq('id', 809307);
    
  if (!updateError) {
    console.log(chalk.green('  ✅ Added espn_nhl_4 to NHL Florida Panthers'));
  } else {
    console.error(chalk.red(`  Error: ${updateError.message}`));
  }
  
  // 3. Final verification
  console.log(chalk.bold.cyan('\n📊 FINAL NHL VERIFICATION'));
  
  const { count: nhlTotal } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NHL');
    
  const { count: nhlWithEspn } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NHL')
    .not('external_id', 'is', null);
    
  const status = nhlTotal === 32 && nhlWithEspn === 32 ? '✅' : '❌';
  console.log(chalk.white(`${status} NHL: ${nhlTotal} teams (${nhlWithEspn} with ESPN IDs)`));
}

fixFloridaPanthers().catch(console.error);