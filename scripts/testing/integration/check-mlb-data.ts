#\!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL\!,
  process.env.SUPABASE_SERVICE_ROLE_KEY\!
);

async function checkMLBData() {
  console.log(chalk.bold.cyan('Checking MLB data in database...\n'));

  // Check players with different sport values
  const { count: mlbPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'mlb');

  const { count: baseballPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'baseball');

  console.log(`Players with sport='mlb': ${mlbPlayers}`);
  console.log(`Players with sport='baseball': ${baseballPlayers}`);

  // Check teams
  const { data: teams, count: teamCount } = await supabase
    .from('teams')
    .select('id, name, sport', { count: 'exact' })
    .or('sport.eq.mlb,sport.eq.baseball');

  console.log(`\nTeams with sport='mlb' or 'baseball': ${teamCount}`);
  if (teams && teams.length > 0) {
    console.log('Sample teams:', teams.slice(0, 3));
  }

  // Check games
  const { count: mlbGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'mlb');

  console.log(`\nGames with sport_id='mlb': ${mlbGames}`);

  // If players are 'baseball', update them to 'mlb'
  if (baseballPlayers && baseballPlayers > 0 && \!mlbPlayers) {
    console.log(chalk.yellow('\n⚠️  Found players with sport="baseball", need to update to "mlb"'));
    
    const { error } = await supabase
      .from('players')
      .update({ sport: 'mlb' })
      .eq('sport', 'baseball');
    
    if (\!error) {
      console.log(chalk.green(`✅ Updated ${baseballPlayers} players from 'baseball' to 'mlb'`));
    } else {
      console.error(chalk.red('Error updating players:'), error);
    }
  }

  // Same for teams
  const { data: baseballTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('sport', 'baseball');

  if (baseballTeams && baseballTeams.length > 0) {
    console.log(chalk.yellow(`\n⚠️  Found ${baseballTeams.length} teams with sport="baseball", updating...`));
    
    const { error } = await supabase
      .from('teams')
      .update({ sport: 'mlb' })
      .eq('sport', 'baseball');
    
    if (\!error) {
      console.log(chalk.green(`✅ Updated ${baseballTeams.length} teams to 'mlb'`));
    }
  }
}

checkMLBData();
EOF < /dev/null
