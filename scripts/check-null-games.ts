#!/usr/bin/env tsx
/**
 * Check for NULL values in games and player_game_logs
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNullValues() {
  console.log(chalk.bold.cyan('🔍 CHECKING FOR NULL VALUES IN DATABASE\n'));

  // Check games table
  console.log(chalk.yellow('Checking games table...'));
  
  const { data: nullGames } = await supabase
    .from('games')
    .select('id, external_id, start_time, home_team_id, away_team_id')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01')
    .or('start_time.is.null,external_id.is.null,home_team_id.is.null,away_team_id.is.null');

  if (nullGames && nullGames.length > 0) {
    console.log(chalk.red(`Found ${nullGames.length} games with NULL values!`));
    nullGames.slice(0, 5).forEach(g => {
      console.log(chalk.gray(`  Game ${g.id}: start_time=${g.start_time}, external_id=${g.external_id}, home=${g.home_team_id}, away=${g.away_team_id}`));
    });
  } else {
    console.log(chalk.green('✅ No NULL values in games table'));
  }

  // Check player_game_logs
  console.log(chalk.yellow('\nChecking player_game_logs table...'));
  
  const { data: games } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01');

  const gameIds = games?.map(g => g.id) || [];

  const { data: nullStats, count: nullCount } = await supabase
    .from('player_game_logs')
    .select('id, player_id, game_id, game_date, team_id', { count: 'exact' })
    .in('game_id', gameIds)
    .or('game_date.is.null,team_id.is.null')
    .limit(10);

  if (nullCount && nullCount > 0) {
    console.log(chalk.red(`Found ${nullCount} player_game_logs with NULL values!`));
    nullStats?.forEach(s => {
      console.log(chalk.gray(`  Stat ${s.id}: player=${s.player_id}, game=${s.game_id}, date=${s.game_date}, team=${s.team_id}`));
    });
  } else {
    console.log(chalk.green('✅ No NULL values in player_game_logs'));
  }

  // Check for stats without proper game_date
  console.log(chalk.yellow('\nChecking for stats with default dates...'));
  
  const { count: defaultDateCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', gameIds)
    .eq('game_date', '2021-01-01');

  if (defaultDateCount && defaultDateCount > 0) {
    console.log(chalk.red(`Found ${defaultDateCount} stats with default date '2021-01-01'!`));
  }

  // Get proper game dates
  console.log(chalk.yellow('\nSample of actual game dates:'));
  const { data: sampleGames } = await supabase
    .from('games')
    .select('id, start_time')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01')
    .limit(5);

  sampleGames?.forEach(g => {
    const date = new Date(g.start_time).toISOString().split('T')[0];
    console.log(chalk.gray(`  Game ${g.id}: ${date}`));
  });
}

checkNullValues().catch(console.error);