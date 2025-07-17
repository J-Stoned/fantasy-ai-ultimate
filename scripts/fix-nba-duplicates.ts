#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixNBADuplicates() {
  console.log(chalk.bold.blue('FIXING NBA TEAM DUPLICATES\n'));
  
  // Get all NBA teams
  const { data: allTeams } = await supabase
    .from('teams')
    .select('id, external_id, name, sport')
    .eq('sport', 'NBA')
    .order('external_id');
    
  // Group by team name to find duplicates
  const teamsByName: Record<string, typeof allTeams> = {};
  
  allTeams?.forEach(team => {
    const name = team.name;
    if (!teamsByName[name]) teamsByName[name] = [];
    teamsByName[name].push(team);
  });
  
  // Find teams with duplicates
  console.log('Teams with duplicates:');
  let duplicatesToRemove = [];
  
  for (const [name, teams] of Object.entries(teamsByName)) {
    if (teams.length > 1) {
      console.log(`\n${name}:`);
      teams.forEach(t => console.log(`  ID: ${t.id}, external_id: ${t.external_id}`));
      
      // Keep the one with correct format, delete others
      const correctOne = teams.find(t => t.external_id?.startsWith('espn_nba_'));
      const wrongOnes = teams.filter(t => t !== correctOne);
      
      if (correctOne && wrongOnes.length > 0) {
        console.log(chalk.green(`  → Keeping: ${correctOne.external_id}`));
        wrongOnes.forEach(w => {
          console.log(chalk.red(`  → Removing: ${w.external_id || 'null'}`));
          duplicatesToRemove.push(w.id);
        });
      }
    }
  }
  
  // Remove duplicates
  if (duplicatesToRemove.length > 0) {
    console.log(chalk.yellow(`\nRemoving ${duplicatesToRemove.length} duplicate teams...`));
    
    const { error } = await supabase
      .from('teams')
      .delete()
      .in('id', duplicatesToRemove);
      
    if (error) {
      console.error('Error removing duplicates:', error);
    } else {
      console.log(chalk.green('✅ Duplicates removed!'));
    }
  }
  
  // Verify
  const { count } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');
    
  console.log(chalk.cyan(`\nFinal NBA team count: ${count}`));
  
  // Check if all are compliant now
  const { count: nonCompliant } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA')
    .not('external_id', 'like', 'espn_nba_%');
    
  if (nonCompliant === 0) {
    console.log(chalk.green('✅ All NBA teams now compliant!'));
  } else {
    console.log(chalk.red(`❌ Still ${nonCompliant} non-compliant NBA teams`));
  }
}

fixNBADuplicates().catch(console.error);