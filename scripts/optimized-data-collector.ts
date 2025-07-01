#!/usr/bin/env tsx
/**
 * 🚀 OPTIMIZED REAL DATA COLLECTOR
 * Uses only working APIs with correct authentication
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const stats = {
  players: 0,
  games: 0,
  odds: 0,
  weather: 0,
  news: 0,
  errors: 0,
  startTime: Date.now()
};

// 🏀 BallDontLie API (no auth needed for v1)
async function collectNBAData() {
  console.log(chalk.yellow('🏀 Collecting NBA data...'));
  try {
    // Get players
    const players = await axios.get('https://www.balldontlie.io/api/v1/players?per_page=100');
    
    for (const player of players.data.data) {
      if (player.first_name && player.last_name) {
        await supabase.from('players').upsert({
          firstname: player.first_name,
          lastname: player.last_name,
          position: player.position ? [player.position] : ['G'],
          team_id: player.team?.id || null,
          sport_id: 'nba',
          status: 'active',
          external_id: `balldontlie_${player.id}`
        }, { onConflict: 'external_id' });
        stats.players++;
      }
    }

    // Get recent games
    const currentYear = new Date().getFullYear();
    const season = new Date().getMonth() >= 9 ? currentYear : currentYear - 1;
    
    const games = await axios.get(`https://www.balldontlie.io/api/v1/games?seasons[]=${season}&per_page=100`);
    
    for (const game of games.data.data) {
      await supabase.from('games').upsert({
        home_team_id: game.home_team.id,
        away_team_id: game.visitor_team.id,
        home_score: game.home_team_score,
        away_score: game.visitor_team_score,
        start_time: game.date,
        status: game.status,
        sport_id: 'nba',
        season: game.season,
        external_id: `balldontlie_game_${game.id}`
      }, { onConflict: 'external_id' });
      stats.games++;
    }
    
    console.log(chalk.green(`✅ NBA: ${stats.players} players, ${stats.games} games`));
  } catch (error: any) {
    console.error(chalk.red('❌ NBA error:'), error.message);
    stats.errors++;
  }
}

// 💰 The Odds API (working)
async function collectBettingOdds() {
  console.log(chalk.yellow('💰 Collecting betting odds...'));
  try {
    const apiKey = process.env.THE_ODDS_API_KEY;
    const sports = ['americanfootball_nfl', 'basketball_nba', 'baseball_mlb', 'icehockey_nhl'];
    
    for (const sport of sports) {
      const response = await axios.get(
        `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals`
      );
      
      for (const event of response.data) {
        await supabase.from('betting_odds').upsert({
          sport_id: sport.split('_')[1],
          home_team: event.home_team,
          away_team: event.away_team,
          commence_time: event.commence_time,
          bookmakers: event.bookmakers,
          external_id: `odds_${event.id}`,
          created_at: new Date().toISOString()
        }, { onConflict: 'external_id' });
        stats.odds++;
        
        // Create news from odds
        if (event.bookmakers?.length > 0) {
          await supabase.from('news_articles').insert({
            title: `Betting Update: ${event.away_team} @ ${event.home_team}`,
            content: `Latest odds for ${sport.split('_')[1].toUpperCase()} matchup.`,
            source: 'The Odds API',
            published_at: new Date().toISOString()
          });
          stats.news++;
        }
      }
    }
    
    console.log(chalk.green(`✅ Odds: ${stats.odds} games, ${stats.news} insights`));
  } catch (error: any) {
    console.error(chalk.red('❌ Odds error:'), error.message);
    stats.errors++;
  }
}

// 🌤️ OpenWeather API (working)
async function collectWeatherData() {
  console.log(chalk.yellow('🌤️ Collecting weather data...'));
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const cities = ['New York', 'Los Angeles', 'Chicago', 'Dallas', 'Green Bay', 'Seattle', 'Miami', 'Denver'];
    
    for (const city of cities) {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=imperial`
      );
      
      const weather = response.data;
      await supabase.from('weather_conditions').upsert({
        city: city,
        temperature: weather.main.temp,
        feels_like: weather.main.feels_like,
        conditions: weather.weather[0].main,
        description: weather.weather[0].description,
        wind_speed: weather.wind.speed,
        humidity: weather.main.humidity,
        visibility: weather.visibility,
        external_id: `weather_${city}_${Date.now()}`
      }, { onConflict: 'external_id' });
      stats.weather++;
      
      // Create weather alerts
      if (weather.wind.speed > 20 || ['Snow', 'Rain'].includes(weather.weather[0].main)) {
        await supabase.from('news_articles').insert({
          title: `Weather Alert: ${weather.weather[0].main} in ${city}`,
          content: `${weather.weather[0].description} with ${weather.main.temp}°F and ${weather.wind.speed} mph winds.`,
          source: 'Weather Impact Analysis',
          published_at: new Date().toISOString()
        });
        stats.news++;
      }
    }
    
    console.log(chalk.green(`✅ Weather: ${stats.weather} cities tracked`));
  } catch (error: any) {
    console.error(chalk.red('❌ Weather error:'), error.message);
    stats.errors++;
  }
}

// Show stats
function showStats() {
  const runtime = Math.floor((Date.now() - stats.startTime) / 1000);
  const total = stats.players + stats.games + stats.odds + stats.weather + stats.news;
  
  console.clear();
  console.log(chalk.blue('🔥 OPTIMIZED DATA COLLECTOR'));
  console.log(chalk.blue('===========================\n'));
  
  console.log(chalk.gray(`⏱️  Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`));
  console.log(chalk.green(`📈 Total collected: ${total.toLocaleString()}\n`));
  
  console.log('📊 Breakdown:');
  console.log(`  🏃 Players: ${stats.players.toLocaleString()}`);
  console.log(`  🏈 Games: ${stats.games.toLocaleString()}`);
  console.log(`  💰 Odds: ${stats.odds.toLocaleString()}`);
  console.log(`  🌤️ Weather: ${stats.weather.toLocaleString()}`);
  console.log(`  📰 News: ${stats.news.toLocaleString()}`);
  console.log(`  ❌ Errors: ${stats.errors}`);
}

// Main execution
async function main() {
  console.log(chalk.blue('🚀 Starting optimized data collection...\n'));
  
  // Test database
  const { error } = await supabase.from('players').select('count').limit(1);
  if (error) {
    console.error(chalk.red('❌ Database error:'), error.message);
    return;
  }
  
  // Run collections
  await collectNBAData();
  await collectBettingOdds();
  await collectWeatherData();
  
  // Show stats
  showStats();
  
  // Schedule updates
  setInterval(async () => {
    await collectNBAData();
    await collectBettingOdds();
    await collectWeatherData();
    showStats();
  }, 300000); // Every 5 minutes
  
  console.log(chalk.green('\n✅ Collector running! Press Ctrl+C to stop\n'));
}

main().catch(console.error);
