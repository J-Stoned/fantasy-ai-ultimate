#!/usr/bin/env tsx
/**
 * 📊 NCAA FOOTBALL PLAYER COVERAGE ANALYSIS
 * Deep dive into which teams have players and why
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzePlayerCoverage() {
  console.log(chalk.bold.blue('📊 NCAA FOOTBALL PLAYER COVERAGE ANALYSIS\n'));
  
  // Get all teams
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('sport', 'NCAA_FB')
    .order('name');
  
  if (teamsError) {
    console.error('Error fetching teams:', teamsError);
    return;
  }
  
  console.log(`Found ${teams.length} teams`);
  
  // Get all players grouped by team
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('team_id, external_id, name')
    .eq('sport_id', 'NCAA_FB');
  
  if (playersError) {
    console.error('Error fetching players:', playersError);
    return;
  }
  
  console.log(`Found ${players.length} players`);
  
  // Group players by team
  const playersByTeam = new Map<number, any[]>();
  players.forEach(player => {
    if (!playersByTeam.has(player.team_id)) {
      playersByTeam.set(player.team_id, []);
    }
    playersByTeam.get(player.team_id)!.push(player);
  });
  
  // Analyze coverage
  const teamsWithPlayers = [];
  const teamsWithoutPlayers = [];
  
  for (const team of teams) {
    const teamPlayers = playersByTeam.get(team.id) || [];
    if (teamPlayers.length > 0) {
      teamsWithPlayers.push({
        ...team,
        playerCount: teamPlayers.length,
        samplePlayers: teamPlayers.slice(0, 3).map(p => p.name)
      });
    } else {
      teamsWithoutPlayers.push(team);
    }
  }
  
  // Sort by player count
  teamsWithPlayers.sort((a, b) => b.playerCount - a.playerCount);
  
  // Display results
  console.log('\n' + chalk.bold.green(`✅ TEAMS WITH PLAYERS (${teamsWithPlayers.length}):`));
  teamsWithPlayers.forEach((team, i) => {
    console.log(`${i + 1}. ${chalk.bold(team.name)} (${team.external_id})`);
    console.log(`   Players: ${chalk.green(team.playerCount)}`);
    console.log(`   Sample: ${team.samplePlayers.join(', ')}`);
  });
  
  console.log('\n' + chalk.bold.red(`❌ TEAMS WITHOUT PLAYERS (${teamsWithoutPlayers.length}):`));
  teamsWithoutPlayers.slice(0, 20).forEach((team, i) => {
    console.log(`${i + 1}. ${chalk.dim(team.name)} (${team.external_id})`);
  });
  
  if (teamsWithoutPlayers.length > 20) {
    console.log(`   ... and ${teamsWithoutPlayers.length - 20} more teams`);
  }
  
  // Statistics
  const totalPlayers = teamsWithPlayers.reduce((sum, team) => sum + team.playerCount, 0);
  const avgPlayersPerTeam = totalPlayers / teamsWithPlayers.length;
  
  console.log('\n' + chalk.bold.yellow('📊 COVERAGE STATISTICS:'));
  console.log(`Teams with players: ${chalk.green(teamsWithPlayers.length)}/500 (${((teamsWithPlayers.length / 500) * 100).toFixed(1)}%)`);
  console.log(`Teams without players: ${chalk.red(teamsWithoutPlayers.length)}/500 (${((teamsWithoutPlayers.length / 500) * 100).toFixed(1)}%)`);
  console.log(`Total players: ${chalk.bold(totalPlayers)}`);
  console.log(`Average players per team: ${chalk.bold(avgPlayersPerTeam.toFixed(1))}`);
  
  // Check for external ID patterns
  const allExternalIds = teamsWithPlayers.map(t => t.external_id);
  const idsWithoutData = teamsWithoutPlayers.map(t => t.external_id);
  
  console.log('\n' + chalk.bold.cyan('🔍 EXTERNAL ID PATTERNS:'));
  console.log(`Teams with players: ${allExternalIds.slice(0, 5).join(', ')}...`);
  console.log(`Teams without players: ${idsWithoutData.slice(0, 5).join(', ')}...`);
  
  console.log('\n' + chalk.bold.yellow('🎯 NEXT STEPS:'));
  console.log('1. All teams have roster data according to diagnostic');
  console.log('2. Only 12 teams have players in database');
  console.log('3. Player collector may be skipping teams due to existing player logic');
  console.log('4. Need to force collection for all teams regardless of existing players');
}

analyzePlayerCoverage().catch(console.error);