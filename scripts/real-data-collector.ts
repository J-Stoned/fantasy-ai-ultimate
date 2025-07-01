#!/usr/bin/env tsx
/**
 * 🔥 REAL DATA COLLECTOR - Uses actual sports APIs, no mock data!
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import cron from 'node-cron';

dotenv.config({ path: '.env.local' });

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// API Configuration
const APIs = {
  ballDontLie: {
    key: process.env.BALLDONTLIE_API_KEY,
    baseUrl: 'https://www.balldontlie.io/api/v1',
    available: !!process.env.BALLDONTLIE_API_KEY
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
    nflUrl: 'https://api.sportradar.com/nfl/official/trial/v7/en',
    nbaUrl: 'https://api.sportradar.com/nba/trial/v8/en',
    mlbUrl: 'https://api.sportradar.com/mlb/trial/v7/en',
    nhlUrl: 'https://api.sportradar.com/nhl/trial/v7/en',
    available: !!process.env.SPORTRADAR_API_KEY
  }
};

// Rate limiting
const rateLimits = {
  ballDontLie: { requests: 60, per: 60000 }, // 60 per minute
  mySportsFeeds: { requests: 250, per: 300000 }, // 250 per 5 minutes
  theOdds: { requests: 500, per: 3600000 }, // 500 per hour
  openWeather: { requests: 60, per: 60000 }, // 60 per minute
  sportsRadar: { requests: 1000, per: 86400000 } // 1000 per day for trial
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

// 🏀 COLLECT NBA DATA (BallDontLie API)
async function collectNBAData() {
  if (!APIs.ballDontLie.available) {
    console.log('⚠️  BallDontLie API key not available');
    return;
  }

  console.log('🏀 Collecting real NBA data...');

  try {
    // Get current season
    const currentYear = new Date().getFullYear();
    const season = new Date().getMonth() >= 9 ? currentYear : currentYear - 1;

    // Collect players
    const playersResponse = await axios.get(`${APIs.ballDontLie.baseUrl}/players`, {
      params: { per_page: 100 },
      headers: { 'Authorization': APIs.ballDontLie.key }
    });

    for (const player of playersResponse.data.data) {
      if (player.first_name && player.last_name) {
        const { error } = await supabase.from('players').upsert({
          firstname: player.first_name,
          lastname: player.last_name,
          position: player.position ? [player.position] : ['G'],
          team_id: player.team?.id || null,
          jersey_number: player.jersey_number || null,
          sport_id: 'nba',
          status: 'active',
          heightinches: player.height_feet ? (player.height_feet * 12 + (player.height_inches || 0)) : null,
          weightlbs: player.weight_pounds || null,
          external_id: `balldontlie_${player.id}`
        }, { onConflict: 'external_id' });

        if (!error) stats.players++;
      }
    }

    // Collect recent games
    const gamesResponse = await axios.get(`${APIs.ballDontLie.baseUrl}/games`, {
      params: { 
        seasons: [season],
        per_page: 100 
      },
      headers: { 'Authorization': APIs.ballDontLie.key }
    });

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

    // Collect player stats for recent games
    const statsResponse = await axios.get(`${APIs.ballDontLie.baseUrl}/stats`, {
      params: {
        seasons: [season],
        per_page: 100
      },
      headers: { 'Authorization': APIs.ballDontLie.key }
    });

    for (const stat of statsResponse.data.data) {
      if (stat.player && stat.game) {
        const { error } = await supabase.from('player_stats').upsert({
          player_id: stat.player.id,
          game_id: stat.game.id,
          points: stat.pts,
          assists: stat.ast,
          rebounds: stat.reb,
          steals: stat.stl,
          blocks: stat.blk,
          turnovers: stat.turnover,
          field_goals_made: stat.fgm,
          field_goals_attempted: stat.fga,
          three_pointers_made: stat.fg3m,
          three_pointers_attempted: stat.fg3a,
          free_throws_made: stat.ftm,
          free_throws_attempted: stat.fta,
          minutes: stat.min,
          external_id: `balldontlie_stat_${stat.id}`
        }, { onConflict: 'external_id' });

        if (!error) stats.stats++;
      }
    }

    console.log(`✅ NBA: ${stats.players} players, ${stats.games} games, ${stats.stats} stats`);

  } catch (error: any) {
    console.error('❌ NBA collection error:', error.message);
    stats.errors++;
  }
}

// 🏈 COLLECT MULTI-SPORT DATA (MySportsFeeds API)
async function collectMySportsFeedsData() {
  if (!APIs.mySportsFeeds.available) {
    console.log('⚠️  MySportsFeeds API key not available');
    return;
  }

  console.log('🏈 Collecting real multi-sport data...');

  try {
    const sports = ['nfl', 'nba', 'mlb', 'nhl'];
    const currentYear = new Date().getFullYear();
    
    for (const sport of sports) {
      // Get current season info
      const season = sport === 'nfl' ? `${currentYear}-regular` : `${currentYear}-${currentYear + 1}-regular`;
      
      // Collect players
      const playersUrl = `${APIs.mySportsFeeds.baseUrl}/${sport}/${season}/players.json`;
      const playersResponse = await axios.get(playersUrl, {
        auth: {
          username: APIs.mySportsFeeds.key!,
          password: 'MYSPORTSFEEDS'
        }
      });

      if (playersResponse.data.players) {
        for (const playerData of playersResponse.data.players) {
          const player = playerData.player;
          const { error } = await supabase.from('players').upsert({
            firstname: player.firstName,
            lastname: player.lastName,
            position: player.primaryPosition ? [player.primaryPosition] : [],
            jersey_number: player.jerseyNumber || null,
            sport_id: sport,
            status: player.currentRosterStatus || 'active',
            birthdate: player.birthDate,
            heightinches: player.height || null,
            weightlbs: player.weight || null,
            external_id: `msf_${sport}_${player.id}`
          }, { onConflict: 'external_id' });

          if (!error) stats.players++;
        }
      }

      // Collect games
      const gamesUrl = `${APIs.mySportsFeeds.baseUrl}/${sport}/${season}/games.json`;
      const gamesResponse = await axios.get(gamesUrl, {
        auth: {
          username: APIs.mySportsFeeds.key!,
          password: 'MYSPORTSFEEDS'
        }
      });

      if (gamesResponse.data.games) {
        for (const gameData of gamesResponse.data.games) {
          const game = gameData.game;
          const { error } = await supabase.from('games').upsert({
            home_team_id: game.homeTeam.id,
            away_team_id: game.awayTeam.id,
            home_score: game.homeScoreTotal || null,
            away_score: game.awayScoreTotal || null,
            start_time: game.startTime,
            status: game.playedStatus,
            sport_id: sport,
            season: currentYear,
            week: game.week || null,
            external_id: `msf_${sport}_game_${game.id}`
          }, { onConflict: 'external_id' });

          if (!error) stats.games++;
        }
      }
    }

    console.log(`✅ MySportsFeeds: ${stats.players} players, ${stats.games} games`);

  } catch (error: any) {
    console.error('❌ MySportsFeeds error:', error.message);
    stats.errors++;
  }
}

// 💰 COLLECT BETTING ODDS (The Odds API)
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

        // Create related news/insights
        if (event.bookmakers && event.bookmakers.length > 0) {
          const bestOdds = event.bookmakers[0];
          const spread = bestOdds.markets?.find((m: any) => m.key === 'spreads');
          
          if (spread) {
            const { error: newsError } = await supabase.from('news_articles').insert({
              title: `Betting Update: ${event.away_team} @ ${event.home_team}`,
              content: `Latest odds show ${event.home_team} favored by ${Math.abs(spread.outcomes[0].point)} points. Multiple sportsbooks are offering action on this ${sport.split('_')[1].toUpperCase()} matchup.`,
              source: 'The Odds API',
              url: `https://odds-api.com/${event.id}`,
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

// 🌤️ COLLECT WEATHER DATA
async function collectWeatherData() {
  if (!APIs.openWeather.available) {
    console.log('⚠️  OpenWeather API key not available');
    return;
  }

  console.log('🌤️ Collecting real weather data...');

  try {
    // Get all teams with cities
    const { data: teams } = await supabase
      .from('teams')
      .select('id, city, name')
      .not('city', 'is', null);

    if (!teams || teams.length === 0) {
      // Add some default NFL cities if no teams exist
      const nflCities = [
        { city: 'New York', team: 'Giants' },
        { city: 'Los Angeles', team: 'Rams' },
        { city: 'Chicago', team: 'Bears' },
        { city: 'Dallas', team: 'Cowboys' },
        { city: 'Green Bay', team: 'Packers' },
        { city: 'Seattle', team: 'Seahawks' },
        { city: 'Miami', team: 'Dolphins' },
        { city: 'Denver', team: 'Broncos' }
      ];

      for (const team of nflCities) {
        const weatherUrl = `${APIs.openWeather.baseUrl}/weather`;
        const response = await axios.get(weatherUrl, {
          params: {
            q: team.city,
            appid: APIs.openWeather.key,
            units: 'imperial'
          }
        });

        const weather = response.data;
        
        // Store weather data
        const { error } = await supabase.from('weather_conditions').upsert({
          city: team.city,
          temperature: weather.main.temp,
          feels_like: weather.main.feels_like,
          conditions: weather.weather[0].main,
          description: weather.weather[0].description,
          wind_speed: weather.wind.speed,
          humidity: weather.main.humidity,
          visibility: weather.visibility,
          external_id: `weather_${team.city}_${Date.now()}`
        }, { onConflict: 'external_id' });

        if (!error) stats.weather++;

        // Create weather impact news
        if (weather.wind.speed > 20 || weather.weather[0].main === 'Snow' || weather.weather[0].main === 'Rain') {
          const { error: newsError } = await supabase.from('news_articles').insert({
            title: `Weather Alert: ${weather.weather[0].main} conditions in ${team.city}`,
            content: `Current conditions in ${team.city}: ${weather.weather[0].description} with ${weather.main.temp}°F temperature and ${weather.wind.speed} mph winds. This could impact ${team.team} games and fantasy performance.`,
            source: 'Weather Impact Analysis',
            url: `https://openweathermap.org/city/${weather.id}`,
            published_at: new Date().toISOString()
          });

          if (!newsError) stats.news++;
        }
      }
    } else {
      // Use existing teams
      for (const team of teams) {
        const weatherUrl = `${APIs.openWeather.baseUrl}/weather`;
        const response = await axios.get(weatherUrl, {
          params: {
            q: team.city,
            appid: APIs.openWeather.key,
            units: 'imperial'
          }
        });

        const weather = response.data;
        stats.weather++;
      }
    }

    console.log(`✅ Weather: ${stats.weather} cities tracked`);

  } catch (error: any) {
    console.error('❌ Weather collection error:', error.message);
    stats.errors++;
  }
}

// 🏆 COLLECT SPORTSRADAR DATA
async function collectSportsRadarData() {
  if (!APIs.sportsRadar.available) {
    console.log('⚠️  SportsRadar API key not available');
    return;
  }

  console.log('🏆 Collecting premium SportsRadar data...');

  try {
    // NFL Data
    const nflRosterUrl = `${APIs.sportsRadar.nflUrl}/teams/hierarchy.json?api_key=${APIs.sportsRadar.key}`;
    const nflResponse = await axios.get(nflRosterUrl);
    
    if (nflResponse.data.conferences) {
      for (const conference of nflResponse.data.conferences) {
        for (const division of conference.divisions) {
          for (const team of division.teams) {
            // Store team data
            await supabase.from('teams').upsert({
              id: team.id,
              name: team.name,
              city: team.market,
              abbreviation: team.alias,
              sport_id: 'nfl',
              conference: conference.name,
              division: division.name,
              external_id: `sr_nfl_${team.id}`
            }, { onConflict: 'external_id' });
            
            // Get team roster
            const rosterUrl = `${APIs.sportsRadar.nflUrl}/teams/${team.id}/profile.json?api_key=${APIs.sportsRadar.key}`;
            await new Promise(resolve => setTimeout(resolve, 1100)); // Rate limit: 1 request per second
            
            try {
              const rosterResponse = await axios.get(rosterUrl);
              if (rosterResponse.data.players) {
                for (const player of rosterResponse.data.players) {
                  await supabase.from('players').upsert({
                    firstname: player.name_first || player.first_name,
                    lastname: player.name_last || player.last_name,
                    position: [player.position],
                    jersey_number: player.jersey_number || player.jersey,
                    team_id: team.id,
                    sport_id: 'nfl',
                    status: player.status || 'active',
                    birthdate: player.birth_date,
                    heightinches: player.height,
                    weightlbs: player.weight,
                    college: player.college,
                    experience: player.experience,
                    external_id: `sr_nfl_player_${player.id}`
                  }, { onConflict: 'external_id' });
                  
                  stats.players++;
                }
              }
            } catch (rosterError) {
              console.error(`Failed to get roster for ${team.name}`);
            }
          }
        }
      }
    }

    // NBA Data
    const nbaScheduleUrl = `${APIs.sportsRadar.nbaUrl}/seasons/2024/REG/schedule.json?api_key=${APIs.sportsRadar.key}`;
    await new Promise(resolve => setTimeout(resolve, 1100)); // Rate limit
    
    const nbaResponse = await axios.get(nbaScheduleUrl);
    if (nbaResponse.data.games) {
      for (const game of nbaResponse.data.games.slice(0, 50)) { // Get first 50 games
        await supabase.from('games').upsert({
          home_team_id: game.home.id,
          away_team_id: game.away.id,
          start_time: game.scheduled,
          status: game.status,
          sport_id: 'nba',
          season: 2024,
          home_score: game.home_points,
          away_score: game.away_points,
          external_id: `sr_nba_game_${game.id}`
        }, { onConflict: 'external_id' });
        
        stats.games++;
      }
    }

    // Get injury reports
    const injuryUrl = `${APIs.sportsRadar.nflUrl}/reports/injuries.json?api_key=${APIs.sportsRadar.key}`;
    await new Promise(resolve => setTimeout(resolve, 1100)); // Rate limit
    
    const injuryResponse = await axios.get(injuryUrl);
    if (injuryResponse.data.teams) {
      for (const team of injuryResponse.data.teams) {
        if (team.injuries) {
          for (const injury of team.injuries) {
            // Create injury news
            await supabase.from('news_articles').insert({
              title: `Injury Update: ${injury.full_name} - ${injury.injury.desc}`,
              content: `${injury.full_name} (${injury.position}) is listed as ${injury.injury.status} with ${injury.injury.desc}. Last updated: ${injury.injury.update_date}`,
              source: 'SportsRadar Official',
              url: `https://sportradar.com/nfl/injuries/${team.id}`,
              published_at: new Date().toISOString()
            });
            
            stats.news++;
          }
        }
      }
    }

    console.log(`✅ SportsRadar: ${stats.players} players, ${stats.games} games, ${stats.news} injury reports`);

  } catch (error: any) {
    console.error('❌ SportsRadar collection error:', error.message);
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
  Object.entries(APIs).forEach(([name, api]) => {
    console.log(`  ${api.available ? '✅' : '❌'} ${name}: ${api.available ? 'Connected' : 'No API key'}`);
  });
}

// 🚀 MAIN EXECUTION
async function main() {
  console.log('🚀 Starting REAL data collection...\n');
  
  // Test database connection
  const { error } = await supabase.from('players').select('count').limit(1);
  if (error) {
    console.error('❌ Database connection failed:', error.message);
    return;
  }
  
  console.log('✅ Database connected!\n');
  
  // Initial collection
  await collectNBAData();
  await collectMySportsFeedsData();
  await collectBettingOdds();
  await collectWeatherData();
  await collectSportsRadarData();
  
  // Show initial stats
  showStats();
  
  // Schedule recurring collections
  console.log('\n📅 Scheduling recurring collections...');
  
  // NBA data every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await collectNBAData();
  });
  
  // MySportsFeeds every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    await collectMySportsFeedsData();
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