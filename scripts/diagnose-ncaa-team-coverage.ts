#!/usr/bin/env tsx
/**
 * 🔍 NCAA FOOTBALL TEAM COVERAGE DIAGNOSTIC
 * Deep dive into why we only have 12 teams with players
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnoseCoverage() {
  console.log(chalk.bold.blue('🔍 NCAA FOOTBALL TEAM COVERAGE DIAGNOSTIC\n'));
  
  // 1. Check actual player count and team distribution
  console.log('📊 Checking player distribution...');
  
  const { data: players } = await supabase
    .from('players')
    .select('id, name, team_id, external_id')
    .eq('sport_id', 'NCAA_FB');
  
  console.log(`Total players: ${players.length}`);
  
  // Group by team_id
  const teamCounts = new Map();
  players.forEach(player => {
    const count = teamCounts.get(player.team_id) || 0;
    teamCounts.set(player.team_id, count + 1);
  });
  
  console.log(`\nTeams with players: ${teamCounts.size}`);
  
  // Get team names
  const teamIds = Array.from(teamCounts.keys());
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .in('id', teamIds);
  
  console.log('\n📋 Teams with players:');
  teams.forEach(team => {
    const count = teamCounts.get(team.id);
    console.log(`${team.name} (${team.external_id}): ${count} players`);
  });
  
  // 2. Check stats to see what teams are referenced
  console.log('\n🔍 Checking stats for team coverage...');
  
  const { data: stats } = await supabase
    .from('player_game_logs')
    .select('team_id, player_id, game_id')
    .limit(1000);
  
  const statTeamIds = [...new Set(stats.map(s => s.team_id))];
  console.log(`\nUnique team IDs found in stats: ${statTeamIds.length}`);
  
  // Get team names for stats
  const { data: statTeams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .in('id', statTeamIds);
  
  console.log('\n📊 Teams found in stats:');
  statTeams.forEach(team => {
    console.log(`${team.name} (${team.external_id})`);
  });
  
  // 3. Check if there's a mismatch between player teams and stat teams
  const playerTeamIds = new Set(teamIds);
  const statTeamIdsSet = new Set(statTeamIds);
  
  console.log('\n🔍 Team ID comparison:');
  console.log(`Player teams: ${playerTeamIds.size}`);
  console.log(`Stats teams: ${statTeamIdsSet.size}`);
  
  // Find teams in stats but not in players
  const statsOnlyTeams = statTeamIds.filter(id => !playerTeamIds.has(id));
  console.log(`\nTeams in stats but not in players: ${statsOnlyTeams.length}`);
  
  if (statsOnlyTeams.length > 0) {
    const { data: missingTeams } = await supabase
      .from('teams')
      .select('id, name, external_id')
      .in('id', statsOnlyTeams);
    
    console.log('\n❌ Missing teams (have stats but no players):');
    missingTeams.forEach(team => {
      console.log(`${team.name} (${team.external_id})`);
    });
  }
  
  // 4. Check games to see what teams are playing
  console.log('\n🎮 Checking game teams...');
  
  const { data: games } = await supabase
    .from('games')
    .select('home_team_id, away_team_id, metadata')
    .eq('sport', 'NCAA_FB')
    .limit(100);
  
  const gameTeamIds = new Set();
  games.forEach(game => {
    if (game.home_team_id) gameTeamIds.add(game.home_team_id);
    if (game.away_team_id) gameTeamIds.add(game.away_team_id);
  });
  
  console.log(`\nUnique teams in games: ${gameTeamIds.size}`);
  
  // Check if game teams match player teams
  const gameTeamIdsArray = Array.from(gameTeamIds);
  const { data: gameTeams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .in('id', gameTeamIdsArray.slice(0, 20));
  
  console.log('\n📊 Sample teams from games:');
  gameTeams.forEach(team => {
    const hasPlayers = playerTeamIds.has(team.id);
    const hasStats = statTeamIdsSet.has(team.id);
    console.log(`${team.name} (${team.external_id}) - Players: ${hasPlayers ? '✅' : '❌'} Stats: ${hasStats ? '✅' : '❌'}`);
  });
  
  // 5. Summary
  console.log('\n' + chalk.bold.yellow('📊 SUMMARY:'));
  console.log(`Total players: ${players.length}`);
  console.log(`Teams with players: ${teamCounts.size}`);
  console.log(`Teams with stats: ${statTeamIds.length}`);
  console.log(`Teams in games: ${gameTeamIds.size}`);
  
  if (statsOnlyTeams.length > 0) {
    console.log('\n' + chalk.bold.red('🚨 ISSUE FOUND:'));
    console.log(`${statsOnlyTeams.length} teams have stats but no players!`);
    console.log('This means the stats collector is finding more teams than the player collector.');
  }
}

diagnoseCoverage().catch(console.error);