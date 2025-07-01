#!/usr/bin/env tsx
/**
 * 🛡️ SAFE REAL DATA COLLECTOR
 * Handles missing columns and API errors gracefully
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

// Default cities for weather collection
const DEFAULT_CITIES = [
  'New York', 'Los Angeles', 'Chicago', 'Dallas', 
  'Green Bay', 'Seattle', 'Miami', 'Denver',
  'Philadelphia', 'San Francisco', 'Boston', 'Detroit'
];

// 🏀 Collect NBA Data (BallDontLie v1 - no auth needed)
async function collectNBAData() {
  console.log(chalk.yellow('🏀 Collecting NBA data...'));
  try {
    // BallDontLie v1 endpoints (no auth required)
    const playersUrl = 'https://www.balldontlie.io/api/v1/players?per_page=100';
    const playersResponse = await axios.get(playersUrl);
    
    if (playersResponse.data?.data) {
      for (const player of playersResponse.data.data) {
        if (player.first_name && player.last_name) {
          try {
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
          } catch (err) {
            // Continue even if individual insert fails
          }
        }
      }
    }
    
    // Get games
    const currentYear = new Date().getFullYear();
    const season = new Date().getMonth() >= 9 ? currentYear : currentYear - 1;
    const gamesUrl = `https://www.balldontlie.io/api/v1/games?seasons[]=${season}&per_page=100`;
    const gamesResponse = await axios.get(gamesUrl);
    
    if (gamesResponse.data?.data) {
      for (const game of gamesResponse.data.data) {
        try {
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
        } catch (err) {
          // Continue
        }
      }
    }
    
    console.log(chalk.green(`✅ NBA: ${stats.players} players, ${stats.games} games`));
  } catch (error: any) {
    console.error(chalk.red('❌ NBA error:'), error.message);
    stats.errors++;
  }
}

// 💰 Collect Betting Odds
async function collectBettingOdds() {
  console.log(chalk.yellow('💰 Collecting betting odds...'));
  try {
    const apiKey = process.env.THE_ODDS_API_KEY;
    if (!apiKey) {
      console.log(chalk.gray('No Odds API key configured'));
      return;
    }
    
    const sports = ['americanfootball_nfl', 'basketball_nba', 'baseball_mlb', 'icehockey_nhl'];
    
    for (const sport of sports) {
      try {
        const response = await axios.get(
          `https://api.the-odds-api.com/v4/sports/${sport}/odds`,
          {
            params: {
              apiKey: apiKey,
              regions: 'us',
              markets: 'h2h,spreads,totals',
              oddsFormat: 'american'
            }
          }
        );
        
        if (response.data && Array.isArray(response.data)) {
          for (const event of response.data) {
            try {
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
              
              // Create news
              if (event.bookmakers?.length > 0) {
                await supabase.from('news_articles').insert({
                  title: `Betting Update: ${event.away_team} @ ${event.home_team}`,
                  content: `Latest odds for ${sport.split('_')[1].toUpperCase()} matchup.`,
                  source: 'The Odds API',
                  published_at: new Date().toISOString()
                });
                stats.news++;
              }
            } catch (err) {
              // Continue
            }
          }
        }
      } catch (err) {
        // Continue with next sport
      }
    }
    
    console.log(chalk.green(`✅ Odds: ${stats.odds} games, ${stats.news} insights`));
  } catch (error: any) {
    console.error(chalk.red('❌ Odds error:'), error.message);
    stats.errors++;
  }
}

// 🌤️ Collect Weather Data
async function collectWeatherData() {
  console.log(chalk.yellow('🌤️ Collecting weather data...'));
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    if (!apiKey) {
      console.log(chalk.gray('No OpenWeather API key configured'));
      return;
    }
    
    let cities = DEFAULT_CITIES;
    
    // Try to get cities from teams table, but don't fail if it doesn't work
    try {
      const { data: teams, error } = await supabase
        .from('teams')
        .select('city')
        .not('city', 'is', null)
        .limit(20);
      
      if (!error && teams && teams.length > 0) {
        cities = teams.map(t => t.city).filter(Boolean);
        console.log(chalk.gray(`Using ${cities.length} cities from teams table`));
      } else {
        console.log(chalk.gray('Using default cities (teams query failed)'));
      }
    } catch (err) {
      console.log(chalk.gray('Using default cities (teams table issue)'));
    }
    
    // Collect weather for each city
    for (const city of cities) {
      try {
        const response = await axios.get(
          'https://api.openweathermap.org/data/2.5/weather',
          {
            params: {
              q: city,
              appid: apiKey,
              units: 'imperial'
            }
          }
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
          external_id: `weather_${city.replace(/\s+/g, '_')}_${Date.now()}`
        }, { onConflict: 'external_id' });
        stats.weather++;
        
        // Create weather alerts
        if (weather.wind.speed > 20 || ['Snow', 'Rain', 'Thunderstorm'].includes(weather.weather[0].main)) {
          await supabase.from('news_articles').insert({
            title: `Weather Alert: ${weather.weather[0].main} in ${city}`,
            content: `${weather.weather[0].description} with ${weather.main.temp}°F and ${weather.wind.speed} mph winds. This could impact games and fantasy performance.`,
            source: 'Weather Impact Analysis',
            published_at: new Date().toISOString()
          });
          stats.news++;
        }
      } catch (err) {
        // Continue with next city
      }
    }
    
    console.log(chalk.green(`✅ Weather: ${stats.weather} cities tracked`));
  } catch (error: any) {
    console.error(chalk.red('❌ Weather error:'), error.message);
    stats.errors++;
  }
}

// 📊 Show Stats
function showStats() {
  const runtime = Math.floor((Date.now() - stats.startTime) / 1000);
  const total = stats.players + stats.games + stats.odds + stats.weather + stats.news;
  
  console.clear();
  console.log(chalk.blue('🛡️ SAFE REAL DATA COLLECTOR'));
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
  
  console.log('\n🔌 APIs:');
  console.log(`  ${process.env.THE_ODDS_API_KEY ? '✅' : '❌'} The Odds API`);
  console.log(`  ${process.env.OPENWEATHER_API_KEY ? '✅' : '❌'} OpenWeather API`);
  console.log(`  ✅ BallDontLie API (no key needed)`);
}

// 🚀 Main Execution
async function main() {
  console.log(chalk.blue('🚀 Starting SAFE real data collection...\n'));
  
  // Test database connection
  try {
    const { error } = await supabase.from('players').select('count').limit(1);
    if (error) throw error;
    console.log(chalk.green('✅ Database connected!\n'));
  } catch (error: any) {
    console.error(chalk.red('❌ Database connection failed:'), error.message);
    console.log(chalk.yellow('\nMake sure you have run the SQL setup scripts in Supabase!'));
    return;
  }
  
  // Initial collection
  await collectNBAData();
  await collectBettingOdds();
  await collectWeatherData();
  
  // Show initial stats
  showStats();
  
  // Schedule recurring collections
  console.log(chalk.blue('\n📅 Scheduling updates every 5 minutes...'));
  
  setInterval(async () => {
    await collectNBAData();
    await collectBettingOdds();
    await collectWeatherData();
    showStats();
  }, 300000); // Every 5 minutes
  
  console.log(chalk.green('✅ Safe collector running! Press Ctrl+C to stop\n'));
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
  showStats();
  console.log(chalk.yellow('\n\n👋 Shutting down safe collector...'));
  process.exit(0);
});

// Start collection
main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});