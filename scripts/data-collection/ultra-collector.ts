#!/usr/bin/env tsx
/**
 * ⚡ ULTRA COLLECTOR - Maximum speed with all working APIs
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
  total: 0,
  odds: 0,
  weather: 0,
  news: 0,
  nba: 0,
  errors: 0,
  startTime: Date.now()
};

// 🏀 Fast NBA collection (no auth needed for v1)
async function collectNBA() {
  try {
    // Get all NBA teams
    const teamsRes = await axios.get('https://api.balldontlie.io/v1/teams');
    for (const team of teamsRes.data.data) {
      await supabase.from('teams').upsert({
        id: team.id,
        name: `${team.city} ${team.name}`,
        abbreviation: team.abbreviation,
        sport_id: 'nba',
        conference: team.conference,
        division: team.division,
        external_id: `nba_team_${team.id}`
      }, { onConflict: 'external_id' });
      stats.nba++;
    }

    // Get recent games (current season)
    const season = new Date().getFullYear() - 1;
    const gamesRes = await axios.get(`https://api.balldontlie.io/v1/games?seasons[]=${season}&per_page=100`);
    
    for (const game of gamesRes.data.data) {
      await supabase.from('games').upsert({
        home_team_id: game.home_team.id,
        away_team_id: game.visitor_team.id,
        home_score: game.home_team_score,
        away_score: game.visitor_team_score,
        start_time: game.date,
        status: game.status,
        sport_id: 'nba',
        season: season,
        external_id: `nba_game_${game.id}`
      }, { onConflict: 'external_id' });
      stats.nba++;
    }

    // Get some players
    const playersRes = await axios.get('https://api.balldontlie.io/v1/players?per_page=100');
    for (const player of playersRes.data.data) {
      if (player.first_name && player.last_name) {
        await supabase.from('players').upsert({
          firstname: player.first_name,
          lastname: player.last_name,
          position: player.position || 'G',
          team_id: player.team?.id,
          sport_id: 'nba',
          status: 'active',
          external_id: `nba_player_${player.id}`
        }, { onConflict: 'external_id' });
        stats.nba++;
      }
    }
  } catch (error: any) {
    console.error(chalk.red('NBA error:', error.message));
    stats.errors++;
  }
}

// 💰 Turbo betting odds collection
async function collectAllOdds() {
  const sports = [
    'americanfootball_nfl', 'basketball_nba', 'baseball_mlb', 
    'icehockey_nhl', 'soccer_epl', 'golf_pga_championship_winner'
  ];

  for (const sport of sports) {
    try {
      const { data } = await axios.get(
        `https://api.the-odds-api.com/v4/sports/${sport}/odds`,
        {
          params: {
            apiKey: process.env.THE_ODDS_API_KEY,
            regions: 'us',
            markets: 'h2h,spreads,totals'
          }
        }
      );

      for (const event of data) {
        await supabase.from('betting_odds').upsert({
          sport_id: sport.split('_')[0],
          home_team: event.home_team,
          away_team: event.away_team,
          commence_time: event.commence_time,
          bookmakers: event.bookmakers,
          external_id: `odds_${event.id}`
        }, { onConflict: 'external_id' });
        stats.odds++;

        // Create news for each game
        if (event.bookmakers?.length > 0) {
          const lines = event.bookmakers[0];
          await supabase.from('news_articles').insert({
            title: `${sport.toUpperCase()}: ${event.away_team} @ ${event.home_team}`,
            content: `Game time: ${new Date(event.commence_time).toLocaleString()}. Check latest odds from ${event.bookmakers.length} bookmakers.`,
            source: 'Live Betting Feed',
            published_at: new Date().toISOString()
          });
          stats.news++;
        }
      }
    } catch (err) {
      // Continue with next sport
    }
  }
}

// 🌤️ Mass weather collection
async function collectAllWeather() {
  const cities = [
    // All major sports cities
    'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
    'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
    'Fort Worth', 'Columbus', 'San Francisco', 'Charlotte', 'Indianapolis',
    'Seattle', 'Denver', 'Washington', 'Boston', 'El Paso', 'Detroit',
    'Nashville', 'Portland', 'Memphis', 'Oklahoma City', 'Las Vegas',
    'Baltimore', 'Milwaukee', 'Albuquerque', 'Tucson', 'Fresno', 'Mesa',
    'Sacramento', 'Atlanta', 'Kansas City', 'Colorado Springs', 'Miami',
    'Raleigh', 'Omaha', 'Long Beach', 'Virginia Beach', 'Oakland',
    'Minneapolis', 'Tulsa', 'Arlington', 'Tampa', 'New Orleans',
    // Canadian cities
    'Toronto', 'Montreal', 'Vancouver', 'Calgary', 'Edmonton', 'Ottawa'
  ];

  for (const city of cities) {
    try {
      const { data } = await axios.get(
        'https://api.openweathermap.org/data/2.5/weather',
        {
          params: {
            q: city,
            appid: process.env.OPENWEATHER_API_KEY,
            units: 'imperial'
          }
        }
      );

      await supabase.from('weather_conditions').upsert({
        city: city,
        temperature: data.main.temp,
        feels_like: data.main.feels_like,
        conditions: data.weather[0].main,
        description: data.weather[0].description,
        wind_speed: data.wind.speed,
        humidity: data.main.humidity,
        visibility: data.visibility,
        external_id: `weather_${city}_${new Date().toISOString().split('T')[0]}`
      }, { onConflict: 'external_id' });
      stats.weather++;

      // Weather alerts for extreme conditions
      if (data.main.temp < 20 || data.main.temp > 95 || data.wind.speed > 25) {
        await supabase.from('news_articles').insert({
          title: `Extreme Weather Alert: ${city}`,
          content: `${data.weather[0].description}. Temp: ${data.main.temp}°F, Wind: ${data.wind.speed} mph. This will significantly impact outdoor sports.`,
          source: 'Weather Alert System',
          published_at: new Date().toISOString()
        });
        stats.news++;
      }
    } catch (err) {
      // Skip city if error
    }
  }
}

// 📊 Show real-time stats
function showStats() {
  const runtime = Math.floor((Date.now() - stats.startTime) / 1000);
  stats.total = stats.odds + stats.weather + stats.news + stats.nba;
  
  console.clear();
  console.log(chalk.cyan('⚡ ULTRA COLLECTOR'));
  console.log(chalk.cyan('==================\n'));
  
  console.log(chalk.yellow(`Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`));
  console.log(chalk.yellow(`Speed: ${Math.floor(stats.total / (runtime || 1))} records/sec\n`));
  
  console.log('📊 Live Stats:');
  console.log(`  🏀 NBA: ${stats.nba.toLocaleString()}`);
  console.log(`  💰 Odds: ${stats.odds.toLocaleString()}`);
  console.log(`  🌤️ Weather: ${stats.weather.toLocaleString()}`);
  console.log(`  📰 News: ${stats.news.toLocaleString()}`);
  
  console.log(chalk.green(`\n🔥 TOTAL: ${stats.total.toLocaleString()} records`));
  
  // Projections
  const rate = stats.total / (runtime || 1);
  console.log(chalk.cyan(`\n📈 Projected:`));
  console.log(`  1 hour: ${Math.floor(rate * 3600).toLocaleString()}`);
  console.log(`  24 hours: ${Math.floor(rate * 86400).toLocaleString()}`);
}

// 🚀 Main execution
async function main() {
  console.log(chalk.cyan('⚡ ULTRA COLLECTOR - STARTING...\n'));
  
  // Initial burst - collect everything
  await Promise.all([
    collectNBA(),
    collectAllOdds(),
    collectAllWeather()
  ]);
  
  showStats();
  
  // Continuous collection
  setInterval(async () => {
    await Promise.all([
      collectNBA(),
      collectAllOdds()
    ]);
  }, 300000); // Every 5 minutes
  
  setInterval(collectAllWeather, 1800000); // Weather every 30 min
  setInterval(showStats, 5000); // Update display every 5 sec
  
  console.log(chalk.green('\n✅ Ultra collector running!\n'));
}

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
  stats.errors++;
});

main().catch(console.error);