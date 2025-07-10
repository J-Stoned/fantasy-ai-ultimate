#!/usr/bin/env tsx
/**
 * 🔍 INVESTIGATE EXTRA NHL TEAM
 * Find out why we have 33 teams instead of 32
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateNHLTeams() {
  console.log(chalk.bold.blue('\n🔍 INVESTIGATING NHL TEAMS\n'));
  
  // Get all NHL teams
  const { data: nhlTeams, error } = await supabase
    .from('teams')
    .select('*')
    .eq('sport_id', 'nhl')
    .order('name');
  
  if (error || !nhlTeams) {
    console.error('Error fetching teams:', error);
    return;
  }
  
  console.log(chalk.yellow(`Total NHL teams: ${nhlTeams.length}\n`));
  
  // List all teams
  console.log(chalk.cyan('All NHL teams:'));
  nhlTeams.forEach((team, index) => {
    console.log(`${index + 1}. ${team.name} (${team.abbreviation}) - External: ${team.external_id}`);
  });
  
  // Check for duplicates
  console.log(chalk.cyan('\n\nChecking for duplicates...'));
  const nameCount: { [key: string]: number } = {};
  nhlTeams.forEach(team => {
    nameCount[team.name] = (nameCount[team.name] || 0) + 1;
  });
  
  const duplicates = Object.entries(nameCount).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log(chalk.red('\nFound duplicates:'));
    duplicates.forEach(([name, count]) => {
      console.log(`  ${name}: ${count} copies`);
    });
  } else {
    console.log(chalk.green('\nNo duplicate team names found'));
  }
  
  // Check for unusual teams
  console.log(chalk.cyan('\n\nChecking for unusual teams...'));
  
  // Check for Winnipeg Jets (moved from Atlanta)
  const jets = nhlTeams.filter(t => t.name.includes('Jets'));
  console.log(`\nJets teams: ${jets.length}`);
  jets.forEach(t => console.log(`  ${t.name} - ${t.external_id}`));
  
  // Check for Arizona/Utah (recent relocation)
  const arizonaUtah = nhlTeams.filter(t => 
    t.name.includes('Coyotes') || 
    t.name.includes('Utah') || 
    t.name.includes('Mammoth')
  );
  console.log(`\nArizona/Utah teams: ${arizonaUtah.length}`);
  arizonaUtah.forEach(t => console.log(`  ${t.name} - ${t.external_id}`));
  
  // Check for teams with no players
  console.log(chalk.cyan('\n\nChecking which teams have players...'));
  
  let teamsWithoutPlayers = 0;
  for (const team of nhlTeams) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id);
    
    if (!count || count === 0) {
      console.log(chalk.yellow(`  ${team.name} has 0 players`));
      teamsWithoutPlayers++;
    }
  }
  
  console.log(chalk.cyan(`\nTeams without players: ${teamsWithoutPlayers}`));
}

investigateNHLTeams().catch(console.error);