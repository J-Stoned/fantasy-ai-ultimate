#!/usr/bin/env tsx
/**
 * Analyze individual team performance
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function analyzeTeams() {
  console.log(chalk.blue.bold('🏆 TEAM PERFORMANCE ANALYSIS\n'));
  
  // Get teams
  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .order('name');
    
  if (!teams) return;
  
  // Get recent games
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(5000);
    
  if (!games) return;
  
  // Calculate team stats
  const teamStats = new Map();
  
  teams.forEach(team => {
    teamStats.set(team.id, {
      name: team.name,
      games: 0,
      wins: 0,
      totalScored: 0,
      totalAllowed: 0,
      homeWins: 0,
      homeGames: 0,
      awayWins: 0,
      awayGames: 0,
      margins: []
    });
  });
  
  // Process games
  games.forEach(game => {
    const homeStats = teamStats.get(game.home_team_id);
    const awayStats = teamStats.get(game.away_team_id);
    
    if (homeStats) {
      homeStats.games++;
      homeStats.homeGames++;
      homeStats.totalScored += game.home_score;
      homeStats.totalAllowed += game.away_score;
      homeStats.margins.push(game.home_score - game.away_score);
      
      if (game.home_score > game.away_score) {
        homeStats.wins++;
        homeStats.homeWins++;
      }
    }
    
    if (awayStats) {
      awayStats.games++;
      awayStats.awayGames++;
      awayStats.totalScored += game.away_score;
      awayStats.totalAllowed += game.home_score;
      awayStats.margins.push(game.away_score - game.home_score);
      
      if (game.away_score > game.home_score) {
        awayStats.wins++;
        awayStats.awayWins++;
      }
    }
  });
  
  // Filter teams with games and calculate metrics
  const activeTeams = Array.from(teamStats.values())
    .filter(team => team.games > 10)
    .map(team => ({
      ...team,
      winRate: team.wins / team.games,
      avgScored: team.totalScored / team.games,
      avgAllowed: team.totalAllowed / team.games,
      avgMargin: team.margins.reduce((a, b) => a + b, 0) / team.games,
      homeWinRate: team.homeGames > 0 ? team.homeWins / team.homeGames : 0,
      awayWinRate: team.awayGames > 0 ? team.awayWins / team.awayGames : 0
    }));
  
  // Sort by win rate
  activeTeams.sort((a, b) => b.winRate - a.winRate);
  
  // Display top teams
  console.log(chalk.cyan('TOP 10 TEAMS BY WIN RATE:'));
  activeTeams.slice(0, 10).forEach((team, idx) => {
    console.log(`${idx + 1}. ${team.name}`);
    console.log(`   Record: ${team.wins}-${team.games - team.wins} (${(team.winRate * 100).toFixed(1)}%)`);
    console.log(`   Scoring: ${team.avgScored.toFixed(1)} - ${team.avgAllowed.toFixed(1)} (${team.avgMargin > 0 ? '+' : ''}${team.avgMargin.toFixed(1)})`);
    console.log(`   Home: ${(team.homeWinRate * 100).toFixed(1)}% | Away: ${(team.awayWinRate * 100).toFixed(1)}%`);
  });
  
  // Best offensive teams
  console.log(chalk.cyan('\n\nHIGHEST SCORING TEAMS:'));
  activeTeams
    .sort((a, b) => b.avgScored - a.avgScored)
    .slice(0, 5)
    .forEach((team, idx) => {
      console.log(`${idx + 1}. ${team.name}: ${team.avgScored.toFixed(1)} PPG`);
    });
    
  // Best defensive teams
  console.log(chalk.cyan('\n\nBEST DEFENSIVE TEAMS:'));
  activeTeams
    .sort((a, b) => a.avgAllowed - b.avgAllowed)
    .slice(0, 5)
    .forEach((team, idx) => {
      console.log(`${idx + 1}. ${team.name}: ${team.avgAllowed.toFixed(1)} allowed`);
    });
    
  // Home/Away specialists
  console.log(chalk.cyan('\n\nHOME/AWAY SPECIALISTS:'));
  
  const homeDominant = activeTeams
    .filter(t => t.homeGames > 5 && t.awayGames > 5)
    .sort((a, b) => (b.homeWinRate - b.awayWinRate) - (a.homeWinRate - a.awayWinRate));
    
  console.log('\nBest at home:');
  homeDominant.slice(0, 3).forEach(team => {
    const diff = ((team.homeWinRate - team.awayWinRate) * 100).toFixed(1);
    console.log(`  ${team.name}: +${diff}% better at home`);
  });
  
  console.log('\nBest on road:');
  homeDominant.slice(-3).forEach(team => {
    const diff = ((team.awayWinRate - team.homeWinRate) * 100).toFixed(1);
    console.log(`  ${team.name}: +${diff}% better on road`);
  });
}

analyzeTeams().catch(console.error);