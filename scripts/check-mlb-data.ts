#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMLBData() {
  console.log(chalk.bold.blue('\n⚾ MLB DATA CHECK\n'));
  
  // Check MLB teams
  const { count: teamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'mlb');
  
  console.log(chalk.yellow(`MLB teams in database: ${teamCount}`));
  
  // Check MLB players
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'mlb');
  
  console.log(chalk.yellow(`MLB players in database: ${playerCount}`));
  
  // Check latest MLB players
  const { data: latestPlayers } = await supabase
    .from('players')
    .select('id, firstname, lastname, team, created_at')
    .eq('sport_id', 'mlb')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (latestPlayers && latestPlayers.length > 0) {
    console.log(chalk.green('\nLatest MLB players:'));
    latestPlayers.forEach(p => {
      console.log(chalk.white(`  ${p.firstname} ${p.lastname} - ${p.team}`));
    });
  } else {
    console.log(chalk.red('\nNo MLB players found!'));
  }
  
  // Show teams
  const { data: teams } = await supabase
    .from('teams')
    .select('name, abbreviation, external_id')
    .eq('sport_id', 'mlb')
    .order('name')
    .limit(10);
  
  if (teams && teams.length > 0) {
    console.log(chalk.green('\nSample MLB Teams:'));
    teams.forEach(t => {
      console.log(chalk.white(`  ${t.name} (${t.abbreviation}) - ${t.external_id}`));
    });
  }
  
  // Check for duplicates or short names
  const { data: allTeams } = await supabase
    .from('teams')
    .select('name')
    .eq('sport_id', 'mlb');
  
  if (allTeams) {
    const shortNames = allTeams.filter(t => !t.name.includes(' '));
    if (shortNames.length > 0) {
      console.log(chalk.yellow('\n⚠️  Teams with short names:'));
      shortNames.forEach(t => console.log(chalk.yellow(`  ${t.name}`)));
    }
  }
}

checkMLBData().catch(console.error);