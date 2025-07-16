#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkNFLTeamCoverage() {
  console.log(chalk.blue.bold('🏈 CHECKING NFL TEAM COVERAGE\n'));
  
  // Get all NFL teams
  const { data: allTeams } = await supabase
    .from('teams')
    .select('id, name, abbreviation')
    .eq('sport', 'NFL')
    .order('name');
  
  console.log(`📊 Total NFL teams in database: ${allTeams?.length || 0}`);
  
  // Get teams with players
  const { data: teamsWithPlayers } = await supabase
    .from('players')
    .select('team')
    .eq('sport', 'NFL')
    .neq('team', null);
  
  const teamsHavingPlayers = [...new Set(teamsWithPlayers?.map(p => p.team) || [])];
  console.log(`✅ Teams with players: ${teamsHavingPlayers.length}`);
  
  // Find missing teams
  const allTeamAbbrevs = allTeams?.map(t => t.abbreviation) || [];
  const missingTeams = allTeamAbbrevs.filter(abbrev => !teamsHavingPlayers.includes(abbrev));
  
  console.log(`❌ Missing teams: ${missingTeams.length}`);
  
  if (missingTeams.length > 0) {
    console.log(chalk.red('\nTeams that need players collected:'));
    const missingTeamDetails = allTeams?.filter(t => missingTeams.includes(t.abbreviation));
    missingTeamDetails?.forEach(team => {
      console.log(chalk.red(`  • ${team.name} (${team.abbreviation}) - ID: ${team.id}`));
    });
  } else {
    console.log(chalk.green('\n🎉 ALL NFL TEAMS HAVE PLAYERS!'));
  }
  
  // Show player counts per team
  console.log(chalk.blue('\n📊 Player counts by team:'));
  for (const team of teamsHavingPlayers.sort()) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NFL')
      .eq('team', team);
    
    console.log(`  ${team}: ${count || 0} players`);
  }
}

checkNFLTeamCoverage().then(() => process.exit(0)).catch(console.error);