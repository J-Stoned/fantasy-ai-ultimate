#!/usr/bin/env tsx
/**
 * 🔍 ANALYZE DUPLICATE TEAMS
 * Find and identify duplicate teams in the database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeDuplicates() {
  console.log(chalk.bold.blue('\n🔍 ANALYZING DUPLICATE TEAMS\n'));
  
  // Get all teams
  const { data: allTeams, error } = await supabase
    .from('teams')
    .select('*')
    .order('name');
  
  if (error || !allTeams) {
    console.error('Error fetching teams:', error);
    return;
  }
  
  console.log(chalk.yellow(`Total teams in database: ${allTeams.length}`));
  
  // Group by sport
  const bySport: { [key: string]: any[] } = {};
  allTeams.forEach(team => {
    const sport = team.sport_id || team.sport || 'unknown';
    if (!bySport[sport]) bySport[sport] = [];
    bySport[sport].push(team);
  });
  
  console.log(chalk.cyan('\nTeams by sport:'));
  Object.entries(bySport).forEach(([sport, teams]) => {
    console.log(`  ${sport}: ${teams.length} teams`);
  });
  
  // Find duplicates by name within each sport
  console.log(chalk.cyan('\n\nDuplicates by name:'));
  
  Object.entries(bySport).forEach(([sport, teams]) => {
    const nameGroups: { [key: string]: any[] } = {};
    
    teams.forEach(team => {
      const key = team.name.toLowerCase();
      if (!nameGroups[key]) nameGroups[key] = [];
      nameGroups[key].push(team);
    });
    
    const duplicates = Object.entries(nameGroups).filter(([_, teams]) => teams.length > 1);
    
    if (duplicates.length > 0) {
      console.log(chalk.yellow(`\n${sport}:`));
      duplicates.forEach(([name, dups]) => {
        console.log(chalk.red(`  ${dups[0].name} (${dups.length} copies):`));
        dups.forEach(team => {
          console.log(chalk.gray(`    ID: ${team.id}, External: ${team.external_id}, Created: ${team.created_at}`));
          console.log(chalk.gray(`    Abbr: ${team.abbreviation}, City: ${team.city || 'N/A'}`));
        });
      });
    }
  });
  
  // Check NBA specific duplicates
  console.log(chalk.cyan('\n\nNBA Team Analysis:'));
  const nbaTeams = bySport['nba'] || [];
  
  // Group by external_id pattern
  const espnNBA = nbaTeams.filter(t => t.external_id?.startsWith('espn_nba_'));
  const otherNBA = nbaTeams.filter(t => !t.external_id?.startsWith('espn_nba_'));
  
  console.log(`  ESPN NBA teams: ${espnNBA.length}`);
  console.log(`  Other NBA teams: ${otherNBA.length}`);
  
  if (otherNBA.length > 0) {
    console.log(chalk.yellow('\n  Non-ESPN NBA teams:'));
    otherNBA.forEach(team => {
      console.log(`    ${team.name} - External: ${team.external_id}`);
    });
  }
  
  // Check which teams have players
  console.log(chalk.cyan('\n\nChecking which teams have players:'));
  
  for (const team of nbaTeams.slice(0, 10)) { // Check first 10 for brevity
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id);
    
    if (count && count > 0) {
      console.log(chalk.green(`  ✓ ${team.name} (ID: ${team.id}): ${count} players`));
    } else {
      console.log(chalk.gray(`  ✗ ${team.name} (ID: ${team.id}): 0 players`));
    }
  }
}

analyzeDuplicates().catch(console.error);