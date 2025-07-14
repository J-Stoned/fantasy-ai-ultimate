#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import chalk from 'chalk';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugGameIssue() {
  console.log(chalk.bold.cyan('🔍 Debugging Real Data Collector Issue'));
  
  // 1. Check if game exists
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('*')
    .eq('external_id', 'espn_nba_401584802')
    .single();
  
  console.log('\n🎮 Game espn_nba_401584802 exists?', game ? chalk.green('YES') : chalk.red('NO'));
  if (gameError && gameError.code !== 'PGRST116') {
    console.log(chalk.red('Game query error:'), gameError);
  }
  if (game) {
    console.log(chalk.gray('Game data:'), {
      id: game.id,
      home_team_id: game.home_team_id,
      away_team_id: game.away_team_id,
      home_score: game.home_score,
      away_score: game.away_score,
      status: game.status
    });
  }
  
  // 2. Check NBA teams
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, abbreviation, sport, external_id')
    .eq('sport', 'NBA')
    .order('name');
  
  console.log(chalk.bold.blue('\n🏀 NBA Teams in database:'), teams?.length || 0);
  if (teams && teams.length > 0) {
    console.log('First 5 teams:');
    teams.slice(0, 5).forEach(team => {
      console.log(chalk.gray(`  - ${team.name} (${team.abbreviation}) - ID: ${team.id}, External: ${team.external_id}`));
    });
  }
  
  // 3. Check for specific teams (from the game)
  const teamNames = ['Los Angeles Lakers', 'Miami Heat'];
  
  for (const teamName of teamNames) {
    const { data: team, error } = await supabase
      .from('teams')
      .select('*')
      .eq('name', teamName)
      .eq('sport', 'NBA')
      .single();
    
    if (team) {
      console.log(chalk.green(`\n✅ ${teamName} exists:`) + ` ID: ${team.id}, External: ${team.external_id}`);
    } else {
      console.log(chalk.red(`\n❌ ${teamName} NOT FOUND`));
      if (error) console.log(chalk.red('Error:'), error.message);
    }
  }
  
  // 4. Test upsert on games table
  console.log(chalk.bold.yellow('\n🧪 Testing game upsert...'));
  
  const testGameData = {
    external_id: 'espn_nba_401584802',
    sport: 'NBA',
    home_team_id: null,
    away_team_id: null,
    home_score: 110,
    away_score: 96,
    game_date: '2024-01-10T00:30:00Z',
    status: 'completed'
  };
  
  const { data: upsertResult, error: upsertError } = await supabase
    .from('games')
    .upsert(testGameData)
    .select('id, external_id')
    .single();
  
  if (upsertError) {
    console.log(chalk.red('❌ Upsert failed:'), upsertError);
    console.log(chalk.red('Error details:'), {
      message: upsertError.message,
      code: upsertError.code,
      details: upsertError.details,
      hint: upsertError.hint
    });
  } else {
    console.log(chalk.green('✅ Upsert successful:'), upsertResult);
  }
  
  // 5. Check table constraints
  console.log(chalk.bold.cyan('\n📋 Checking for potential issues...'));
  
  // Check if there are any unique constraints
  const { data: gameCount } = await supabase
    .from('games')
    .select('external_id', { count: 'exact', head: true })
    .eq('external_id', 'espn_nba_401584802');
  
  console.log('Games with this external_id:', gameCount);
  
  // 6. Check actual game table schema
  console.log(chalk.bold.blue('\n📊 Checking games table structure...'));
  const { data: sampleGame } = await supabase
    .from('games')
    .select('*')
    .limit(1)
    .single();
  
  if (sampleGame) {
    console.log('Games table columns:', Object.keys(sampleGame));
    console.log('Sample game data:', {
      ...sampleGame,
      created_at: sampleGame.created_at ? '...' : null,
      updated_at: sampleGame.updated_at ? '...' : null
    });
  }
  
  // 7. Check player_game_logs table
  console.log(chalk.bold.blue('\n📊 Checking player_game_logs table...'));
  const { data: logs, error: logsError } = await supabase
    .from('player_game_logs')
    .select('*')
    .limit(1);
  
  if (logsError) {
    console.log(chalk.red('player_game_logs error:'), logsError.message);
    // Maybe table doesn't exist, let's check player_stats
    console.log(chalk.yellow('\n🔄 Checking player_stats table instead...'));
    const { data: stats, error: statsError } = await supabase
      .from('player_stats')
      .select('*')
      .limit(1);
    
    if (statsError) {
      console.log(chalk.red('player_stats error:'), statsError.message);
    } else if (stats && stats.length > 0) {
      console.log(chalk.green('player_stats table exists!'));
      console.log('Columns:', Object.keys(stats[0]));
    }
  } else if (logs && logs.length > 0) {
    console.log(chalk.green('player_game_logs table exists!'));
    console.log('Columns:', Object.keys(logs[0]));
  }
}

debugGameIssue().catch(console.error);