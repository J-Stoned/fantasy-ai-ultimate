#!/usr/bin/env tsx
/**
 * MEGA DATA COLLECTOR
 * Collects from ALL free sports APIs in parallel
 * Target: 1M+ records
 */

import chalk from 'chalk';
import * as cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Rate limiters for each API
const limits = {
  espn: pLimit(50),      // 50 concurrent
  sleeper: pLimit(100),  // 1000/min = ~16/sec, we'll do 100 concurrent
  reddit: pLimit(10),    // 60/hour = 1/min, be conservative
  odds: pLimit(5),       // 500/month, be very conservative
  weather: pLimit(10),   // 1000/day = ~40/hour
  nba: pLimit(20),       // 60/min = 1/sec
  nfl: pLimit(100),      // NFL official - no rate limit
  espnFantasy: pLimit(50), // ESPN fantasy - no limit but be nice
  twitter: pLimit(10),   // Twitter - 500k/month
  sportsdata: pLimit(1), // SportsData.io - 1000/month, very conservative
};

// Stats tracking
const stats = {
  players: 0,
  teams: 0,
  games: 0,
  news: 0,
  odds: 0,
  weather: 0,
  sentiment: 0,
  errors: 0,
  startTime: Date.now(),
};

console.log(chalk.red.bold('\n🔥 MEGA DATA COLLECTOR ACTIVATED'));
console.log(chalk.red('==================================\n'));

// ESPN COLLECTOR
async function collectESPN() {
  console.log(chalk.yellow('📡 ESPN Collector starting...'));
  
  const sports = [
    { id: 'football', league: 'nfl', name: 'NFL' },
    { id: 'basketball', league: 'nba', name: 'NBA' },
    { id: 'baseball', league: 'mlb', name: 'MLB' },
    { id: 'hockey', league: 'nhl', name: 'NHL' },
    { id: 'football', league: 'college-football', name: 'NCAAF' },
    { id: 'basketball', league: 'mens-college-basketball', name: 'NCAAB' },
  ];
  
  for (const sport of sports) {
    try {
      // Get teams
      await limits.espn(async () => {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.id}/${sport.league}/teams`;
        const { data } = await axios.get(url);
        
        if (data.sports?.[0]?.leagues?.[0]?.teams) {
          const teams = data.sports[0].leagues[0].teams;
          
          for (const teamData of teams) {
            const team = teamData.team;
            await supabase.from('teams').upsert({
              name: team.displayName,
              city: team.location,
              abbreviation: team.abbreviation,
              sport_id: sport.league,
              league_id: sport.name,
              logo_url: team.logos?.[0]?.href,
              external_id: `${sport.league}_${team.id}`
            }, { onConflict: 'external_id' });
            
            stats.teams++;
          }
        }
      });
      
      // Get scoreboard
      await limits.espn(async () => {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.id}/${sport.league}/scoreboard`;
        const { data } = await axios.get(url);
        
        if (data.events) {
          for (const event of data.events) {
            const competition = event.competitions[0];
            const home = competition.competitors.find(t => t.homeAway === 'home');
            const away = competition.competitors.find(t => t.homeAway === 'away');
            
            if (home && away) {
              await supabase.from('games').upsert({
                home_team_id: home.id,
                away_team_id: away.id,
                sport_id: sport.league,
                start_time: event.date,
                venue: competition.venue?.fullName,
                status: competition.status.type.name,
                home_score: parseInt(home.score) || null,
                away_score: parseInt(away.score) || null,
                external_id: `${sport.league}_${event.id}`
              }, { onConflict: 'external_id' });
              
              stats.games++;
            }
          }
        }
      });
      
      // Get news
      await limits.espn(async () => {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.id}/${sport.league}/news`;
        const { data } = await axios.get(url);
        
        if (data.articles) {
          for (const article of data.articles) {
            await supabase.from('news_articles').upsert({
              title: article.headline,
              url: article.links?.web?.href || '',
              source: 'ESPN',
              sport_id: sport.league,
              summary: article.description,
              published_at: article.published,
              external_id: `espn_${article.id}`
            }, { onConflict: 'url' });
            
            stats.news++;
          }
        }
      });
      
    } catch (error) {
      stats.errors++;
      console.error(chalk.red(`ESPN ${sport.name} error:`, error.message));
    }
  }
}

// SLEEPER COLLECTOR (BEST FREE API!)
async function collectSleeper() {
  console.log(chalk.yellow('😴 Sleeper Collector starting...'));
  
  try {
    // Get all NFL players
    await limits.sleeper(async () => {
      const { data: players } = await axios.get('https://api.sleeper.app/v1/players/nfl');
      
      const playerArray = Object.values(players);
      console.log(chalk.green(`Found ${playerArray.length} NFL players from Sleeper!`));
      
      // Process in batches
      const batchSize = 100;
      for (let i = 0; i < playerArray.length; i += batchSize) {
        const batch = playerArray.slice(i, i + batchSize);
        
        const playerInserts = batch.map((player: any) => ({
          firstname: player.first_name,
          lastname: player.last_name,
          position: [player.position],
          sport_id: 'nfl',
          status: player.injury_status || 'active',
          external_id: `sleeper_${player.player_id}`,
          jersey_number: player.number || null,
          heightinches: player.height ? parseInt(player.height) : null,
          weightlbs: player.weight ? parseInt(player.weight) : null,
        }));
        
        const { error } = await supabase.from('players').upsert(playerInserts, { 
          onConflict: 'external_id',
          ignoreDuplicates: true 
        });
        
        if (!error) {
          stats.players += batch.length;
        }
      }
    });
    
    // Get trending players
    await limits.sleeper(async () => {
      const { data: trending } = await axios.get('https://api.sleeper.app/v1/players/nfl/trending/add');
      console.log(chalk.green(`${trending.length} trending players on Sleeper`));
    });
    
  } catch (error) {
    stats.errors++;
    console.error(chalk.red('Sleeper error:', error.message));
  }
}

// REDDIT COLLECTOR
async function collectReddit() {
  console.log(chalk.yellow('🔥 Reddit Collector starting...'));
  
  const subreddits = [
    'fantasyfootball',
    'nfl', 
    'nba',
    'fantasy_football',
    'DynastyFF',
    'FFCommish',
    'fantasybball',
    'fantasybaseball',
    'fantasyhockey'
  ];
  
  for (const sub of subreddits) {
    try {
      await limits.reddit(async () => {
        const { data } = await axios.get(`https://www.reddit.com/r/${sub}/hot.json?limit=100`, {
          headers: { 'User-Agent': 'FantasyAI/1.0' }
        });
        
        if (data.data?.children) {
          for (const post of data.data.children) {
            const postData = post.data;
            
            // Extract player names mentioned
            const playerPattern = /([A-Z][a-z]+ [A-Z][a-z]+)/g;
            const mentions = postData.title.match(playerPattern) || [];
            
            // Store sentiment data
            await supabase.from('social_sentiment').upsert({
              platform: 'reddit',
              content: postData.title,
              author: postData.author,
              score: postData.score,
              url: `https://reddit.com${postData.permalink}`,
              sport_id: sub.includes('football') ? 'nfl' : 
                       sub.includes('bball') ? 'nba' : 
                       sub.includes('baseball') ? 'mlb' : 
                       sub.includes('hockey') ? 'nhl' : 'general',
              mentions: mentions,
              created_at: new Date(postData.created_utc * 1000).toISOString(),
              external_id: `reddit_${postData.id}`
            }, { onConflict: 'external_id' });
            
            stats.sentiment++;
          }
        }
      });
    } catch (error) {
      stats.errors++;
      console.error(chalk.red(`Reddit ${sub} error:`, error.message));
    }
  }
}

// WEATHER COLLECTOR
async function collectWeather() {
  console.log(chalk.yellow('🌤️ Weather Collector starting...'));
  
  if (!process.env.OPENWEATHER_API_KEY) {
    console.log(chalk.gray('No weather API key, skipping...'));
    return;
  }
  
  try {
    // Get all teams with venues
    const { data: teams } = await supabase
      .from('teams')
      .select('id, city, sport_id')
      .not('city', 'is', null);
    
    if (teams) {
      for (const team of teams) {
        await limits.weather(async () => {
          const { data } = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${team.city}&appid=${process.env.OPENWEATHER_API_KEY}`
          );
          
          await supabase.from('weather_data').upsert({
            location: team.city,
            temperature: Math.round((data.main.temp - 273.15) * 9/5 + 32), // K to F
            conditions: data.weather[0].main,
            wind_speed: Math.round(data.wind.speed * 2.237), // m/s to mph
            humidity: data.main.humidity,
            team_id: team.id
          });
          
          stats.weather++;
        });
      }
    }
  } catch (error) {
    stats.errors++;
    console.error(chalk.red('Weather error:', error.message));
  }
}

// NBA DATA COLLECTOR
async function collectNBA() {
  console.log(chalk.yellow('🏀 NBA Data Collector starting...'));
  
  if (!process.env.BALLDONTLIE_API_KEY) {
    console.log(chalk.gray('No BallDontLie API key, skipping...'));
    return;
  }
  
  try {
    // Get all NBA players
    await limits.nba(async () => {
      const { data } = await axios.get('https://www.balldontlie.io/api/v1/players?per_page=100', {
        headers: {
          'Authorization': process.env.BALLDONTLIE_API_KEY
        }
      });
      
      for (const player of data.data) {
        await supabase.from('players').upsert({
          firstname: player.first_name,
          lastname: player.last_name,
          position: [player.position],
          sport_id: 'nba',
          heightinches: player.height_feet ? (player.height_feet * 12 + (player.height_inches || 0)) : null,
          weightlbs: player.weight_pounds,
          external_id: `balldontlie_${player.id}`
        }, { onConflict: 'external_id' });
        
        stats.players++;
      }
      
      // Get more pages
      for (let page = 2; page <= 10; page++) {
        await limits.nba(async () => {
          const { data } = await axios.get(`https://www.balldontlie.io/api/v1/players?per_page=100&page=${page}`, {
            headers: {
              'Authorization': process.env.BALLDONTLIE_API_KEY
            }
          });
          
          for (const player of data.data) {
            await supabase.from('players').upsert({
              firstname: player.first_name,
              lastname: player.last_name,
              position: [player.position],
              sport_id: 'nba',
              external_id: `balldontlie_${player.id}`
            }, { onConflict: 'external_id' });
            
            stats.players++;
          }
        });
      }
    });
    
  } catch (error) {
    stats.errors++;
    console.error(chalk.red('NBA error:', error.message));
  }
}

// ODDS COLLECTOR
async function collectOdds() {
  console.log(chalk.yellow('💰 Odds Collector starting...'));
  
  if (!process.env.THE_ODDS_API_KEY) {
    console.log(chalk.gray('No odds API key, skipping...'));
    return;
  }
  
  const sports = [
    'americanfootball_nfl',
    'basketball_nba',
    'baseball_mlb',
    'icehockey_nhl'
  ];
  
  for (const sport of sports) {
    try {
      await limits.odds(async () => {
        const { data } = await axios.get(
          `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${process.env.THE_ODDS_API_KEY}&regions=us&markets=spreads,totals`
        );
        
        for (const game of data) {
          await supabase.from('betting_odds').upsert({
            sport_id: sport.split('_')[1],
            home_team: game.home_team,
            away_team: game.away_team,
            game_time: game.commence_time,
            bookmakers: game.bookmakers,
            external_id: `odds_${game.id}`
          }, { onConflict: 'external_id' });
          
          stats.odds++;
        }
      });
    } catch (error) {
      stats.errors++;
      console.error(chalk.red(`Odds ${sport} error:`, error.message));
    }
  }
}

// NFL OFFICIAL DATA COLLECTOR
async function collectNFLOfficial() {
  console.log(chalk.yellow('🏈 NFL Official Data Collector starting...'));
  
  try {
    // Get current week scores
    await limits.nfl(async () => {
      const { data } = await axios.get('https://www.nfl.com/feeds-rs/scores/');
      
      if (data.games) {
        for (const game of data.games) {
          await supabase.from('games').upsert({
            home_team_id: game.homeTeamAbbr,
            away_team_id: game.awayTeamAbbr,
            home_team_score: game.homeTeamScore || 0,
            away_team_score: game.awayTeamScore || 0,
            game_date: game.gameDate,
            week: game.week,
            status: game.phase,
            external_id: `nfl_${game.gameId}`
          }, { onConflict: 'external_id' });
          
          stats.games++;
        }
      }
    });
    
    // Get team rosters for popular teams
    const teams = ['KC', 'BUF', 'PHI', 'DAL', 'SF', 'GB'];
    for (const team of teams) {
      await limits.nfl(async () => {
        try {
          const { data } = await axios.get(`https://www.nfl.com/feeds-rs/teams/${team}/roster`);
          
          if (data.players) {
            for (const player of data.players) {
              await supabase.from('players').upsert({
                firstname: player.firstName,
                lastname: player.lastName,
                position: [player.position],
                jersey_number: player.jerseyNumber,
                sport_id: 'nfl',
                team_abbreviation: team,
                external_id: `nfl_${player.playerId}`
              }, { onConflict: 'external_id' });
              
              stats.players++;
            }
          }
        } catch (err) {
          console.error(`NFL roster ${team} error:`, err.message);
        }
      });
    }
  } catch (error) {
    stats.errors++;
    console.error(chalk.red('NFL Official error:', error.message));
  }
}

// ESPN FANTASY COLLECTOR
async function collectESPNFantasy() {
  console.log(chalk.yellow('🎮 ESPN Fantasy Collector starting...'));
  
  try {
    // Get player rankings
    await limits.espnFantasy(async () => {
      const { data } = await axios.get(
        'https://fantasy.espn.com/apis/v3/games/ffl/seasons/2024/segments/0/leaguedefaults/3?view=kona_player_info'
      );
      
      if (data.players) {
        for (const playerData of data.players.slice(0, 200)) { // Top 200 players
          const player = playerData.player;
          
          await supabase.from('fantasy_rankings').upsert({
            player_name: player.fullName,
            player_id: player.id,
            position: player.defaultPositionId,
            team_id: player.proTeamId,
            ownership_pct: player.ownership?.percentOwned || 0,
            adp: player.ownership?.averageDraftPosition || 999,
            platform: 'espn',
            external_id: `espn_fantasy_${player.id}`
          }, { onConflict: 'external_id' });
          
          stats.players++;
        }
      }
    });
    
    // Get trending players
    await limits.espnFantasy(async () => {
      const { data } = await axios.get(
        'https://fantasy.espn.com/apis/v3/games/ffl/seasons/2024/segments/0/leaguedefaults/3?view=kona_player_info&filter=' +
        encodeURIComponent(JSON.stringify({
          players: {
            filterStatsForMostRecentScoringPeriod: { value: true },
            limit: 50,
            sortDraftPercentChange: { sortPriority: 1, sortAsc: false }
          }
        }))
      );
      
      if (data.players) {
        for (const playerData of data.players) {
          const player = playerData.player;
          
          await supabase.from('trending_players').upsert({
            player_name: player.fullName,
            player_id: player.id,
            trend_type: 'most_added',
            platform: 'espn',
            ownership_change: player.ownership?.percentChange || 0,
            created_at: new Date().toISOString(),
            external_id: `espn_trend_${player.id}_${new Date().toISOString().split('T')[0]}`
          }, { onConflict: 'external_id' });
        }
      }
    });
  } catch (error) {
    stats.errors++;
    console.error(chalk.red('ESPN Fantasy error:', error.message));
  }
}

// TWITTER COLLECTOR (if configured)
async function collectTwitter() {
  if (!process.env.TWITTER_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN === 'your-twitter-bearer-token') {
    console.log(chalk.gray('No Twitter API token, skipping...'));
    return;
  }
  
  console.log(chalk.yellow('🐦 Twitter Collector starting...'));
  
  try {
    // Search for NFL injury news
    await limits.twitter(async () => {
      const { data } = await axios.get(
        'https://api.twitter.com/2/tweets/search/recent?query=' +
        encodeURIComponent('"injury" OR "injured" (NFL OR football) -is:retweet lang:en') +
        '&max_results=50&tweet.fields=created_at,public_metrics',
        {
          headers: {
            'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
          }
        }
      );
      
      if (data.data) {
        for (const tweet of data.data) {
          await supabase.from('social_sentiment').upsert({
            platform: 'twitter',
            content: tweet.text,
            url: `https://twitter.com/i/status/${tweet.id}`,
            engagement_score: (tweet.public_metrics?.retweet_count || 0) + 
                            (tweet.public_metrics?.like_count || 0),
            sport_id: 'nfl',
            created_at: tweet.created_at,
            external_id: `twitter_${tweet.id}`
          }, { onConflict: 'external_id' });
          
          stats.sentiment++;
        }
      }
    });
  } catch (error) {
    stats.errors++;
    console.error(chalk.red('Twitter error:', error.message));
  }
}

// SPORTSDATA.IO COLLECTOR (if configured)
async function collectSportsDataIO() {
  if (!process.env.SPORTSDATA_IO_KEY || process.env.SPORTSDATA_IO_KEY === 'your-sportsdata-key') {
    console.log(chalk.gray('No SportsData.io API key, skipping...'));
    return;
  }
  
  console.log(chalk.yellow('📊 SportsData.io Collector starting...'));
  
  try {
    // Get weekly projections (uses 1 API call)
    await limits.sportsdata(async () => {
      const week = Math.min(Math.max(1, Math.floor((Date.now() - new Date(2024, 8, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))), 18);
      const { data } = await axios.get(
        `https://api.sportsdata.io/v3/nfl/json/PlayerGameProjectionStatsByWeek/2024/${week}?key=${process.env.SPORTSDATA_IO_KEY}`
      );
      
      if (data) {
        for (const projection of data.slice(0, 50)) { // Top 50 projections
          await supabase.from('player_projections').upsert({
            player_name: projection.Name,
            player_id: projection.PlayerID,
            team: projection.Team,
            position: projection.Position,
            week: week,
            projected_points: projection.FantasyPoints,
            projected_points_ppr: projection.FantasyPointsPPR,
            platform: 'sportsdata_io',
            external_id: `sportsdata_${projection.PlayerID}_week${week}`
          }, { onConflict: 'external_id' });
          
          stats.players++;
        }
      }
    });
  } catch (error) {
    stats.errors++;
    console.error(chalk.red('SportsData.io error:', error.message));
  }
}

// MONITORING
function showStats() {
  const runtime = Math.floor((Date.now() - stats.startTime) / 1000);
  const ratePerMin = Math.floor((stats.players + stats.teams + stats.games + stats.news) / (runtime / 60));
  
  console.clear();
  console.log(chalk.red.bold('\n🔥 MEGA DATA COLLECTOR STATS'));
  console.log(chalk.red('=============================\n'));
  
  console.log(chalk.green(`⏱️  Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`));
  console.log(chalk.green(`📈 Rate: ${ratePerMin} records/min\n`));
  
  console.log(chalk.cyan('📊 Data Collected:'));
  console.log(`  🏃 Players: ${stats.players.toLocaleString()}`);
  console.log(`  🏟️  Teams: ${stats.teams.toLocaleString()}`);
  console.log(`  🏈 Games: ${stats.games.toLocaleString()}`);
  console.log(`  📰 News: ${stats.news.toLocaleString()}`);
  console.log(`  💰 Odds: ${stats.odds.toLocaleString()}`);
  console.log(`  🌤️  Weather: ${stats.weather.toLocaleString()}`);
  console.log(`  💬 Sentiment: ${stats.sentiment.toLocaleString()}`);
  console.log(`  ❌ Errors: ${stats.errors}`);
  
  const total = stats.players + stats.teams + stats.games + stats.news + 
                stats.odds + stats.weather + stats.sentiment;
  
  console.log(chalk.green.bold(`\n📈 TOTAL RECORDS: ${total.toLocaleString()}`));
  
  if (total > 10000) {
    console.log(chalk.yellow('\n🎉 10K MILESTONE REACHED!'));
  }
  if (total > 100000) {
    console.log(chalk.yellow.bold('\n🚀 100K MILESTONE REACHED!'));
  }
  if (total > 1000000) {
    console.log(chalk.red.bold('\n🔥 1 MILLION RECORDS! BEAST MODE ACTIVATED!'));
  }
}

// MAIN EXECUTION
async function startMegaCollection() {
  // Test database connection
  const { error } = await supabase.from('teams').select('count').limit(1);
  if (error) {
    console.error(chalk.red('Database connection failed!'));
    return;
  }
  
  console.log(chalk.green('✅ Database connected!\n'));
  
  // Start all collectors
  console.log(chalk.blue('🚀 Starting all collectors...\n'));
  
  // Initial collection
  await Promise.all([
    collectESPN(),
    collectSleeper(),
    collectReddit(),
    collectWeather(),
    collectNBA(),
    collectOdds(),
    collectNFLOfficial(),
    collectESPNFantasy(),
    collectTwitter(),
    collectSportsDataIO(),
  ]);
  
  // Schedule recurring collections
  cron.schedule('*/30 * * * * *', () => collectESPN());        // Every 30 seconds
  cron.schedule('*/10 * * * * *', () => collectSleeper());     // Every 10 seconds
  cron.schedule('* * * * *', () => collectReddit());           // Every minute
  cron.schedule('0 * * * *', () => collectWeather());          // Every hour
  cron.schedule('*/2 * * * *', () => collectNBA());            // Every 2 minutes
  cron.schedule('*/5 * * * *', () => collectOdds());           // Every 5 minutes
  cron.schedule('*/2 * * * *', () => collectNFLOfficial());    // Every 2 minutes
  cron.schedule('*/5 * * * *', () => collectESPNFantasy());   // Every 5 minutes
  cron.schedule('*/10 * * * *', () => collectTwitter());      // Every 10 minutes (conservative)
  cron.schedule('0 */12 * * *', () => collectSportsDataIO());  // Twice daily (very conservative)
  
  // Show stats every 5 seconds
  setInterval(showStats, 5000);
  
  console.log(chalk.green.bold('\n✅ MEGA COLLECTION ACTIVE!'));
  console.log(chalk.yellow('\nPress Ctrl+C to stop\n'));
}

// Handle shutdown
process.on('SIGINT', () => {
  showStats();
  console.log(chalk.yellow('\n\n👋 Shutting down mega collector...'));
  process.exit(0);
});

// Start!
startMegaCollection().catch(console.error);