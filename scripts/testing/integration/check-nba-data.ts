#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNBAData() {
  console.log(chalk.bold.blue('\n🏀 NBA DATA CHECK\n'));
  
  // Check NBA teams
  const { count: teamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nba');
  
  console.log(chalk.yellow(`NBA teams in database: ${teamCount}`));
  
  // Check NBA players
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nba');
  
  console.log(chalk.yellow(`NBA players in database: ${playerCount}`));
  
  // Check latest NBA players
  const { data: latestPlayers } = await supabase
    .from('players')
    .select('id, firstname, lastname, team, created_at')
    .eq('sport_id', 'nba')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (latestPlayers && latestPlayers.length > 0) {
    console.log(chalk.green('\nLatest NBA players:'));
    latestPlayers.forEach(p => {
      console.log(chalk.white(`  ${p.firstname} ${p.lastname} - ${p.team}`));
    });
  } else {
    console.log(chalk.red('\nNo NBA players found!'));
  }
  
  // Show teams
  const { data: teams } = await supabase
    .from('teams')
    .select('name, abbreviation')
    .eq('sport_id', 'nba')
    .order('name');
  
  if (teams && teams.length > 0) {
    console.log(chalk.green('\nNBA Teams:'));
    teams.forEach(t => {
      console.log(chalk.white(`  ${t.name} (${t.abbreviation})`));
    });
  }
}

checkNBAData().catch(console.error);