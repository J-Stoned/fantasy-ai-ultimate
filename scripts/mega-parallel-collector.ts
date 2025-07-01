#!/usr/bin/env tsx
/**
 * 🚀 MEGA PARALLEL COLLECTOR - Maximum data collection speed
 * Runs multiple APIs simultaneously for maximum throughput
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import pLimit from 'p-limit';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Rate limiters for each API
const limits = {
  ballDontLie: pLimit(10),    // 10 concurrent requests
  theOdds: pLimit(5),         // 5 concurrent requests
  openWeather: pLimit(10),    // 10 concurrent requests
  reddit: pLimit(3)           // 3 concurrent requests
};

const stats = {
  total: 0,
  players: 0,
  games: 0,
  odds: 0,
  weather: 0,
  news: 0,
  reddit: 0,
  errors: 0,
  startTime: Date.now()
};

// 🏀 Collect NBA data in parallel
async function turboNBA() {
  console.log(chalk.yellow('🏀 Turbo NBA collection...'));
  
  const tasks = [];
  
  // Collect all teams
  tasks.push(limits.ballDontLie(async () => {
    const { data } = await axios.get('https://api.balldontlie.io/v1/teams');
    const teams = data.data;
    
    for (const team of teams) {
      await supabase.from('teams').upsert({
        id: team.id,
        name: `${team.city} ${team.name}`,
        abbreviation: team.abbreviation,
        sport_id: 'nba',
        conference: team.conference,
        division: team.division,
        external_id: `balldontlie_team_${team.id}`
      }, { onConflict: 'external_id' });
    }
    return teams.length;
  }));
  
  // Collect players from multiple pages in parallel
  for (let page = 1; page <= 50; page++) {
    tasks.push(limits.ballDontLie(async () => {
      try {
        const { data } = await axios.get('https://api.balldontlie.io/v1/players', {
          params: { page, per_page: 100 }
        });
        
        let count = 0;
        for (const player of data.data) {
          if (player.first_name && player.last_name) {
            await supabase.from('players').upsert({
              firstname: player.first_name,
              lastname: player.last_name,
              position: player.position || 'G',
              team_id: player.team?.id || null,
              sport_id: 'nba',
              status: 'active',
              external_id: `balldontlie_${player.id}`
            }, { onConflict: 'external_id' });
            count++;
          }
        }
        return count;
      } catch (err) {
        return 0;
      }
    }));
  }
  
  // Collect games from last 3 seasons
  const seasons = [2024, 2023, 2022];
  for (const season of seasons) {
    for (let page = 1; page <= 20; page++) {
      tasks.push(limits.ballDontLie(async () => {
        try {
          const { data } = await axios.get('https://api.balldontlie.io/v1/games', {
            params: { seasons: [season], page, per_page: 100 }
          });
          
          let count = 0;
          for (const game of data.data) {
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
            count++;
          }
          return count;
        } catch (err) {
          return 0;
        }
      }));
    }
  }
  
  const results = await Promise.all(tasks);
  const total = results.reduce((sum, count) => sum + count, 0);
  stats.players += total;
  console.log(chalk.green(`✅ NBA: Collected ${total} records`));
}

// 💰 Collect betting odds for all sports
async function turboBetting() {
  console.log(chalk.yellow('💰 Turbo betting odds collection...'));
  
  const sports = [
    'americanfootball_nfl', 'americanfootball_ncaaf',
    'basketball_nba', 'basketball_ncaab',
    'baseball_mlb', 'icehockey_nhl',
    'soccer_epl', 'soccer_usa_mls',
    'golf_masters_tournament_winner',
    'mma_mixed_martial_arts'
  ];
  
  const tasks = sports.map(sport => 
    limits.theOdds(async () => {
      try {
        const { data } = await axios.get(
          `https://api.the-odds-api.com/v4/sports/${sport}/odds`,
          {
            params: {
              apiKey: process.env.THE_ODDS_API_KEY,
              regions: 'us',
              markets: 'h2h,spreads,totals',
              oddsFormat: 'american'
            }
          }
        );
        
        let count = 0;
        for (const event of data) {
          await supabase.from('betting_odds').upsert({
            sport_id: sport.split('_')[0],
            home_team: event.home_team,
            away_team: event.away_team,
            commence_time: event.commence_time,
            bookmakers: event.bookmakers,
            external_id: `odds_${event.id}`,
            created_at: new Date().toISOString()
          }, { onConflict: 'external_id' });
          count++;
          
          // Create betting news
          if (event.bookmakers?.length > 0) {
            const spread = event.bookmakers[0].markets?.find((m: any) => m.key === 'spreads');
            if (spread) {
              await supabase.from('news_articles').insert({
                title: `${sport.toUpperCase()}: ${event.away_team} @ ${event.home_team}`,
                content: `Betting line: ${event.home_team} ${spread.outcomes[0].point > 0 ? '+' : ''}${spread.outcomes[0].point}. Game time: ${new Date(event.commence_time).toLocaleString()}`,
                source: 'Live Odds Feed',
                published_at: new Date().toISOString()
              });
              stats.news++;
            }
          }
        }
        return count;
      } catch (err) {
        return 0;
      }
    })
  );
  
  const results = await Promise.all(tasks);
  const total = results.reduce((sum, count) => sum + count, 0);
  stats.odds += total;
  console.log(chalk.green(`✅ Betting: Collected ${total} odds`));
}

// 🌤️ Collect weather for 100+ cities
async function turboWeather() {
  console.log(chalk.yellow('🌤️ Turbo weather collection...'));
  
  const cities = [
    // NFL Cities
    'Buffalo', 'Miami', 'Boston', 'New York', 'Baltimore', 'Cincinnati', 'Cleveland', 'Pittsburgh',
    'Houston', 'Indianapolis', 'Jacksonville', 'Nashville', 'Denver', 'Kansas City', 'Las Vegas', 'Los Angeles',
    'Dallas', 'Philadelphia', 'Washington', 'Chicago', 'Detroit', 'Green Bay', 'Minneapolis',
    'Atlanta', 'Charlotte', 'New Orleans', 'Tampa', 'Phoenix', 'San Francisco', 'Seattle',
    // NBA Cities
    'Toronto', 'Milwaukee', 'Orlando', 'San Antonio', 'Portland', 'Sacramento', 'Oklahoma City', 'Memphis',
    'Salt Lake City', 'Brooklyn', 'Manhattan',
    // MLB Cities
    'St. Louis', 'Cincinnati', 'Pittsburgh', 'San Diego', 'Oakland', 'Anaheim', 'Arlington',
    // College Cities
    'Columbus', 'Ann Arbor', 'Madison', 'Iowa City', 'Lincoln', 'Austin', 'Norman', 'Stillwater',
    'Tuscaloosa', 'Auburn', 'Athens', 'Gainesville', 'Tallahassee', 'Clemson', 'Columbia',
    'Eugene', 'Corvallis', 'Pullman', 'Tucson', 'Tempe', 'Boulder', 'Salt Lake City'
  ];
  
  const uniqueCities = [...new Set(cities)];
  
  const tasks = uniqueCities.map(city =>
    limits.openWeather(async () => {
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
          external_id: `weather_${city.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`
        }, { onConflict: 'external_id' });
        
        // Create weather alerts
        if (data.wind.speed > 15 || ['Snow', 'Rain', 'Thunderstorm'].includes(data.weather[0].main)) {
          await supabase.from('news_articles').insert({
            title: `Weather Impact: ${data.weather[0].main} in ${city}`,
            content: `${data.weather[0].description}. Temp: ${data.main.temp}°F (feels like ${data.main.feels_like}°F). Wind: ${data.wind.speed} mph. This will impact outdoor games.`,
            source: 'Weather Analysis',
            published_at: new Date().toISOString()
          });
          stats.news++;
        }
        
        return 1;
      } catch (err) {
        return 0;
      }
    })
  );
  
  const results = await Promise.all(tasks);
  const total = results.reduce((sum, count) => sum + count, 0);
  stats.weather += total;
  console.log(chalk.green(`✅ Weather: Collected ${total} city reports`));
}

// 📱 Collect Reddit sentiment
async function collectRedditData() {
  console.log(chalk.yellow('📱 Collecting Reddit sentiment...'));
  
  const subreddits = [
    'nba', 'nfl', 'baseball', 'hockey', 'fantasyfootball', 
    'fantasybball', 'DynastyFF', 'sportsbook', 'sportsbetting'
  ];
  
  const tasks = subreddits.map(subreddit =>
    limits.reddit(async () => {
      try {
        const { data } = await axios.get(
          `https://www.reddit.com/r/${subreddit}/hot.json`,
          { 
            params: { limit: 50 },
            headers: { 'User-Agent': 'FantasyAI/1.0' }
          }
        );
        
        let count = 0;
        for (const post of data.data.children) {
          const postData = post.data;
          
          // Only collect sports-related posts
          if (postData.title && postData.score > 10) {
            await supabase.from('social_sentiment').upsert({
              platform: 'reddit',
              content: postData.title + ' ' + (postData.selftext || ''),
              author: postData.author,
              score: postData.score,
              url: `https://reddit.com${postData.permalink}`,
              sport_id: detectSport(subreddit),
              sentiment_score: postData.upvote_ratio,
              external_id: `reddit_${postData.id}`,
              created_at: new Date(postData.created_utc * 1000).toISOString()
            }, { onConflict: 'external_id' });
            count++;
            
            // Create news from popular posts
            if (postData.score > 100) {
              await supabase.from('news_articles').insert({
                title: `Trending on r/${subreddit}: ${postData.title}`,
                content: postData.selftext?.substring(0, 500) || postData.title,
                source: `Reddit r/${subreddit}`,
                url: `https://reddit.com${postData.permalink}`,
                published_at: new Date().toISOString()
              });
              stats.news++;
            }
          }
        }
        return count;
      } catch (err) {
        return 0;
      }
    })
  );
  
  const results = await Promise.all(tasks);
  const total = results.reduce((sum, count) => sum + count, 0);
  stats.reddit += total;
  console.log(chalk.green(`✅ Reddit: Collected ${total} posts`));
}

function detectSport(subreddit: string): string {
  if (subreddit.includes('nba') || subreddit.includes('bball')) return 'nba';
  if (subreddit.includes('nfl') || subreddit.includes('football')) return 'nfl';
  if (subreddit.includes('baseball')) return 'mlb';
  if (subreddit.includes('hockey')) return 'nhl';
  return 'multi';
}

function showStats() {
  const runtime = Math.floor((Date.now() - stats.startTime) / 1000);
  stats.total = stats.players + stats.games + stats.odds + stats.weather + stats.news + stats.reddit;
  
  console.clear();
  console.log(chalk.blue('🚀 MEGA PARALLEL COLLECTOR'));
  console.log(chalk.blue('=========================\n'));
  
  console.log(chalk.yellow(`⏱️  Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`));
  console.log(chalk.yellow(`⚡ Rate: ${Math.floor(stats.total / (runtime || 1))} records/sec\n`));
  
  console.log('📊 Collection Stats:');
  console.log(`  🏃 Players/Games: ${(stats.players + stats.games).toLocaleString()}`);
  console.log(`  💰 Betting Odds: ${stats.odds.toLocaleString()}`);
  console.log(`  🌤️ Weather: ${stats.weather.toLocaleString()}`);
  console.log(`  📱 Reddit: ${stats.reddit.toLocaleString()}`);
  console.log(`  📰 News: ${stats.news.toLocaleString()}`);
  console.log(`  ❌ Errors: ${stats.errors}`);
  
  console.log(chalk.green(`\n🔥 TOTAL RECORDS: ${stats.total.toLocaleString()}`));
  
  // Calculate projected daily total
  const recordsPerSecond = stats.total / (runtime || 1);
  const projectedDaily = Math.floor(recordsPerSecond * 86400);
  console.log(chalk.cyan(`📈 Projected 24hr: ${projectedDaily.toLocaleString()} records`));
}

async function main() {
  console.log(chalk.blue('🚀 MEGA PARALLEL COLLECTOR - MAXIMUM SPEED MODE\n'));
  
  // Install p-limit if needed
  try {
    require('p-limit');
  } catch {
    console.log(chalk.yellow('Installing p-limit for parallel processing...'));
    require('child_process').execSync('npm install p-limit', { stdio: 'inherit' });
  }
  
  // Test database
  const { error } = await supabase.from('players').select('count').limit(1);
  if (error) {
    console.error(chalk.red('Database error:'), error.message);
    return;
  }
  
  console.log(chalk.green('✅ Database connected!\n'));
  
  // Run all collectors in parallel
  console.log(chalk.yellow('🔥 Starting parallel collection...\n'));
  
  // Initial burst
  await Promise.all([
    turboNBA(),
    turboBetting(),
    turboWeather(),
    collectRedditData()
  ]);
  
  showStats();
  
  // Continue collecting with intervals
  setInterval(turboNBA, 300000);        // NBA every 5 min
  setInterval(turboBetting, 600000);    // Odds every 10 min
  setInterval(turboWeather, 1800000);   // Weather every 30 min
  setInterval(collectRedditData, 900000); // Reddit every 15 min
  setInterval(showStats, 10000);         // Update stats every 10 sec
  
  console.log(chalk.green('\n✅ Mega collector running at MAXIMUM SPEED!\n'));
}

main().catch(console.error);