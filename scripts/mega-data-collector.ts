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
  
  try {
    // Get all NBA players
    await limits.nba(async () => {
      const { data } = await axios.get('https://www.balldontlie.io/api/v1/players?per_page=100');
      
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
          const { data } = await axios.get(`https://www.balldontlie.io/api/v1/players?per_page=100&page=${page}`);
          
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
  ]);
  
  // Schedule recurring collections
  cron.schedule('*/30 * * * * *', () => collectESPN());        // Every 30 seconds
  cron.schedule('*/10 * * * * *', () => collectSleeper());     // Every 10 seconds
  cron.schedule('* * * * *', () => collectReddit());           // Every minute
  cron.schedule('0 * * * *', () => collectWeather());          // Every hour
  cron.schedule('*/2 * * * *', () => collectNBA());            // Every 2 minutes
  cron.schedule('*/5 * * * *', () => collectOdds());           // Every 5 minutes
  
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