#!/usr/bin/env tsx
/**
 * 🔥 MEGA DATA COLLECTOR V2 - SMART EDITION
 * No more duplicates! Only fresh, new data!
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

// Rate limiters for each API
const limits = {
  espn: pLimit(5),      // 5 concurrent ESPN requests
  sleeper: pLimit(10),  // Sleeper is generous
  reddit: pLimit(3),    // Reddit is strict
  weather: pLimit(2),   // Weather API is limited
  nba: pLimit(3),
  odds: pLimit(1),      // Very limited!
  nfl: pLimit(3),
  twitter: pLimit(2),
  sportsdata: pLimit(1) // VERY limited (1000/month)
};

// Collection state management
interface CollectionState {
  collector_name: string;
  last_run?: string;
  last_id?: string;
  last_timestamp?: string;
  items_collected: number;
  total_items_collected: number;
  metadata: any;
}

// Stats for monitoring
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
  newRecords: 0,
  duplicates: 0
};

/**
 * Get or create collection state
 */
async function getCollectionState(collectorName: string): Promise<CollectionState> {
  const { data } = await supabase
    .from('collection_state')
    .select('*')
    .eq('collector_name', collectorName)
    .single();
    
  if (data) {
    return data;
  }
  
  // Create new state
  const newState = {
    collector_name: collectorName,
    items_collected: 0,
    total_items_collected: 0,
    metadata: {}
  };
  
  await supabase.from('collection_state').insert(newState);
  return newState;
}

/**
 * Update collection state
 */
async function updateCollectionState(
  collectorName: string, 
  updates: Partial<CollectionState>
) {
  await supabase
    .from('collection_state')
    .update({
      ...updates,
      last_run: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('collector_name', collectorName);
}

// ESPN COLLECTOR - WITH DATE FILTERING
async function collectESPN() {
  console.log(chalk.yellow('📡 ESPN Collector starting...'));
  const state = await getCollectionState('espn_collector');
  
  // Only get games from last 24 hours and upcoming
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const sports = [
    { id: 'football', league: 'nfl', name: 'NFL' },
    { id: 'basketball', league: 'nba', name: 'NBA' },
    { id: 'baseball', league: 'mlb', name: 'MLB' },
    { id: 'hockey', league: 'nhl', name: 'NHL' }
  ];
  
  let newItems = 0;
  
  for (const sport of sports) {
    try {
      // Get recent games
      await limits.espn(async () => {
        const dates = `${yesterday.replace(/-/g, '')}-${tomorrow.replace(/-/g, '')}`;
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.id}/${sport.league}/scoreboard?dates=${dates}`;
        const { data } = await axios.get(url);
        
        if (data.events) {
          for (const event of data.events) {
            const competition = event.competitions[0];
            const home = competition.competitors.find(t => t.homeAway === 'home');
            const away = competition.competitors.find(t => t.homeAway === 'away');
            
            if (home && away) {
              const gameId = `${sport.league}_${event.id}`;
              
              // Check if we already have this game
              const { data: existing } = await supabase
                .from('games')
                .select('external_id')
                .eq('external_id', gameId)
                .single();
                
              if (!existing) {
                await supabase.from('games').insert({
                  home_team_id: home.id,
                  away_team_id: away.id,
                  sport_id: sport.league,
                  start_time: event.date,
                  venue: competition.venue?.fullName,
                  status: competition.status.type.name,
                  home_score: parseInt(home.score) || null,
                  away_score: parseInt(away.score) || null,
                  external_id: gameId
                });
                
                stats.games++;
                newItems++;
                stats.newRecords++;
              } else {
                stats.duplicates++;
              }
            }
          }
        }
      });
      
      // Get recent news (last 24 hours only)
      await limits.espn(async () => {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${sport.id}/${sport.league}/news?limit=20`;
        const { data } = await axios.get(url);
        
        if (data.articles) {
          for (const article of data.articles) {
            const publishedDate = new Date(article.published);
            const hoursSincePublished = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60);
            
            // Only collect news from last 24 hours
            if (hoursSincePublished <= 24) {
              const { data: existing } = await supabase
                .from('news_articles')
                .select('url')
                .eq('url', article.links?.web?.href || '')
                .single();
                
              if (!existing) {
                await supabase.from('news_articles').insert({
                  title: article.headline,
                  url: article.links?.web?.href || '',
                  source: 'ESPN',
                  sport_id: sport.league,
                  summary: article.description,
                  published_at: article.published,
                  external_id: `espn_${article.id}`
                });
                
                stats.news++;
                newItems++;
                stats.newRecords++;
              } else {
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
  
  await updateCollectionState('espn_collector', {
    items_collected: newItems,
    total_items_collected: (state.total_items_collected || 0) + newItems
  });
}

// SLEEPER COLLECTOR - SMART SYNC
async function collectSleeper() {
  console.log(chalk.yellow('😴 Sleeper Collector starting...'));
  
  // Check if we need full player sync
  const playerState = await getCollectionState('sleeper_players');
  const lastFullSync = playerState.metadata?.last_full_sync;
  const hoursSinceSync = lastFullSync ? 
    (Date.now() - new Date(lastFullSync).getTime()) / (1000 * 60 * 60) : 999;
  
  let newItems = 0;
  
  // Full player sync only once per day
  if (hoursSinceSync > 24) {
    console.log(chalk.blue('Running full player sync...'));
    
    await limits.sleeper(async () => {
      const { data: players } = await axios.get('https://api.sleeper.app/v1/players/nfl');
      
      const playerArray = Object.values(players);
      console.log(chalk.green(`Found ${playerArray.length} NFL players from Sleeper!`));
      
      // Get existing player IDs
      const { data: existingPlayers } = await supabase
        .from('players')
        .select('external_id')
        .like('external_id', 'sleeper_%');
        
      const existingIds = new Set(existingPlayers?.map(p => p.external_id) || []);
      
      // Process in batches, only new players
      const batchSize = 100;
      for (let i = 0; i < playerArray.length; i += batchSize) {
        const batch = playerArray.slice(i, i + batchSize);
        
        const newPlayers = batch.filter((player: any) => 
          !existingIds.has(`sleeper_${player.player_id}`)
        );
        
        if (newPlayers.length > 0) {
          const playerInserts = newPlayers.map((player: any) => ({
            firstname: player.first_name,
            lastname: player.last_name,
            position: [player.position],
            sport_id: 'nfl',
            status: player.injury_status || 'active',
            external_id: `sleeper_${player.player_id}`,
            jersey_number: player.number || null,
            heightinches: player.height ? parseInt(player.height) : null,
            weightlbs: player.weight ? parseInt(player.weight) : null,
            created_at: new Date().toISOString()
          }));
          
          const { error } = await supabase.from('players').insert(playerInserts);
          
          if (!error) {
            stats.players += newPlayers.length;
            newItems += newPlayers.length;
            stats.newRecords += newPlayers.length;
          }
        }
      }
    });
    
    await updateCollectionState('sleeper_players', {
      items_collected: newItems,
      total_items_collected: (playerState.total_items_collected || 0) + newItems,
      metadata: { ...playerState.metadata, last_full_sync: new Date().toISOString() }
    });
  }
  
  // Always check trending players
  const trendingState = await getCollectionState('sleeper_trending');
  let trendingItems = 0;
  
  await limits.sleeper(async () => {
    const { data: trending } = await axios.get('https://api.sleeper.app/v1/players/nfl/trending/add?limit=50');
    console.log(chalk.green(`${trending.length} trending players on Sleeper`));
    
    for (const trend of trending) {
      const trendId = `sleeper_trend_${trend.player_id}_${new Date().toISOString().split('T')[0]}`;
      
      const { data: existing } = await supabase
        .from('trending_players')
        .select('external_id')
        .eq('external_id', trendId)
        .single();
        
      if (!existing && trend.player_id) {
        // Get player details
        const { data: player } = await supabase
          .from('players')
          .select('id, name')
          .eq('external_id', `sleeper_${trend.player_id}`)
          .single();
          
        if (player) {
          await supabase.from('trending_players').insert({
            player_name: player.name,
            player_id: player.id,
            trend_type: 'most_added',
            platform: 'sleeper',
            ownership_change: trend.count || 0,
            created_at: new Date().toISOString(),
            external_id: trendId
          });
          
          trendingItems++;
          stats.newRecords++;
        }
      }
    }
  });
  
  await updateCollectionState('sleeper_trending', {
    items_collected: trendingItems,
    total_items_collected: (trendingState.total_items_collected || 0) + trendingItems
  });
}

// REDDIT COLLECTOR - TRACK LAST POST
async function collectReddit() {
  console.log(chalk.yellow('🔥 Reddit Collector starting...'));
  const state = await getCollectionState('reddit_collector');
  
  const subreddits = [
    'fantasyfootball',
    'nfl', 
    'nba',
    'fantasy_football',
    'DynastyFF'
  ];
  
  let newItems = 0;
  
  for (const sub of subreddits) {
    try {
      await limits.reddit(async () => {
        // Get NEW posts instead of HOT
        const { data } = await axios.get(`https://www.reddit.com/r/${sub}/new.json?limit=25`, {
          headers: { 'User-Agent': 'FantasyAI/1.0' }
        });
        
        if (data.data?.children) {
          // Get last processed post ID for this subreddit
          const lastId = state.metadata?.[`last_${sub}_id`];
          let newestId = null;
          
          for (const post of data.data.children) {
            const postData = post.data;
            
            // Stop if we've seen this post before
            if (lastId && postData.id === lastId) break;
            
            // Track newest post
            if (!newestId) newestId = postData.id;
            
            // Check if we already have this post
            const { data: existing } = await supabase
              .from('social_sentiment')
              .select('external_id')
              .eq('external_id', `reddit_${postData.id}`)
              .single();
              
            if (!existing) {
              // Extract player names mentioned
              const playerPattern = /([A-Z][a-z]+ [A-Z][a-z]+)/g;
              const mentions = postData.title.match(playerPattern) || [];
              
              await supabase.from('social_sentiment').insert({
                platform: 'reddit',
                content: postData.title,
                author: postData.author,
                score: postData.score,
                url: `https://reddit.com${postData.permalink}`,
                sport_id: sub.includes('football') ? 'nfl' : 
                         sub.includes('bball') ? 'nba' : 'general',
                mentions: mentions,
                created_at: new Date(postData.created_utc * 1000).toISOString(),
                external_id: `reddit_${postData.id}`
              });
              
              stats.sentiment++;
              newItems++;
              stats.newRecords++;
            } else {
              stats.duplicates++;
            }
          }
          
          // Update last seen ID
          if (newestId) {
            state.metadata[`last_${sub}_id`] = newestId;
          }
        }
      });
    } catch (error) {
      stats.errors++;
      console.error(chalk.red(`Reddit ${sub} error:`, error.message));
    }
  }
  
  await updateCollectionState('reddit_collector', {
    items_collected: newItems,
    total_items_collected: (state.total_items_collected || 0) + newItems,
    metadata: state.metadata
  });
}

// WEATHER COLLECTOR - FIXED SCHEMA
async function collectWeather() {
  console.log(chalk.yellow('🌤️ Weather Collector starting...'));
  
  if (!process.env.OPENWEATHER_API_KEY) {
    console.log(chalk.gray('No weather API key, skipping...'));
    return;
  }
  
  const state = await getCollectionState('weather_collector');
  let newItems = 0;
  
  try {
    // Get all teams with venues
    const { data: teams } = await supabase
      .from('teams')
      .select('id, city, sport_id')
      .not('city', 'is', null)
      .limit(10); // Limit to avoid too many API calls
    
    if (teams) {
      for (const team of teams) {
        await limits.weather(async () => {
          const { data } = await axios.get(
            `https://api.openweathermap.org/data/2.5/weather?q=${team.city}&appid=${process.env.OPENWEATHER_API_KEY}`
          );
          
          // Insert with proper schema including created_at
          await supabase.from('weather_data').insert({
            location: team.city,
            temperature: Math.round((data.main.temp - 273.15) * 9/5 + 32), // K to F
            conditions: data.weather[0].main,
            wind_speed: Math.round(data.wind.speed * 2.237), // m/s to mph
            humidity: data.main.humidity,
            team_id: team.id,
            created_at: new Date().toISOString() // Add this field!
          });
          
          stats.weather++;
          newItems++;
          stats.newRecords++;
        });
      }
    }
  } catch (error) {
    stats.errors++;
    console.error(chalk.red('Weather error:', error.message));
  }
  
  await updateCollectionState('weather_collector', {
    items_collected: newItems,
    total_items_collected: (state.total_items_collected || 0) + newItems
  });
}

// MONITORING - ENHANCED
function showStats() {
  const runtime = Math.floor((Date.now() - stats.startTime) / 1000);
  const ratePerMin = Math.floor(stats.newRecords / (runtime / 60));
  
  console.clear();
  console.log(chalk.red.bold('\n🔥 MEGA DATA COLLECTOR V2 - SMART EDITION'));
  console.log(chalk.red('==========================================\n'));
  
  console.log(chalk.green(`⏱️  Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`));
  console.log(chalk.green(`📈 Rate: ${ratePerMin} NEW records/min\n`));
  
  console.log(chalk.cyan('📊 Data Collected:'));
  console.log(`  🏃 Players: ${stats.players.toLocaleString()}`);
  console.log(`  🏟️  Teams: ${stats.teams.toLocaleString()}`);
  console.log(`  🏈 Games: ${stats.games.toLocaleString()}`);
  console.log(`  📰 News: ${stats.news.toLocaleString()}`);
  console.log(`  💰 Odds: ${stats.odds.toLocaleString()}`);
  console.log(`  🌤️  Weather: ${stats.weather.toLocaleString()}`);
  console.log(`  💬 Sentiment: ${stats.sentiment.toLocaleString()}`);
  console.log(`  ❌ Errors: ${stats.errors}`);
  
  console.log(chalk.green.bold(`\n✨ NEW RECORDS: ${stats.newRecords.toLocaleString()}`));
  console.log(chalk.gray(`🔄 Duplicates avoided: ${stats.duplicates.toLocaleString()}`));
  
  const efficiency = stats.newRecords / (stats.newRecords + stats.duplicates) * 100;
  console.log(chalk.yellow(`\n📊 Efficiency: ${efficiency.toFixed(1)}% new data`));
  
  if (stats.newRecords > 10000) {
    console.log(chalk.yellow('\n🎉 10K NEW RECORDS!'));
  }
  if (stats.newRecords > 100000) {
    console.log(chalk.yellow.bold('\n🚀 100K NEW RECORDS!'));
  }
}

// Create collection_state table if it doesn't exist
async function ensureCollectionStateTable() {
  // Try to select from the table
  const { error } = await supabase.from('collection_state').select('*').limit(1);
  
  if (error && error.message.includes('relation') && error.message.includes('does not exist')) {
    console.log(chalk.yellow('Creating collection_state table...'));
    console.log(chalk.red('\n⚠️  Please run the SQL in supabase/migrations/20250107_collection_state.sql'));
    console.log(chalk.red('   in your Supabase dashboard to create the tracking table.\n'));
    process.exit(1);
  }
}

// MAIN EXECUTION
async function startMegaCollection() {
  // Ensure collection_state table exists
  await ensureCollectionStateTable();
  
  // Test database connection
  const { error } = await supabase.from('teams').select('count').limit(1);
  if (error) {
    console.error(chalk.red('Database connection failed!'));
    return;
  }
  
  console.log(chalk.green('✅ Database connected!\n'));
  
  // Start all collectors
  console.log(chalk.blue('🚀 Starting SMART collectors...\n'));
  
  // Initial collection
  await Promise.all([
    collectESPN(),
    collectSleeper(),
    collectReddit(),
    collectWeather()
  ]);
  
  // Schedule recurring collections with SMART intervals
  cron.schedule('*/5 * * * *', () => collectESPN());        // Every 5 minutes (only new games/news)
  cron.schedule('0 */6 * * *', () => collectSleeper());     // Every 6 hours (trending more often)
  cron.schedule('*/2 * * * *', () => collectReddit());      // Every 2 minutes (new posts)
  cron.schedule('0 * * * *', () => collectWeather());       // Every hour
  
  // Show stats every 5 seconds
  setInterval(showStats, 5000);
  
  console.log(chalk.green('\n✅ Smart collection started!'));
  console.log(chalk.yellow('📊 Only collecting NEW data, no more duplicates!\n'));
}

// Start the collection
startMegaCollection().catch(console.error);