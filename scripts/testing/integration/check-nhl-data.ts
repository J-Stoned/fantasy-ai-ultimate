#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNHLData() {
  console.log(chalk.bold.blue('\n🏒 NHL DATA CHECK\n'));
  
  // Check NHL teams
  const { count: teamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nhl');
  
  console.log(chalk.yellow(`NHL teams in database: ${teamCount}`));
  
  // Check NHL players
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nhl');
  
  console.log(chalk.yellow(`NHL players in database: ${playerCount}`));
  
  // Check latest NHL players
  const { data: latestPlayers } = await supabase
    .from('players')
    .select('id, firstname, lastname, team, created_at')
    .eq('sport_id', 'nhl')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (latestPlayers && latestPlayers.length > 0) {
    console.log(chalk.green('\nLatest NHL players:'));
    latestPlayers.forEach(p => {
      console.log(chalk.white(`  ${p.firstname} ${p.lastname} - ${p.team}`));
    });
  } else {
    console.log(chalk.red('\nNo NHL players found!'));
  }
  
  // Show teams
  const { data: teams } = await supabase
    .from('teams')
    .select('name, abbreviation, external_id')
    .eq('sport_id', 'nhl')
    .order('name')
    .limit(10);
  
  if (teams && teams.length > 0) {
    console.log(chalk.green('\nSample NHL Teams:'));
    teams.forEach(t => {
      console.log(chalk.white(`  ${t.name} (${t.abbreviation}) - ${t.external_id}`));
    });
    
    console.log(chalk.gray(`\n  ... and ${teamCount! - 10} more teams`));
  }
  
  // Check for any short name teams
  const { data: allTeams } = await supabase
    .from('teams')
    .select('name')
    .eq('sport_id', 'nhl');
  
  if (allTeams) {
    const shortNames = allTeams.filter(t => 
      !t.name.includes(' ') || 
      ['Avalanche', 'Lightning', 'Wild', 'Predators', 'Blues', 'Stars', 'Sharks', 'Ducks', 'Kings', 'Flames', 'Oilers', 'Canucks', 'Jets'].some(short => t.name === short)
    );
    
    if (shortNames.length > 0) {
      console.log(chalk.yellow('\n⚠️  Teams that might be short names:'));
      shortNames.forEach(t => console.log(chalk.yellow(`  ${t.name}`)));
    } else {
      console.log(chalk.green('\n✅ All NHL teams have full names'));
    }
  }
}

checkNHLData().catch(console.error);