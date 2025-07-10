#!/usr/bin/env tsx
/**
 * 🔧 FIX MLB TEAMS PROPERLY
 * Delete incorrect entries and keep proper ones
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixMLBTeams() {
  console.log(chalk.bold.blue('\n🔧 FIXING MLB TEAMS\n'));
  
  // Get all MLB teams
  const { data: mlbTeams } = await supabase
    .from('teams')
    .select('*')
    .eq('sport_id', 'mlb')
    .order('name');
  
  if (!mlbTeams) return;
  
  console.log(chalk.yellow(`Found ${mlbTeams.length} MLB teams\n`));
  
  // Identify teams to delete
  const toDelete = [
    'Athletics Athletics',
    'Athletics',
    'Arizona D-backs'
  ];
  
  // Process deletions
  for (const teamName of toDelete) {
    const team = mlbTeams.find(t => t.name === teamName);
    if (team) {
      console.log(chalk.yellow(`\nProcessing "${teamName}" (ID: ${team.id})`));
      
      // Check for players
      const { count: playerCount } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id);
      
      if (playerCount && playerCount > 0) {
        // Find the correct team to migrate to
        let targetTeam = null;
        if (teamName.includes('Athletics')) {
          targetTeam = mlbTeams.find(t => t.name === 'Oakland Athletics');
        } else if (teamName === 'Arizona D-backs') {
          targetTeam = mlbTeams.find(t => t.name === 'Arizona Diamondbacks');
        }
        
        if (targetTeam) {
          console.log(chalk.cyan(`  Migrating ${playerCount} players to ${targetTeam.name}...`));
          const { error } = await supabase
            .from('players')
            .update({ team_id: targetTeam.id })
            .eq('team_id', team.id);
          
          if (!error) {
            console.log(chalk.green(`  ✓ Migrated players`));
          }
        }
      }
      
      // Delete the team
      console.log(chalk.yellow(`  Deleting team...`));
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', team.id);
      
      if (error) {
        console.error(chalk.red(`  ❌ Error: ${error.message}`));
      } else {
        console.log(chalk.green(`  ✓ Deleted`));
      }
    }
  }
  
  // Final count and display
  const { count: finalCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'mlb');
  
  console.log(chalk.bold.green(`\n✅ MLB teams after cleanup: ${finalCount}`));
  
  // Show all teams
  const { data: finalTeams } = await supabase
    .from('teams')
    .select('name, abbreviation, external_id')
    .eq('sport_id', 'mlb')
    .order('name');
  
  if (finalTeams) {
    console.log(chalk.cyan('\nAll MLB teams:'));
    finalTeams.forEach(team => {
      console.log(`  ${team.name} (${team.abbreviation})`);
    });
  }
}

fixMLBTeams().catch(console.error);