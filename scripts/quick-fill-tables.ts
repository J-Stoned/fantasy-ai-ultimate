#!/usr/bin/env tsx
/**
 * QUICK TABLE FILLER - Fast and simple
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function quickFill() {
  console.log(chalk.blue.bold('\n⚡ QUICK FILLING CRITICAL TABLES\n'));
  
  // 1. Add some player stats
  console.log(chalk.yellow('📊 Adding player_stats...'));
  
  // Get 10 recent games
  const { data: games } = await supabase
    .from('games')
    .select('id, home_team_id, away_team_id, home_score, away_score, created_at')
    .not('home_score', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);
    
  // Get 20 top players
  const { data: players } = await supabase
    .from('players')
    .select('id, firstname, lastname, position, team_id')
    .in('position', ['QB', 'RB', 'WR'])
    .limit(20);
    
  if (games && players) {
    let count = 0;
    for (const game of games) {
      // Add stats for 2-3 players per game
      const gamePlayers = players
        .filter(p => p.team_id === game.home_team_id || p.team_id === game.away_team_id)
        .slice(0, 3);
        
      for (const player of gamePlayers) {
        const { error } = await supabase.from('player_stats').insert({
          player_id: player.id,
          game_id: game.id,
          stat_type: 'game_stats',
          stats: {
            fantasy_points: 10 + Math.floor(Math.random() * 20),
            passing_yards: player.position[0] === 'QB' ? 200 + Math.floor(Math.random() * 150) : 0,
            rushing_yards: player.position[0] === 'RB' ? 50 + Math.floor(Math.random() * 100) : 0,
            receiving_yards: player.position[0] === 'WR' ? 40 + Math.floor(Math.random() * 100) : 0,
          },
          created_at: game.created_at
        });
        
        if (error) {
          console.log(chalk.red(`Error inserting player_stats: ${error.message}`));
        } else {
          count++;
        }
      }
    }
    console.log(chalk.green(`✅ Added ${count} player stats`));
  }
  
  // 2. Add some injuries
  console.log(chalk.yellow('\n🏥 Adding injuries...'));
  
  const injuryStatuses = ['questionable', 'doubtful', 'out', 'day-to-day'];
  const injuryTypes = ['hamstring', 'knee', 'ankle', 'shoulder', 'concussion'];
  
  if (players) {
    let injuryCount = 0;
    // Add injuries to 5 random players
    const injuredPlayers = players.sort(() => Math.random() - 0.5).slice(0, 5);
    
    for (const player of injuredPlayers) {
      await supabase.from('player_injuries').insert({
        player_id: player.id,
        injury_type: injuryTypes[Math.floor(Math.random() * injuryTypes.length)],
        status: injuryStatuses[Math.floor(Math.random() * injuryStatuses.length)],
        description: `${player.firstname} ${player.lastname} injury update`,
        source: 'Team Report',
        reported_date: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
      injuryCount++;
    }
    console.log(chalk.green(`✅ Added ${injuryCount} injuries`));
  }
  
  // 3. Add weather data
  console.log(chalk.yellow('\n🌤️ Adding weather data...'));
  
  if (games) {
    let weatherCount = 0;
    for (const game of games.slice(0, 5)) {
      await supabase.from('weather_data').insert({
        game_id: game.id,
        temperature: 50 + Math.floor(Math.random() * 40),
        feels_like: 48 + Math.floor(Math.random() * 40),
        humidity: 40 + Math.floor(Math.random() * 40),
        wind_speed: Math.floor(Math.random() * 20),
        wind_direction: Math.floor(Math.random() * 360),
        conditions: ['Clear', 'Cloudy', 'Rain', 'Snow'][Math.floor(Math.random() * 4)],
        description: 'Game day weather',
        is_dome: Math.random() > 0.7,
        created_at: game.created_at
      });
      weatherCount++;
    }
    console.log(chalk.green(`✅ Added ${weatherCount} weather records`));
  }
  
  // 4. Check results
  console.log(chalk.cyan('\n📊 Final table counts:'));
  
  const tables = ['player_stats', 'player_injuries', 'weather_data'];
  for (const table of tables) {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    console.log(`  ${table}: ${count} records`);
  }
  
  console.log(chalk.green.bold('\n✅ Quick fill complete!'));
}

quickFill().catch(console.error);