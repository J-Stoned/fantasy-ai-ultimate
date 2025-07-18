#!/usr/bin/env tsx
/**
 * 🧹 CLEAN NCAA TEAM DUPLICATES
 * 
 * Fixes NCAAF → NCAA_FB and NCAAB → NCAA_BB
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanNCAADuplicates() {
  console.log(chalk.cyan('\n🧹 NCAA TEAM DUPLICATE CLEANUP\n'));
  
  // 1. Get current state
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, sport, external_id')
    .in('sport', ['NCAAF', 'NCAAB', 'NCAA_FB', 'NCAA_BB']);
    
  const counts = teams?.reduce((acc, team) => {
    acc[team.sport] = (acc[team.sport] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  
  console.log(chalk.yellow('Current state:'));
  Object.entries(counts).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count} teams`);
  });
  
  // 2. Check for games using old sport names
  const { data: oldGames, count: oldGameCount } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .in('sport', ['NCAAF', 'NCAAB']);
    
  console.log(chalk.yellow(`\nGames with old sport names: ${oldGameCount || 0}`));
  
  // 3. Update games first
  if (oldGameCount && oldGameCount > 0) {
    console.log(chalk.yellow('\nUpdating game sport names...'));
    
    const { error: fbError } = await supabase
      .from('games')
      .update({ sport: 'NCAA_FB' })
      .eq('sport', 'NCAAF');
      
    const { error: bbError } = await supabase
      .from('games')
      .update({ sport: 'NCAA_BB' })
      .eq('sport', 'NCAAB');
      
    if (fbError || bbError) {
      console.error(chalk.red('Error updating games:'), fbError || bbError);
      return;
    }
    console.log(chalk.green('✅ Games updated'));
  }
  
  // 4. Delete duplicate teams with old sport names
  console.log(chalk.yellow('\nDeleting duplicate teams with old sport names...'));
  
  const { error: deleteError } = await supabase
    .from('teams')
    .delete()
    .in('sport', ['NCAAF', 'NCAAB']);
    
  if (deleteError) {
    console.error(chalk.red('Error deleting duplicates:'), deleteError);
    return;
  }
  
  // 5. Verify final state
  const { data: finalTeams, count: finalCount } = await supabase
    .from('teams')
    .select('sport', { count: 'exact' })
    .ilike('sport', 'NCAA%');
    
  const finalCounts = finalTeams?.reduce((acc, team) => {
    acc[team.sport] = (acc[team.sport] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  
  console.log(chalk.green('\n✅ CLEANUP COMPLETE!'));
  console.log(chalk.green('\nFinal state:'));
  Object.entries(finalCounts).forEach(([sport, count]) => {
    console.log(`  ${sport}: ${count} teams`);
  });
  console.log(`  Total NCAA teams: ${finalCount}`);
}

cleanNCAADuplicates().catch(console.error);