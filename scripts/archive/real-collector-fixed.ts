#!/usr/bin/env tsx
/**
 * 🔥 FIXED REAL DATA COLLECTOR
 * No teams.city column needed - uses hardcoded cities
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import cron from 'node-cron';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// API Configuration
const APIs = {
  ballDontLie: {
    baseUrl: 'https://www.balldontlie.io/api/v1',
    available: true // v1 API doesn't need key
  },
  mySportsFeeds: {
    key: process.env.MYSPORTSFEEDS_API_KEY,
    baseUrl: 'https://api.mysportsfeeds.com/v2.1/pull',
    available: !!process.env.MYSPORTSFEEDS_API_KEY
  },
  theOdds: {
    key: process.env.THE_ODDS_API_KEY,
    baseUrl: 'https://api.the-odds-api.com/v4',
    available: !!process.env.THE_ODDS_API_KEY
  },
  openWeather: {
    key: process.env.OPENWEATHER_API_KEY,
    baseUrl: 'https://api.openweathermap.org/data/2.5',
    available: !!process.env.OPENWEATHER_API_KEY
  },
  sportsRadar: {
    key: process.env.SPORTRADAR_API_KEY,
    baseUrl: 'https://api.sportradar.com',
    available: !!process.env.SPORTRADAR_API_KEY
  }
};

// Stats tracking
const stats = {
  players: 0,
  games: 0,
  odds: 0,
  weather: 0,
  news: 0,
  stats: 0,
  errors: 0,
  startTime: Date.now()
};

// NFL Cities for weather collection (no teams table query needed!)
const NFL_CITIES = [
  'Buffalo', 'Miami', 'Foxborough', 'East Rutherford',
  'Baltimore', 'Cincinnati', 'Cleveland', 'Pittsburgh',
  'Houston', 'Indianapolis', 'Jacksonville', 'Nashville',
  'Denver', 'Kansas City', 'Las Vegas', 'Los Angeles',
  'Dallas', 'Philadelphia', 'Landover',
  'Chicago', 'Detroit', 'Green Bay', 'Minneapolis',
  'Atlanta', 'Charlotte', 'New Orleans', 'Tampa',
  'Glendale', 'Santa Clara', 'Seattle'
];

// 🏀 COLLECT NBA DATA (BallDontLie API - v1 no auth)
async function collectNBAData() {
  console.log('🏀 Collecting real NBA data...');

  try {
    // Get players
    const playersResponse = await axios.get(`${APIs.ballDontLie.baseUrl}/players?per_page=100`);
    
    for (const player of playersResponse.data.data) {
      if (player.first_name && player.last_name) {
        const { error } = await supabase.from('players').upsert({
          firstname: player.first_name,
          lastname: player.last_name,
          position: player.position ? [player.position] : ['G'],
          team_id: player.team?.id || null,
          sport_id: 'nba',
          status: 'active',
          heightinches: player.height_feet ? (player.height_feet * 12 + (player.height_inches || 0)) : null,
          weightlbs: player.weight_pounds || null,
          external_id: `balldontlie_${player.id}`
        }, { onConflict: 'external_id' });

        if (!error) stats.players++;
      }
    }

    // Get recent games
    const currentYear = new Date().getFullYear();
    const season = new Date().getMonth() >= 9 ? currentYear : currentYear - 1;
    
    const gamesResponse = await axios.get(
      `${APIs.ballDontLie.baseUrl}/games?seasons[]=${season}&per_page=100`
    );

    for (const game of gamesResponse.data.data) {
      const { error } = await supabase.from('games').upsert({
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

      if (!error) stats.games++;
    }

    console.log(`✅ NBA: ${stats.players} players, ${stats.games} games`);

  } catch (error: any) {
    console.error('❌ NBA collection error:', error.message);
    stats.errors++;
  }
}

// 💰 COLLECT BETTING ODDS
async function collectBettingOdds() {
  if (!APIs.theOdds.available) {
    console.log('⚠️  The Odds API key not available');
    return;
  }

  console.log('💰 Collecting real betting odds...');

  try {
    const sports = [
      'americanfootball_nfl',
      'basketball_nba',
      'baseball_mlb',
      'icehockey_nhl'
    ];

    for (const sport of sports) {
      const oddsUrl = `${APIs.theOdds.baseUrl}/sports/${sport}/odds`;
      const response = await axios.get(oddsUrl, {
        params: {
          apiKey: APIs.theOdds.key,
          regions: 'us',
          markets: 'h2h,spreads,totals',
          oddsFormat: 'american'
        }
      });

      for (const event of response.data) {
        // Store betting odds
        const { error } = await supabase.from('betting_odds').upsert({
          sport_id: sport.split('_')[1],
          home_team: event.home_team,
          away_team: event.away_team,
          commence_time: event.commence_time,
          bookmakers: event.bookmakers,
          external_id: `odds_${event.id}`,
          created_at: new Date().toISOString()
        }, { onConflict: 'external_id' });

        if (!error) stats.odds++;

        // Create betting insights
        if (event.bookmakers && event.bookmakers.length > 0) {
          const bestOdds = event.bookmakers[0];
          const spread = bestOdds.markets?.find((m: any) => m.key === 'spreads');
          
          if (spread) {
            const { error: newsError } = await supabase.from('news_articles').insert({
              title: `Betting Update: ${event.away_team} @ ${event.home_team}`,
              content: `Latest odds show ${event.home_team} favored by ${Math.abs(spread.outcomes[0].point)} points. Multiple sportsbooks are offering action on this ${sport.split('_')[1].toUpperCase()} matchup.`,
              source: 'The Odds API',
              url: `https://the-odds-api.com/`,
              published_at: new Date().toISOString()
            });

            if (!newsError) stats.news++;
          }
        }
      }
    }

    console.log(`✅ Betting odds: ${stats.odds} odds, ${stats.news} insights`);

  } catch (error: any) {
    console.error('❌ Odds collection error:', error.message);
    stats.errors++;
  }
}

// 🌤️ COLLECT WEATHER DATA (using hardcoded cities)
async function collectWeatherData() {
  if (!APIs.openWeather.available) {
    console.log('⚠️  OpenWeather API key not available');
    return;
  }

  console.log('🌤️ Collecting real weather data...');

  try {
    // Use unique cities (remove duplicates)
    const cities = [...new Set(NFL_CITIES)];
    
    for (const city of cities) {
      try {
        const weatherUrl = `${APIs.openWeather.baseUrl}/weather`;
        const response = await axios.get(weatherUrl, {
          params: {
            q: city,
            appid: APIs.openWeather.key,
            units: 'imperial'
          }
        });

        const weather = response.data;
        
        // Store weather data
        const { error } = await supabase.from('weather_conditions').upsert({
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

        if (!error) stats.weather++;

        // Create weather impact news
        if (weather.wind.speed > 20 || weather.weather[0].main === 'Snow' || weather.weather[0].main === 'Rain') {
          const { error: newsError } = await supabase.from('news_articles').insert({
            title: `Weather Alert: ${weather.weather[0].main} conditions in ${city}`,
            content: `Current conditions in ${city}: ${weather.weather[0].description} with ${weather.main.temp}°F temperature and ${weather.wind.speed} mph winds. This could impact games and fantasy performance.`,
            source: 'Weather Impact Analysis',
            url: `https://openweathermap.org/city/${weather.id}`,
            published_at: new Date().toISOString()
          });

          if (!newsError) stats.news++;
        }
      } catch (cityError) {
        // Continue with next city if one fails
      }
    }

    console.log(`✅ Weather: ${stats.weather} cities tracked`);

  } catch (error: any) {
    console.error('❌ Weather collection error:', error.message);
    stats.errors++;
  }
}

// 📊 SHOW STATS
function showStats() {
  const runtime = Math.floor((Date.now() - stats.startTime) / 1000);
  const total = stats.players + stats.games + stats.odds + stats.weather + stats.news + stats.stats;
  
  console.clear();
  console.log('🔥 REAL DATA COLLECTOR STATS');
  console.log('============================\n');
  
  console.log(`⏱️  Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`);
  console.log(`📈 Total collected: ${total.toLocaleString()}\n`);
  
  console.log('📊 Breakdown:');
  console.log(`  🏃 Players: ${stats.players.toLocaleString()}`);
  console.log(`  🏈 Games: ${stats.games.toLocaleString()}`);
  console.log(`  📈 Stats: ${stats.stats.toLocaleString()}`);
  console.log(`  💰 Odds: ${stats.odds.toLocaleString()}`);
  console.log(`  🌤️ Weather: ${stats.weather.toLocaleString()}`);
  console.log(`  📰 News: ${stats.news.toLocaleString()}`);
  console.log(`  ❌ Errors: ${stats.errors}`);
  
  console.log('\n🔌 API Status:');
  console.log(`  ✅ BallDontLie: Connected (no key needed)`);
  console.log(`  ${APIs.theOdds.available ? '✅' : '❌'} The Odds API`);
  console.log(`  ${APIs.openWeather.available ? '✅' : '❌'} OpenWeather API`);
  console.log(`  ${APIs.mySportsFeeds.available ? '✅' : '❌'} MySportsFeeds`);
  console.log(`  ${APIs.sportsRadar.available ? '✅' : '❌'} SportsRadar`);
}

// 🚀 MAIN EXECUTION
async function main() {
  console.log('🚀 Starting REAL data collection (no teams.city needed)...\n');
  
  // Test database connection
  const { error } = await supabase.from('players').select('count').limit(1);
  if (error) {
    console.error('❌ Database connection failed:', error.message);
    return;
  }
  
  console.log('✅ Database connected!\n');
  
  // Initial collection
  await collectNBAData();
  await collectBettingOdds();
  await collectWeatherData();
  
  // Show initial stats
  showStats();
  
  // Schedule recurring collections
  console.log('\n📅 Scheduling recurring collections...');
  
  // NBA data every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await collectNBAData();
  });
  
  // Betting odds every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    await collectBettingOdds();
  });
  
  // Weather every hour
  cron.schedule('0 * * * *', async () => {
    await collectWeatherData();
  });
  
  // Update stats display every 30 seconds
  setInterval(showStats, 30000);
  
  console.log('✅ Real data collection active!\n');
  console.log('Press Ctrl+C to stop\n');
}

// Handle shutdown
process.on('SIGINT', () => {
  showStats();
  console.log('\n\n👋 Shutting down real data collector...');
  process.exit(0);
});

// Start collection
main().catch(console.error);