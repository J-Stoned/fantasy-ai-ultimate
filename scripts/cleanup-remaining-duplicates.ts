#!/usr/bin/env tsx
/**
 * 🧹 CLEANUP REMAINING DUPLICATE TEAMS
 * Remove the rest of the old duplicate teams
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanupRemainingDuplicates() {
  console.log(chalk.bold.blue('\n🧹 CLEANUP REMAINING DUPLICATES\n'));
  
  // Get all teams
  const { data: allTeams } = await supabase
    .from('teams')
    .select('*')
    .order('sport_id, name');
  
  if (!allTeams) return;
  
  // Find empty professional sport teams
  const toDelete: any[] = [];
  const proSports = ['nba', 'nfl', 'mlb', 'nhl'];
  
  console.log(chalk.yellow('Finding empty professional sport teams...\n'));
  
  for (const team of allTeams) {
    if (proSports.includes(team.sport_id)) {
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id);
      
      if (!count || count === 0) {
        // These are definitely old duplicates since we just collected all pro teams
        toDelete.push(team);
      }
    }
  }
  
  console.log(chalk.yellow(`Found ${toDelete.length} professional sport teams without players\n`));
  
  // Group by sport
  const bySport: { [key: string]: any[] } = {};
  toDelete.forEach(team => {
    if (!bySport[team.sport_id]) bySport[team.sport_id] = [];
    bySport[team.sport_id].push(team);
  });
  
  Object.entries(bySport).forEach(([sport, teams]) => {
    console.log(chalk.cyan(`${sport.toUpperCase()}: ${teams.length} teams to delete`));
    teams.slice(0, 5).forEach(team => {
      console.log(chalk.gray(`  - ${team.name} (External: ${team.external_id})`));
    });
    if (teams.length > 5) {
      console.log(chalk.gray(`  ... and ${teams.length - 5} more`));
    }
    console.log();
  });
  
  console.log(chalk.yellow('Proceeding with deletion...\n'));
  
  // Delete all of them
  let deleted = 0;
  let errors = 0;
  
  for (const team of toDelete) {
    // Double-check no players or games
    const { count: playerCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id);
    
    const { count: homeGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('home_team_id', team.id);
    
    const { count: awayGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('away_team_id', team.id);
    
    if ((!playerCount || playerCount === 0) && 
        (!homeGames || homeGames === 0) && 
        (!awayGames || awayGames === 0)) {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', team.id);
      
      if (!error) {
        deleted++;
        process.stdout.write(chalk.green('.'));
      } else {
        errors++;
        process.stdout.write(chalk.red('x'));
        console.error(`\nError deleting ${team.name}:`, error);
      }
    } else {
      process.stdout.write(chalk.yellow('s')); // Skipped
    }
  }
  
  console.log(chalk.green(`\n\n✅ Deleted ${deleted} teams`));
  if (errors > 0) {
    console.log(chalk.red(`❌ Errors: ${errors}`));
  }
  
  // Final summary
  const { count: finalTeamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true });
  
  // Count by sport
  const sportCounts: { [key: string]: number } = {};
  for (const sport of proSports) {
    const { count } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport);
    
    if (count) sportCounts[sport] = count;
  }
  
  console.log(chalk.cyan('\n📊 FINAL TEAM COUNTS:'));
  console.log(chalk.white(`Total teams: ${finalTeamCount}`));
  console.log(chalk.white('\nProfessional sports:'));
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(chalk.white(`  ${sport.toUpperCase()}: ${count} teams`));
  });
}

cleanupRemainingDuplicates().catch(console.error);