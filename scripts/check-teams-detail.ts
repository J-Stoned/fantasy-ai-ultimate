#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTeamsDetail() {
  console.log(chalk.bold.cyan('\n🏟️  TEAMS DETAIL REPORT\n'));
  
  try {
    // Get sample of teams to see structure
    const { data: sampleTeams } = await supabase
      .from('teams')
      .select('*')
      .limit(5);
    
    console.log(chalk.yellow('Sample team structure:'));
    if (sampleTeams && sampleTeams.length > 0) {
      console.log(chalk.gray('Fields available:'), Object.keys(sampleTeams[0]).join(', '));
    }
    
    // Count teams by available fields
    const { data: teams } = await supabase
      .from('teams')
      .select('name, sport, sport_id, league, league_id, abbreviation')
      .order('name');
    
    // Group by identifying characteristics
    const sportGroups: any = {};
    teams?.forEach(team => {
      const identifier = team.sport || team.sport_id || team.league || team.league_id || 'Unknown';
      if (!sportGroups[identifier]) {
        sportGroups[identifier] = [];
      }
      sportGroups[identifier].push({
        name: team.name,
        abbr: team.abbreviation
      });
    });
    
    // Display grouped teams
    Object.entries(sportGroups).forEach(([sport, teamList]: [string, any]) => {
      console.log(chalk.yellow(`\n${sport.toUpperCase()} (${teamList.length} teams):`));
      teamList.slice(0, 10).forEach((team: any) => {
        console.log(chalk.gray(`  - ${team.name} (${team.abbr || 'N/A'})`));
      });
      if (teamList.length > 10) {
        console.log(chalk.gray(`  ... and ${teamList.length - 10} more`));
      }
    });
    
    // Check for NBA teams specifically
    console.log(chalk.yellow('\n🏀 NBA Teams Search:'));
    const { data: nbaTeams } = await supabase
      .from('teams')
      .select('name, abbreviation, sport, sport_id, league, external_id')
      .or('name.ilike.%celtics%,name.ilike.%lakers%,name.ilike.%warriors%,abbreviation.ilike.%BOS%,abbreviation.ilike.%LAL%,external_id.ilike.%nba%')
      .limit(10);
    
    if (nbaTeams && nbaTeams.length > 0) {
      console.log(chalk.green('Found NBA teams:'));
      nbaTeams.forEach(team => {
        console.log(chalk.gray(`  - ${team.name} (${team.abbreviation}) - sport: ${team.sport || team.sport_id}, external_id: ${team.external_id}`));
      });
    } else {
      console.log(chalk.red('No NBA teams found with common names/abbreviations'));
    }
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error);
  }
}

checkTeamsDetail().catch(console.error);