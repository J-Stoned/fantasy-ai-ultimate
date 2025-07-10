#!/usr/bin/env tsx
/**
 * 🧹 CLEANUP OLD DUPLICATE TEAMS
 * Remove teams without players that are duplicates from old runs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanupOldDuplicateTeams() {
  console.log(chalk.bold.blue('\n🧹 CLEANUP OLD DUPLICATE TEAMS\n'));
  
  // Get all teams
  const { data: allTeams } = await supabase
    .from('teams')
    .select('*')
    .order('sport_id, name');
  
  if (!allTeams) return;
  
  // Find empty teams
  const emptyTeams: any[] = [];
  
  console.log(chalk.yellow('Finding teams without players...\n'));
  
  for (const team of allTeams) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id);
    
    if (!count || count === 0) {
      emptyTeams.push(team);
    }
  }
  
  console.log(chalk.cyan(`Found ${emptyTeams.length} teams without players\n`));
  
  // Identify duplicates to delete
  const toDelete: any[] = [];
  const proSports = ['nba', 'nfl', 'mlb', 'nhl'];
  
  // For professional sports, delete teams with old external_id formats
  for (const team of emptyTeams) {
    if (proSports.includes(team.sport_id)) {
      // Keep teams with espn_ prefix or mlb_ prefix (current format)
      // Delete teams with just sport_ prefix (old format)
      if (team.external_id) {
        const isOldFormat = 
          (team.external_id.startsWith('nhl_') && !team.external_id.startsWith('espn_nhl_')) ||
          (team.external_id.startsWith('nba_') && !team.external_id.startsWith('espn_nba_')) ||
          (team.external_id.startsWith('nfl_') && !team.external_id.startsWith('espn_nfl_')) ||
          (team.external_id.startsWith('espn_') && team.sport_id === 'nfl'); // Old NFL format
        
        if (isOldFormat) {
          toDelete.push(team);
        }
      }
    }
  }
  
  console.log(chalk.yellow(`Identified ${toDelete.length} old duplicate teams to delete:\n`));
  
  // Group by sport for display
  const bySport: { [key: string]: any[] } = {};
  toDelete.forEach(team => {
    if (!bySport[team.sport_id]) bySport[team.sport_id] = [];
    bySport[team.sport_id].push(team);
  });
  
  Object.entries(bySport).forEach(([sport, teams]) => {
    console.log(chalk.cyan(`${sport.toUpperCase()}: ${teams.length} teams`));
    teams.slice(0, 5).forEach(team => {
      console.log(chalk.gray(`  - ${team.name} (External: ${team.external_id})`));
    });
    if (teams.length > 5) {
      console.log(chalk.gray(`  ... and ${teams.length - 5} more`));
    }
    console.log();
  });
  
  // Ask for confirmation
  console.log(chalk.yellow('Proceeding with deletion...\n'));
  
  // Delete the teams
  let deleted = 0;
  for (const team of toDelete) {
    // Double-check no players
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id);
    
    if (!count || count === 0) {
      // Check for game references
      const { count: homeGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('home_team_id', team.id);
      
      const { count: awayGames } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('away_team_id', team.id);
      
      if ((!homeGames || homeGames === 0) && (!awayGames || awayGames === 0)) {
        // Safe to delete
        const { error } = await supabase
          .from('teams')
          .delete()
          .eq('id', team.id);
        
        if (!error) {
          deleted++;
          process.stdout.write(chalk.green('.'));
        } else {
          process.stdout.write(chalk.red('x'));
        }
      } else {
        process.stdout.write(chalk.yellow('g')); // Has games
      }
    } else {
      process.stdout.write(chalk.yellow('p')); // Has players
    }
  }
  
  console.log(chalk.green(`\n\n✅ Deleted ${deleted} old duplicate teams`));
  
  // Final count - count teams without players
  let remainingEmpty = 0;
  const { data: remainingTeams } = await supabase
    .from('teams')
    .select('id, sport_id');
  
  if (remainingTeams) {
    for (const team of remainingTeams) {
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id);
      
      if (!count || count === 0) {
        remainingEmpty++;
      }
    }
  }
  
  console.log(chalk.cyan(`\nRemaining teams without players: ${remainingEmpty}`));
  
  // NCAA teams summary
  let ncaaEmpty = 0;
  if (remainingTeams) {
    for (const team of remainingTeams) {
      if (team.sport_id?.includes('ncaa') || team.sport_id?.includes('college')) {
        const { count } = await supabase
          .from('players')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.id);
        
        if (!count || count === 0) {
          ncaaEmpty++;
        }
      }
    }
  }
  
  console.log(chalk.gray(`  NCAA/College teams: ${ncaaEmpty || 0}`));
  console.log(chalk.gray(`  Other: ${(remainingEmpty || 0) - (ncaaEmpty || 0)}`));
}

cleanupOldDuplicateTeams().catch(console.error);