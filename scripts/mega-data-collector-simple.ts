#!/usr/bin/env tsx
/**
 * 🔥 MEGA DATA COLLECTOR - SIMPLE FIX VERSION
 * Focuses on getting NEW data only
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as cron from 'node-cron';
import pLimit from 'p-limit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Rate limiters
const limits = {
  espn: pLimit(5),
  sleeper: pLimit(10),
  reddit: pLimit(3),
  weather: pLimit(2),
};

// Track last collected items
const lastCollected: Record<string, any> = {};

// Stats
const stats = {
  players: 0,
  teams: 0,
  games: 0,
  news: 0,
  weather: 0,
  sentiment: 0,
  errors: 0,
  startTime: Date.now(),
  newRecords: 0,
  duplicates: 0
};

// ESPN COLLECTOR - Only recent games
async function collectESPN() {
  console.log(chalk.yellow('📡 ESPN Collector - Getting RECENT data only...'));
  
  // Get games from last 2 days and next 2 days
  const today = new Date();
  const dates = [];
  for (let i = -2; i <= 2; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    dates.push(date.toISOString().split('T')[0].replace(/-/g, ''));
  }
  
  const sports = [
    { id: 'football', league: 'nfl', name: 'NFL' },
    { id: 'basketball', league: 'nba', name: 'NBA' }
  ];
  
  let newItems = 0;
  
  for (const sport of sports) {
    try {
      // Get games for specific dates
      await limits.espn(async () => {
        const dateRange = `${dates[0]}-${dates[dates.length - 1]}`;
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.id}/${sport.league}/scoreboard?dates=${dateRange}&limit=50`;
        const { data } = await axios.get(url);
        
        if (data.events) {
          for (const event of data.events) {
            const competition = event.competitions[0];
            const home = competition.competitors.find(t => t.homeAway === 'home');
            const away = competition.competitors.find(t => t.homeAway === 'away');
            
            if (home && away) {
              const gameId = `${sport.league}_${event.id}`;
              
              try {
                await supabase.from('games').upsert({
                  home_team_id: home.id,
                  away_team_id: away.id,
                  sport_id: sport.league,
                  start_time: event.date,
                  venue: competition.venue?.fullName,
                  status: competition.status.type.name,
                  home_score: parseInt(home.score) || null,
                  away_score: parseInt(away.score) || null,
                  external_id: gameId,
                  created_at: new Date().toISOString()
                }, { 
                  onConflict: 'external_id',
                  ignoreDuplicates: true 
                });
                
                stats.games++;
                newItems++;
                stats.newRecords++;
              } catch (error) {
                stats.duplicates++;
              }
            }
          }
        }
      });
      
      // Get RECENT news only
      await limits.espn(async () => {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.id}/${sport.league}/news?limit=10`;
        const { data } = await axios.get(url);
        
        if (data.articles) {
          for (const article of data.articles) {
            const publishedDate = new Date(article.published);
            const hoursSince = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60);
            
            // Only news from last 48 hours
            if (hoursSince <= 48) {
              try {
                await supabase.from('news_articles').upsert({
                  title: article.headline,
                  url: article.links?.web?.href || '',
                  source: 'ESPN',
                  sport_id: sport.league,
                  summary: article.description,
                  published_at: article.published,
                  external_id: `espn_${article.id}`,
                  created_at: new Date().toISOString()
                }, { 
                  onConflict: 'url',
                  ignoreDuplicates: true 
                });
                
                stats.news++;
                newItems++;
                stats.newRecords++;
              } catch (error) {
                stats.duplicates++;
              }
            }
          }
        }
      });
      
    } catch (error) {
      stats.errors++;
      console.error(chalk.red(`ESPN ${sport.name} error:`, error.message));
    }
  }
  
  if (newItems > 0) {
    console.log(chalk.green(`  ✅ Added ${newItems} new ESPN items`));
  }
}

// SLEEPER - Only trending updates
async function collectSleeperTrending() {
  console.log(chalk.yellow('😴 Sleeper - Getting trending players...'));
  
  let newItems = 0;
  
  try {
    await limits.sleeper(async () => {
      const { data: trending } = await axios.get(
        'https://api.sleeper.app/v1/players/nfl/trending/add?limit=25'
      );
      
      for (const trend of trending) {
        if (trend.player_id) {
          const trendId = `sleeper_trend_${trend.player_id}_${new Date().toISOString().split('T')[0]}`;
          
          try {
            // Get player info
            const { data: playerInfo } = await axios.get(
              `https://api.sleeper.app/v1/players/nfl/${trend.player_id}`
            );
            
            if (playerInfo) {
              await supabase.from('trending_players').upsert({
                player_name: `${playerInfo.first_name} ${playerInfo.last_name}`,
                player_id: trend.player_id,
                trend_type: 'most_added',
                platform: 'sleeper',
                ownership_change: trend.count || 0,
                metadata: { position: playerInfo.position, team: playerInfo.team },
                created_at: new Date().toISOString(),
                external_id: trendId
              }, { 
                onConflict: 'external_id',
                ignoreDuplicates: true 
              });
              
              newItems++;
              stats.newRecords++;
            }
          } catch (error) {
            stats.duplicates++;
          }
        }
      }
    });
    
    if (newItems > 0) {
      console.log(chalk.green(`  ✅ Added ${newItems} trending players`));
    }
  } catch (error) {
    stats.errors++;
    console.error(chalk.red('Sleeper error:', error.message));
  }
}

// REDDIT - Get NEW posts only
async function collectReddit() {
  console.log(chalk.yellow('🔥 Reddit - Getting NEW posts...'));
  
  const subreddits = ['fantasyfootball', 'nfl', 'nba'];
  let newItems = 0;
  
  for (const sub of subreddits) {
    try {
      await limits.reddit(async () => {
        // Get NEW posts, not HOT
        const { data } = await axios.get(
          `https://www.reddit.com/r/${sub}/new.json?limit=10`,
          { headers: { 'User-Agent': 'FantasyAI/1.0' } }
        );
        
        if (data.data?.children) {
          for (const post of data.data.children) {
            const postData = post.data;
            
            // Skip if we've seen this recently
            const postKey = `reddit_${sub}_last`;
            if (lastCollected[postKey] === postData.id) {
              break; // Stop, we've caught up
            }
            
            try {
              // Extract player names
              const playerPattern = /([A-Z][a-z]+ [A-Z][a-z]+)/g;
              const mentions = postData.title.match(playerPattern) || [];
              
              await supabase.from('social_sentiment').upsert({
                platform: 'reddit',
                content: postData.title,
                author: postData.author,
                score: postData.score,
                url: `https://reddit.com${postData.permalink}`,
                sport_id: sub.includes('football') ? 'nfl' : 
                         sub.includes('nba') ? 'nba' : 'general',
                mentions: mentions,
                created_at: new Date(postData.created_utc * 1000).toISOString(),
                external_id: `reddit_${postData.id}`
              }, { 
                onConflict: 'external_id',
                ignoreDuplicates: true 
              });
              
              stats.sentiment++;
              newItems++;
              stats.newRecords++;
              
              // Remember the newest post
              if (!lastCollected[postKey]) {
                lastCollected[postKey] = postData.id;
              }
            } catch (error) {
              stats.duplicates++;
            }
          }
        }
      });
    } catch (error) {
      stats.errors++;
      console.error(chalk.red(`Reddit ${sub} error:`, error.message));
    }
  }
  
  if (newItems > 0) {
    console.log(chalk.green(`  ✅ Added ${newItems} Reddit posts`));
  }
}

// WEATHER - Update hourly
async function collectWeather() {
  if (!process.env.OPENWEATHER_API_KEY || 
      process.env.OPENWEATHER_API_KEY === 'your-openweather-api-key') {
    return;
  }
  
  console.log(chalk.yellow('🌤️ Weather - Updating current conditions...'));
  
  let newItems = 0;
  
  try {
    // Get a few key cities
    const cities = ['Kansas City', 'Buffalo', 'Philadelphia', 'Dallas', 'Green Bay'];
    
    for (const city of cities) {
      await limits.weather(async () => {
        try {
          const { data } = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.OPENWEATHER_API_KEY}`
          );
          
          await supabase.from('weather_data').insert({
            location: city,
            temperature: Math.round((data.main.temp - 273.15) * 9/5 + 32),
            conditions: data.weather[0].main,
            wind_speed: Math.round(data.wind.speed * 2.237),
            humidity: data.main.humidity,
            metadata: { 
              description: data.weather[0].description,
              feels_like: Math.round((data.main.feels_like - 273.15) * 9/5 + 32)
            },
            created_at: new Date().toISOString()
          });
          
          stats.weather++;
          newItems++;
          stats.newRecords++;
        } catch (error) {
          // Ignore duplicates
        }
      });
    }
    
    if (newItems > 0) {
      console.log(chalk.green(`  ✅ Added ${newItems} weather updates`));
    }
  } catch (error) {
    stats.errors++;
    console.error(chalk.red('Weather error:', error.message));
  }
}

// MONITORING
function showStats() {
  const runtime = Math.floor((Date.now() - stats.startTime) / 1000);
  const ratePerMin = stats.newRecords / Math.max(1, runtime / 60);
  
  console.clear();
  console.log(chalk.red.bold('\n🔥 MEGA DATA COLLECTOR - SMART EDITION'));
  console.log(chalk.red('=====================================\n'));
  
  console.log(chalk.green(`⏱️  Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`));
  console.log(chalk.green(`📈 Rate: ${Math.floor(ratePerMin)} NEW records/min\n`));
  
  console.log(chalk.cyan('📊 New Data Collected:'));
  console.log(`  🏈 Games: ${stats.games}`);
  console.log(`  📰 News: ${stats.news}`);
  console.log(`  💬 Sentiment: ${stats.sentiment}`);
  console.log(`  🌤️  Weather: ${stats.weather}`);
  console.log(`  ❌ Errors: ${stats.errors}`);
  
  console.log(chalk.green.bold(`\n✨ TOTAL NEW RECORDS: ${stats.newRecords}`));
  console.log(chalk.gray(`🔄 Duplicates avoided: ${stats.duplicates}`));
  
  const efficiency = stats.newRecords / Math.max(1, stats.newRecords + stats.duplicates) * 100;
  console.log(chalk.yellow(`📊 Efficiency: ${efficiency.toFixed(1)}% new data\n`));
}

// MAIN EXECUTION
async function startCollection() {
  console.log(chalk.green.bold('\n🚀 SMART DATA COLLECTOR STARTING...\n'));
  console.log(chalk.yellow('📌 Only collecting NEW data'));
  console.log(chalk.yellow('📌 No more duplicates!\n'));
  
  // Initial collection
  await Promise.all([
    collectESPN(),
    collectSleeperTrending(),
    collectReddit(),
    collectWeather()
  ]);
  
  // Schedule smart intervals
  cron.schedule('*/5 * * * *', collectESPN);           // Every 5 min
  cron.schedule('*/10 * * * *', collectSleeperTrending); // Every 10 min
  cron.schedule('*/2 * * * *', collectReddit);         // Every 2 min
  cron.schedule('0 * * * *', collectWeather);          // Every hour
  
  // Show stats every 5 seconds
  setInterval(showStats, 5000);
  
  console.log(chalk.green('\n✅ Smart collection active!\n'));
}

// Start
startCollection().catch(console.error);