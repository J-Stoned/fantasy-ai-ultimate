#!/usr/bin/env tsx
/**
 * 🔍 INVESTIGATE TEAM GAME REFERENCES
 * Check why empty teams have game references
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateTeamGames() {
  console.log(chalk.bold.blue('\n🔍 INVESTIGATE TEAM GAME REFERENCES\n'));
  
  // Pick a few examples of empty teams
  const examples = [
    { sport: 'mlb', external_id: 'mlb_15', name: 'Atlanta Braves' },
    { sport: 'nba', external_id: 'nba_6', name: 'Dallas Mavericks' },
    { sport: 'nhl', external_id: 'nhl_25', name: 'Anaheim Ducks' }
  ];
  
  for (const example of examples) {
    // Find the team
    const { data: team } = await supabase
      .from('teams')
      .select('*')
      .eq('sport_id', example.sport)
      .eq('external_id', example.external_id)
      .single();
    
    if (!team) {
      console.log(chalk.red(`${example.name} not found\n`));
      continue;
    }
    
    console.log(chalk.yellow(`\n${example.sport.toUpperCase()}: ${team.name}`));
    console.log(chalk.gray(`ID: ${team.id}`));
    console.log(chalk.gray(`External: ${team.external_id}`));
    
    // Check players
    const { count: playerCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id);
    
    console.log(chalk.white(`Players: ${playerCount || 0}`));
    
    // Check games
    const { data: homeGames } = await supabase
      .from('games')
      .select('id, game_date, home_score, away_score')
      .eq('home_team_id', team.id)
      .limit(3);
    
    const { data: awayGames } = await supabase
      .from('games')
      .select('id, game_date, home_score, away_score')
      .eq('away_team_id', team.id)
      .limit(3);
    
    console.log(chalk.white(`Home games: ${homeGames?.length || 0}`));
    if (homeGames && homeGames.length > 0) {
      homeGames.forEach(game => {
        console.log(chalk.gray(`  - ${game.game_date}: Score ${game.home_score}-${game.away_score}`));
      });
    }
    
    console.log(chalk.white(`Away games: ${awayGames?.length || 0}`));
    if (awayGames && awayGames.length > 0) {
      awayGames.forEach(game => {
        console.log(chalk.gray(`  - ${game.game_date}: Score ${game.home_score}-${game.away_score}`));
      });
    }
  }
  
  // Check if these are fake games
  console.log(chalk.cyan('\n\nChecking game details...'));
  
  // Get a sample game from one of these teams
  const { data: sampleGames } = await supabase
    .from('games')
    .select('*')
    .or('home_team_id.eq.f47ac10b-58cc-4372-a567-0e02b2c3d479,away_team_id.eq.f47ac10b-58cc-4372-a567-0e02b2c3d479')
    .limit(5);
  
  if (sampleGames && sampleGames.length > 0) {
    console.log(chalk.yellow('\nSample games:'));
    sampleGames.forEach(game => {
      console.log(chalk.white(`\nGame ID: ${game.id}`));
      console.log(chalk.gray(`  Date: ${game.game_date}`));
      console.log(chalk.gray(`  Score: ${game.home_score}-${game.away_score}`));
      console.log(chalk.gray(`  Venue: ${game.venue || 'null'}`));
      console.log(chalk.gray(`  Weather: ${game.weather_conditions || 'null'}`));
    });
  }
}

investigateTeamGames().catch(console.error);