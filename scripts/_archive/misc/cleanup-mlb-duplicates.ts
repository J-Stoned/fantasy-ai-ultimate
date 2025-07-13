#!/usr/bin/env tsx
/**
 * 🧹 CLEANUP MLB DUPLICATE TEAMS
 * Fix team names and consolidate duplicates
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Correct MLB team names
const CORRECT_NAMES: { [key: string]: string } = {
  'Athletics Athletics': 'Oakland Athletics',
  'Athletics': 'Oakland Athletics',
  'Arizona D-backs': 'Arizona Diamondbacks',
};

async function cleanupMLBDuplicates() {
  console.log(chalk.bold.blue('\n🧹 MLB TEAM CLEANUP\n'));
  
  // Get all MLB teams
  const { data: mlbTeams } = await supabase
    .from('teams')
    .select('*')
    .eq('sport_id', 'mlb')
    .order('name');
  
  if (!mlbTeams) return;
  
  console.log(chalk.yellow(`Found ${mlbTeams.length} MLB teams\n`));
  
  // First, fix incorrect names
  console.log(chalk.cyan('Fixing incorrect team names...\n'));
  
  for (const team of mlbTeams) {
    const correctName = CORRECT_NAMES[team.name];
    if (correctName && team.name !== correctName) {
      console.log(chalk.yellow(`Updating "${team.name}" → "${correctName}"`));
      
      try {
        const { error } = await supabase
          .from('teams')
          .update({ name: correctName })
          .eq('id', team.id);
        
        if (error) {
          console.error(chalk.red(`  Error: ${error.message}`));
        } else {
          console.log(chalk.green(`  ✓ Updated`));
        }
      } catch (err) {
        console.error(chalk.red(`  Error: ${err}`));
      }
    }
  }
  
  // Re-fetch teams after name updates
  const { data: updatedTeams } = await supabase
    .from('teams')
    .select('*')
    .eq('sport_id', 'mlb')
    .order('name');
  
  if (!updatedTeams) return;
  
  // Find duplicates
  console.log(chalk.cyan('\n\nFinding duplicates...\n'));
  
  const teamsByName: { [key: string]: any[] } = {};
  updatedTeams.forEach(team => {
    if (!teamsByName[team.name]) teamsByName[team.name] = [];
    teamsByName[team.name].push(team);
  });
  
  // Process duplicates
  for (const [name, teams] of Object.entries(teamsByName)) {
    if (teams.length > 1) {
      console.log(chalk.yellow(`\nFound ${teams.length} teams named "${name}"`));
      
      // Keep the one with external_id starting with mlb_
      const primaryTeam = teams.find(t => t.external_id?.startsWith('mlb_')) || teams[0];
      const duplicates = teams.filter(t => t.id !== primaryTeam.id);
      
      console.log(chalk.cyan(`  Keeping team ID ${primaryTeam.id} (${primaryTeam.external_id})`));
      
      for (const dup of duplicates) {
        console.log(chalk.gray(`  Removing duplicate ID ${dup.id} (${dup.external_id})`));
        
        // Check for players
        const { count: playerCount } = await supabase
          .from('players')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', dup.id);
        
        if (playerCount && playerCount > 0) {
          // Migrate players
          console.log(chalk.yellow(`    Migrating ${playerCount} players...`));
          await supabase
            .from('players')
            .update({ team_id: primaryTeam.id })
            .eq('team_id', dup.id);
        }
        
        // Update game references
        await supabase.from('games').update({ home_team_id: primaryTeam.id }).eq('home_team_id', dup.id);
        await supabase.from('games').update({ away_team_id: primaryTeam.id }).eq('away_team_id', dup.id);
        
        // Delete duplicate
        const { error } = await supabase
          .from('teams')
          .delete()
          .eq('id', dup.id);
        
        if (!error) {
          console.log(chalk.green(`    ✓ Deleted duplicate`));
        }
      }
    }
  }
  
  // Final count
  const { count: finalCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'mlb');
  
  console.log(chalk.bold.green(`\n✅ Cleanup complete! MLB teams: ${finalCount}`));
  
  // Show final teams
  const { data: finalTeams } = await supabase
    .from('teams')
    .select('name, abbreviation')
    .eq('sport_id', 'mlb')
    .order('name')
    .limit(10);
  
  if (finalTeams) {
    console.log(chalk.cyan('\nSample MLB teams:'));
    finalTeams.forEach(team => {
      console.log(`  ${team.name} (${team.abbreviation})`);
    });
  }
}

cleanupMLBDuplicates().catch(console.error);