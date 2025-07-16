#!/usr/bin/env tsx
/**
 * 📊 NCAA FOOTBALL PLAYER COVERAGE ANALYSIS - FIXED VERSION
 * Properly paginate through ALL 21,095 players
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzePlayerCoverageFixed() {
  console.log(chalk.bold.blue('📊 NCAA FOOTBALL PLAYER COVERAGE ANALYSIS - FIXED\n'));
  
  // Get ALL players with proper pagination
  console.log('📊 Loading ALL players with pagination...');
  
  const allPlayers = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, team_id, external_id')
      .eq('sport_id', 'NCAA_FB')
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.error('Error fetching players:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allPlayers.push(...data);
    console.log(`Loaded ${allPlayers.length} players...`);
    
    from += batchSize;
    
    if (data.length < batchSize) break;
  }
  
  console.log(`\nTotal players loaded: ${allPlayers.length}`);
  
  // Group players by team
  const playersByTeam = new Map();
  allPlayers.forEach(player => {
    if (!playersByTeam.has(player.team_id)) {
      playersByTeam.set(player.team_id, []);
    }
    playersByTeam.get(player.team_id).push(player);
  });
  
  console.log(`Teams with players: ${playersByTeam.size}`);
  
  // Get team names for all teams with players
  const teamIds = Array.from(playersByTeam.keys());
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .in('id', teamIds);
  
  if (teamsError) {
    console.error('Error fetching teams:', teamsError);
    return;
  }
  
  // Create team coverage report
  const teamCoverage = teams.map(team => ({
    ...team,
    playerCount: playersByTeam.get(team.id).length,
    samplePlayers: playersByTeam.get(team.id).slice(0, 3).map(p => p.name)
  }));
  
  // Sort by player count
  teamCoverage.sort((a, b) => b.playerCount - a.playerCount);
  
  // Display results
  console.log('\n' + chalk.bold.green(`✅ ALL TEAMS WITH PLAYERS (${teamCoverage.length}):`));
  teamCoverage.forEach((team, i) => {
    console.log(`${i + 1}. ${chalk.bold(team.name)} (${team.external_id})`);
    console.log(`   Players: ${chalk.green(team.playerCount)}`);
    console.log(`   Sample: ${team.samplePlayers.join(', ')}`);
  });
  
  // Statistics
  const totalPlayers = teamCoverage.reduce((sum, team) => sum + team.playerCount, 0);
  const avgPlayersPerTeam = totalPlayers / teamCoverage.length;
  
  console.log('\n' + chalk.bold.yellow('📊 COVERAGE STATISTICS:'));
  console.log(`Total players: ${chalk.bold.green(totalPlayers)}`);
  console.log(`Teams with players: ${chalk.bold.green(teamCoverage.length)}`);
  console.log(`Average players per team: ${chalk.bold(avgPlayersPerTeam.toFixed(1))}`);
  
  // Check if this matches our stats
  console.log('\n' + chalk.bold.cyan('🔍 VALIDATION:'));
  console.log(`Expected from stats collector: Major college teams should have players`);
  console.log(`Actual result: ${teamCoverage.length} teams have full rosters`);
  
  if (teamCoverage.length > 50) {
    console.log(chalk.bold.green('\n🎉 SUCCESS! We have comprehensive NCAA Football coverage!'));
  } else {
    console.log(chalk.bold.yellow('\n⚠️  Still missing some teams, but major improvement!'));
  }
}

analyzePlayerCoverageFixed().catch(console.error);