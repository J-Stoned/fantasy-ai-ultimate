#!/usr/bin/env tsx
/**
 * Test fetching a single game with detailed logging
 */

import chalk from 'chalk';
import { config } from 'dotenv';
import { schemaAdapter } from '../lib/db/schema-adapter';
import axios from 'axios';

config({ path: '.env.local' });

async function fetchSingleGame() {
  console.log(chalk.cyan('Fetching single MLB game...'));
  
  // Get recent MLB games (currently in season)
  const url = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard';
  const { data } = await axios.get(url);
  
  // Find a completed game
  const completedGame = data.events?.find((e: any) => e.status?.type?.completed);
  
  if (!completedGame) {
    console.log(chalk.red('No completed games found'));
    return;
  }
  
  console.log(chalk.green(`Found completed game: ${completedGame.name}`));
  console.log(`Game ID: ${completedGame.id}`);
  
  // Store the game
  const competition = completedGame.competitions[0];
  const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
  const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
  
  const gameId = await schemaAdapter.upsertGame({
    external_id: `espn_mlb_${completedGame.id}`,
    home_team: homeTeam.team.displayName,
    away_team: awayTeam.team.displayName,
    home_score: parseInt(homeTeam.score),
    away_score: parseInt(awayTeam.score),
    status: 'completed',
    game_date: completedGame.date,
    sport: 'baseball'
  });
  
  console.log(chalk.green(`Stored game with ID: ${gameId}`));
  
  // Fetch box score
  console.log(chalk.cyan('\nFetching box score...'));
  const boxscoreUrl = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${completedGame.id}`;
  const boxscoreResponse = await axios.get(boxscoreUrl);
  
  const boxscore = boxscoreResponse.data?.boxscore;
  if (!boxscore?.teams) {
    console.log(chalk.red('No boxscore data found'));
    return;
  }
  
  console.log(chalk.green('Found boxscore data'));
  
  // Process first team's first player only
  const firstTeam = boxscore.teams[0];
  console.log(`\nProcessing team: ${firstTeam.team.displayName}`);
  
  const firstCategory = firstTeam.statistics?.[0];
  if (!firstCategory) {
    console.log(chalk.red('No statistics found'));
    return;
  }
  
  console.log(`Category: ${firstCategory.name}`);
  console.log(`Athletes in category: ${firstCategory.athletes?.length || 0}`);
  
  const firstAthlete = firstCategory.athletes?.[0];
  if (!firstAthlete) {
    console.log(chalk.red('No athletes found'));
    return;
  }
  
  console.log(`\nAthlete: ${firstAthlete.athlete.displayName}`);
  console.log(`Position: ${firstAthlete.athlete.position?.abbreviation}`);
  console.log(`Stats array: ${JSON.stringify(firstAthlete.stats)}`);
  
  // Create player
  const playerId = await schemaAdapter.upsertPlayer({
    name: firstAthlete.athlete.displayName,
    position: firstAthlete.athlete.position?.abbreviation,
    team: firstTeam.team.displayName,
    sport: 'baseball',
    external_id: `espn_mlb_player_${firstAthlete.athlete.id}`
  }, 'espn');
  
  console.log(chalk.green(`Created player with ID: ${playerId}`));
  
  // Parse stats
  const stats: any = {};
  if (firstCategory.name === 'batting' && firstAthlete.stats.length >= 8) {
    stats.at_bats = parseInt(firstAthlete.stats[0] || '0');
    stats.runs = parseInt(firstAthlete.stats[1] || '0');
    stats.hits = parseInt(firstAthlete.stats[2] || '0');
    stats.rbi = parseInt(firstAthlete.stats[3] || '0');
    stats.home_runs = parseInt(firstAthlete.stats[4] || '0');
    stats.batting_avg = parseFloat(firstAthlete.stats[7] || '0');
  } else if (firstCategory.name === 'pitching' && firstAthlete.stats.length >= 10) {
    stats.innings_pitched = parseFloat(firstAthlete.stats[0] || '0');
    stats.hits_allowed = parseInt(firstAthlete.stats[1] || '0');
    stats.runs_allowed = parseInt(firstAthlete.stats[2] || '0');
    stats.earned_runs = parseInt(firstAthlete.stats[3] || '0');
    stats.strikeouts = parseInt(firstAthlete.stats[5] || '0');
    stats.era = parseFloat(firstAthlete.stats[9] || '0');
  }
  
  console.log(`Parsed stats: ${JSON.stringify(stats)}`);
  
  // Store stats
  if (Object.keys(stats).length > 0) {
    const stored = await schemaAdapter.upsertPlayerStats({
      player_id: playerId!,
      game_id: gameId!,
      stats: stats,
      fantasy_points: 10, // dummy value
      game_date: completedGame.date
    });
    
    console.log(chalk.green(`Stats stored: ${stored}`));
  }
  
  // Check if it was stored
  console.log(chalk.cyan('\nChecking database...'));
  const check = await schemaAdapter.getPlayerStatsForGame(playerId!, gameId!);
  console.log('Retrieved stats:', JSON.stringify(check, null, 2));
}

fetchSingleGame().catch(console.error);