#!/usr/bin/env tsx
/**
 * 🔍 INVESTIGATE TEAMS WITHOUT PLAYERS
 * Find out what these 331 teams are
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateEmptyTeams() {
  console.log(chalk.bold.blue('\n🔍 INVESTIGATING TEAMS WITHOUT PLAYERS\n'));
  
  // Get all teams
  const { data: allTeams } = await supabase
    .from('teams')
    .select('id, name, sport_id, league_id, external_id, created_at')
    .order('sport_id, name');
  
  if (!allTeams) return;
  
  // Find teams without players
  const emptyTeams: any[] = [];
  
  for (const team of allTeams) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id);
    
    if (!count || count === 0) {
      emptyTeams.push(team);
    }
  }
  
  console.log(chalk.yellow(`Found ${emptyTeams.length} teams without players\n`));
  
  // Group by sport
  const bySport: { [key: string]: any[] } = {};
  emptyTeams.forEach(team => {
    const sport = team.sport_id || 'unknown';
    if (!bySport[sport]) bySport[sport] = [];
    bySport[sport].push(team);
  });
  
  // Display by sport
  console.log(chalk.cyan('BREAKDOWN BY SPORT:\n'));
  
  Object.entries(bySport)
    .sort(([_, teams1], [__, teams2]) => teams2.length - teams1.length)
    .forEach(([sport, teams]) => {
      console.log(chalk.yellow(`${sport}: ${teams.length} empty teams`));
      
      // Show first few examples
      if (teams.length > 0) {
        console.log(chalk.gray('  Examples:'));
        teams.slice(0, 5).forEach(team => {
          console.log(chalk.gray(`    - ${team.name} (ID: ${team.id}, External: ${team.external_id || 'null'})`));
        });
        if (teams.length > 5) {
          console.log(chalk.gray(`    ... and ${teams.length - 5} more`));
        }
      }
      console.log();
    });
  
  // Check for patterns
  console.log(chalk.cyan('PATTERN ANALYSIS:\n'));
  
  // NCAA teams
  const ncaaTeams = emptyTeams.filter(t => 
    t.sport_id?.includes('ncaa') || 
    t.sport_id?.includes('college') ||
    t.league_id?.includes('ncaa')
  );
  console.log(chalk.white(`NCAA/College teams: ${ncaaTeams.length}`));
  
  // Teams with null external_id
  const noExternalId = emptyTeams.filter(t => !t.external_id);
  console.log(chalk.white(`Teams without external_id: ${noExternalId.length}`));
  
  // Old teams (created more than 30 days ago)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const oldTeams = emptyTeams.filter(t => 
    new Date(t.created_at) < thirtyDaysAgo
  );
  console.log(chalk.white(`Teams created >30 days ago: ${oldTeams.length}`));
  
  // Professional sports empty teams
  const proSports = ['nba', 'nfl', 'mlb', 'nhl'];
  const proEmptyTeams = emptyTeams.filter(t => proSports.includes(t.sport_id));
  if (proEmptyTeams.length > 0) {
    console.log(chalk.red(`\n⚠️  Professional sports with empty teams: ${proEmptyTeams.length}`));
    proEmptyTeams.forEach(team => {
      console.log(chalk.red(`  ${team.sport_id}: ${team.name}`));
    });
  }
  
  // Recommendations
  console.log(chalk.yellow('\n💡 RECOMMENDATIONS:\n'));
  
  if (ncaaTeams.length > 0) {
    console.log(chalk.cyan('1. NCAA/College teams:'));
    console.log(chalk.white('   These are likely teams we haven\'t collected rosters for yet.'));
    console.log(chalk.white('   Action: Run NCAA collectors for more teams if needed.\n'));
  }
  
  if (noExternalId.length > 0) {
    console.log(chalk.cyan('2. Teams without external_id:'));
    console.log(chalk.white('   These might be manually created or from old imports.'));
    console.log(chalk.white('   Action: Consider removing if not needed.\n'));
  }
  
  if (oldTeams.length > 0) {
    console.log(chalk.cyan('3. Old teams:'));
    console.log(chalk.white('   These are from previous runs or imports.'));
    console.log(chalk.white('   Action: Clean up if they\'re duplicates or test data.\n'));
  }
}

investigateEmptyTeams().catch(console.error);