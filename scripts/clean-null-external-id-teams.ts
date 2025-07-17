#!/usr/bin/env tsx
/**
 * Clean up teams with NULL external_ids
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanNullExternalIdTeams() {
  console.log(chalk.bold.blue('CLEANING TEAMS WITH NULL EXTERNAL_IDS\n'));
  
  // Get all teams with NULL external_id
  const { data: nullTeams, count } = await supabase
    .from('teams')
    .select('id, name, sport', { count: 'exact' })
    .is('external_id', null);
    
  console.log(`Found ${count} teams with NULL external_id`);
  
  // Group by sport
  const bySport: Record<string, typeof nullTeams> = {};
  nullTeams?.forEach(team => {
    const sport = team.sport || 'NULL_SPORT';
    if (!bySport[sport]) bySport[sport] = [];
    bySport[sport].push(team);
  });
  
  console.log('\nBreakdown by sport:');
  Object.entries(bySport).forEach(([sport, teams]) => {
    console.log(`  ${sport}: ${teams.length} teams`);
  });
  
  // Check which teams have no associations and can be safely deleted
  console.log(chalk.yellow('\nChecking for safe deletions...'));
  
  const teamsToDelete: number[] = [];
  const teamsToKeep: Array<{id: number, name: string, reason: string}> = [];
  
  for (const team of nullTeams || []) {
    // Check for players
    const { count: playerCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id);
      
    // Check for home games
    const { count: homeGameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('home_team_id', team.id);
      
    // Check for away games
    const { count: awayGameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('away_team_id', team.id);
      
    const totalAssociations = (playerCount || 0) + (homeGameCount || 0) + (awayGameCount || 0);
    
    if (totalAssociations === 0) {
      teamsToDelete.push(team.id);
    } else {
      teamsToKeep.push({
        id: team.id,
        name: team.name,
        reason: `${playerCount} players, ${(homeGameCount || 0) + (awayGameCount || 0)} games`
      });
    }
    
    // Progress indicator
    if (teamsToDelete.length + teamsToKeep.length > 0 && 
        (teamsToDelete.length + teamsToKeep.length) % 50 === 0) {
      console.log(`  Checked ${teamsToDelete.length + teamsToKeep.length}/${count} teams...`);
    }
  }
  
  console.log(chalk.green(`\n✅ Can safely delete: ${teamsToDelete.length} teams`));
  console.log(chalk.yellow(`⚠️  Must keep: ${teamsToKeep.length} teams (have associations)`));
  
  if (teamsToKeep.length > 0 && teamsToKeep.length <= 10) {
    console.log('\nTeams to keep:');
    teamsToKeep.forEach(t => console.log(`  ${t.name}: ${t.reason}`));
  }
  
  // Delete teams with no associations
  if (teamsToDelete.length > 0) {
    console.log(chalk.yellow(`\nDeleting ${teamsToDelete.length} teams...`));
    
    // Delete in larger batches with better approach
    const batchSize = 50;
    let deleted = 0;
    
    for (let i = 0; i < teamsToDelete.length; i += batchSize) {
      const batch = teamsToDelete.slice(i, i + batchSize);
      
      const { error, count: deleteCount } = await supabase
        .from('teams')
        .delete()
        .in('id', batch);
        
      if (error) {
        console.error(chalk.red(`Error deleting batch ${i/batchSize + 1}:`), error.message);
      } else {
        deleted += deleteCount || 0;
        console.log(`  Progress: ${deleted}/${teamsToDelete.length} deleted...`);
      }
    }
    
    console.log(chalk.green(`✅ Successfully deleted ${deleted} teams`));
  }
  
  // Final count
  const { count: remaining } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null);
    
  console.log(chalk.cyan(`\n📊 Remaining teams with NULL external_id: ${remaining}`));
}

cleanNullExternalIdTeams().catch(console.error);