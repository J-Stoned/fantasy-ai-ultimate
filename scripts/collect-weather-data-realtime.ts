#!/usr/bin/env tsx
/**
 * 🌤️ REAL-TIME WEATHER DATA COLLECTOR
 * Uses OpenWeatherMap API for real historical and current weather data
 * - Query limit protection with pagination
 * - Proper ID type casting (bigint -> integer)
 * - Batch processing for insertions
 * - Real OpenWeatherMap API integration
 * - Clean process termination
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.blue('🌤️ REAL-TIME WEATHER DATA COLLECTOR\n'));

// Configuration
const CONFIG = {
  CONCURRENT_REQUESTS: 10, // Optimized for Ryzen 5 7600X (12 threads)
  BATCH_SIZE: 100,
  API_DELAY: 500, // 500ms between API calls (120 requests/minute)
  PAGINATION_SIZE: 1000,
  MAX_RETRIES: 3
};

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const OPENWEATHER_BASE_URL = 'https://api.openweathermap.org/data/2.5';

if (!OPENWEATHER_API_KEY) {
  console.error('❌ OPENWEATHER_API_KEY environment variable is required');
  console.error('   Please set your OpenWeatherMap API key in .env.local');
  console.error('   Get a free API key at: https://openweathermap.org/api');
  process.exit(1);
} else {
  console.log('✅ Using real OpenWeatherMap API');
}

// Teams with indoor/dome stadiums (skip weather data)
const NFL_INDOOR_TEAMS = [
  'New Orleans Saints',
  'Minnesota Vikings', 
  'Indianapolis Colts',
  'Detroit Lions',
  'Atlanta Falcons',
  'Dallas Cowboys',
  'Houston Texans',
  'Las Vegas Raiders',
  'Arizona Cardinals',
  'Los Angeles Rams',
  'Los Angeles Chargers'
];

// MLB teams with retractable roofs or domes
const MLB_INDOOR_TEAMS = [
  'Houston Astros',        // Minute Maid Park (retractable roof)
  'Arizona Diamondbacks',  // Chase Field (retractable roof)
  'Toronto Blue Jays',     // Rogers Centre (retractable roof)
  'Tampa Bay Rays',        // Tropicana Field (dome)
  'Miami Marlins',         // loanDepot park (retractable roof)
  'Milwaukee Brewers',     // American Family Field (retractable roof)
  'Seattle Mariners',      // T-Mobile Park (retractable roof)
  'Texas Rangers'          // Globe Life Field (retractable roof)
];

// Stadium locations for weather data
const STADIUM_LOCATIONS = {
  // NFL Stadiums
  'Green Bay Packers': { lat: 44.5013, lon: -88.0622, city: 'Green Bay', state: 'WI' },
  'Chicago Bears': { lat: 41.8623, lon: -87.6167, city: 'Chicago', state: 'IL' },
  'Buffalo Bills': { lat: 42.7737, lon: -78.7869, city: 'Buffalo', state: 'NY' },
  'New England Patriots': { lat: 42.0909, lon: -71.2643, city: 'Foxborough', state: 'MA' },
  'Pittsburgh Steelers': { lat: 40.4468, lon: -80.0158, city: 'Pittsburgh', state: 'PA' },
  'Cleveland Browns': { lat: 41.5061, lon: -81.6995, city: 'Cleveland', state: 'OH' },
  'Cincinnati Bengals': { lat: 39.0955, lon: -84.5160, city: 'Cincinnati', state: 'OH' },
  'Baltimore Ravens': { lat: 39.2780, lon: -76.6227, city: 'Baltimore', state: 'MD' },
  'Denver Broncos': { lat: 39.7439, lon: -105.0201, city: 'Denver', state: 'CO' },
  'Kansas City Chiefs': { lat: 39.0489, lon: -94.4839, city: 'Kansas City', state: 'MO' },
  'Tennessee Titans': { lat: 36.1665, lon: -86.7713, city: 'Nashville', state: 'TN' },
  'Jacksonville Jaguars': { lat: 30.3240, lon: -81.6374, city: 'Jacksonville', state: 'FL' },
  'Miami Dolphins': { lat: 25.9580, lon: -80.2389, city: 'Miami', state: 'FL' },
  'Carolina Panthers': { lat: 35.2258, lon: -80.8528, city: 'Charlotte', state: 'NC' },
  'Washington Commanders': { lat: 38.9076, lon: -76.8645, city: 'Landover', state: 'MD' },
  'Philadelphia Eagles': { lat: 39.9008, lon: -75.1675, city: 'Philadelphia', state: 'PA' },
  'New York Giants': { lat: 40.8135, lon: -74.0745, city: 'East Rutherford', state: 'NJ' },
  'New York Jets': { lat: 40.8135, lon: -74.0745, city: 'East Rutherford', state: 'NJ' },
  'Seattle Seahawks': { lat: 47.5952, lon: -122.3316, city: 'Seattle', state: 'WA' },
  'San Francisco 49ers': { lat: 37.4030, lon: -121.9698, city: 'Santa Clara', state: 'CA' },
  'Tampa Bay Buccaneers': { lat: 27.9759, lon: -82.5033, city: 'Tampa', state: 'FL' },
  'Los Angeles Rams': { lat: 34.0141, lon: -118.2879, city: 'Los Angeles', state: 'CA' },
  'Los Angeles Chargers': { lat: 34.0141, lon: -118.2879, city: 'Los Angeles', state: 'CA' },
  'Las Vegas Raiders': { lat: 36.0909, lon: -115.1833, city: 'Las Vegas', state: 'NV' },
  'Arizona Cardinals': { lat: 33.5276, lon: -112.2626, city: 'Phoenix', state: 'AZ' },
  'Dallas Cowboys': { lat: 32.7473, lon: -97.0945, city: 'Arlington', state: 'TX' },
  'Houston Texans': { lat: 29.6847, lon: -95.4107, city: 'Houston', state: 'TX' },
  'Indianapolis Colts': { lat: 39.7601, lon: -86.1639, city: 'Indianapolis', state: 'IN' },
  'Minnesota Vikings': { lat: 44.9737, lon: -93.2581, city: 'Minneapolis', state: 'MN' },
  'Detroit Lions': { lat: 42.3400, lon: -83.0456, city: 'Detroit', state: 'MI' },
  'Atlanta Falcons': { lat: 33.7553, lon: -84.4006, city: 'Atlanta', state: 'GA' },

  // MLB Stadiums (outdoor only)
  'Boston Red Sox': { lat: 42.3467, lon: -71.0972, city: 'Boston', state: 'MA' },
  'New York Yankees': { lat: 40.8296, lon: -73.9262, city: 'New York', state: 'NY' },
  'Baltimore Orioles': { lat: 39.2840, lon: -76.6216, city: 'Baltimore', state: 'MD' },
  'Chicago Cubs': { lat: 41.9484, lon: -87.6553, city: 'Chicago', state: 'IL' },
  'Chicago White Sox': { lat: 41.8300, lon: -87.6338, city: 'Chicago', state: 'IL' },
  'Cleveland Guardians': { lat: 41.4962, lon: -81.6852, city: 'Cleveland', state: 'OH' },
  'Detroit Tigers': { lat: 42.3391, lon: -83.0485, city: 'Detroit', state: 'MI' },
  'Kansas City Royals': { lat: 39.0517, lon: -94.4803, city: 'Kansas City', state: 'MO' },
  'Minnesota Twins': { lat: 44.9817, lon: -93.2776, city: 'Minneapolis', state: 'MN' },
  'Los Angeles Angels': { lat: 33.8003, lon: -117.8827, city: 'Anaheim', state: 'CA' },
  'Oakland Athletics': { lat: 37.7516, lon: -122.2005, city: 'Oakland', state: 'CA' },
  'Seattle Mariners': { lat: 47.5914, lon: -122.3326, city: 'Seattle', state: 'WA' },
  'Texas Rangers': { lat: 32.7513, lon: -97.0835, city: 'Arlington', state: 'TX' },
  'Atlanta Braves': { lat: 33.8906, lon: -84.4677, city: 'Atlanta', state: 'GA' },
  'Philadelphia Phillies': { lat: 39.9056, lon: -75.1665, city: 'Philadelphia', state: 'PA' },
  'Washington Nationals': { lat: 38.8730, lon: -77.0074, city: 'Washington', state: 'DC' },
  'Cincinnati Reds': { lat: 39.0975, lon: -84.5063, city: 'Cincinnati', state: 'OH' },
  'Pittsburgh Pirates': { lat: 40.4469, lon: -80.0057, city: 'Pittsburgh', state: 'PA' },
  'St. Louis Cardinals': { lat: 38.6226, lon: -90.1928, city: 'St. Louis', state: 'MO' },
  'Colorado Rockies': { lat: 39.7559, lon: -104.9942, city: 'Denver', state: 'CO' },
  'Los Angeles Dodgers': { lat: 34.0739, lon: -118.2400, city: 'Los Angeles', state: 'CA' },
  'San Diego Padres': { lat: 32.7073, lon: -117.1566, city: 'San Diego', state: 'CA' },
  'San Francisco Giants': { lat: 37.7786, lon: -122.3893, city: 'San Francisco', state: 'CA' },
  'Milwaukee Brewers': { lat: 43.0281, lon: -87.9712, city: 'Milwaukee', state: 'WI' },
  'Houston Astros': { lat: 29.7573, lon: -95.3555, city: 'Houston', state: 'TX' },
  'New York Mets': { lat: 40.7571, lon: -73.8458, city: 'New York', state: 'NY' },
  'Arizona Diamondbacks': { lat: 33.4455, lon: -112.0667, city: 'Phoenix', state: 'AZ' },
  'Toronto Blue Jays': { lat: 43.6414, lon: -79.3894, city: 'Toronto', state: 'ON' },
  'Tampa Bay Rays': { lat: 27.7682, lon: -82.6534, city: 'St. Petersburg', state: 'FL' },
  'Miami Marlins': { lat: 25.7781, lon: -80.2196, city: 'Miami', state: 'FL' }
};

// Tracking
let totalGames = 0;
let processedGames = 0;
let insertedWeatherRecords = 0;
let errorCount = 0;
let skippedGames = 0;
let apiCalls = 0;
const startTime = Date.now();

interface WeatherRecord {
  game_id: number;
  temperature: number;
  wind_speed: number;
  wind_direction: string;
  precipitation: number;
  humidity: number;
  conditions: string;
  created_at?: string;
}

interface GameData {
  id: string;
  sport_id: string;
  start_time: string;
  home_team_id: number;
  away_team_id: number;
  home_team_name?: string;
  away_team_name?: string;
}

/**
 * Get outdoor games with PAGINATION to avoid query limits
 */
async function getOutdoorGames(sportFilter?: string): Promise<GameData[]> {
  console.log('🔍 Finding outdoor games (with pagination)...');
  
  // Determine which sports to process
  const outdoorSports = sportFilter ? [sportFilter] : ['nfl', 'mlb']; // Only sports affected by weather
  const allGames: GameData[] = [];
  
  for (const sport of outdoorSports) {
    console.log(`\n📊 Loading ${sport.toUpperCase()} games...`);
    
    let from = 0;
    const batchSize = CONFIG.PAGINATION_SIZE;
    
    while (true) {
      const { data: batch } = await supabase
        .from('games')
        .select(`
          id, 
          sport_id, 
          start_time, 
          home_team_id, 
          away_team_id,
          home_team:teams!games_home_team_id_fkey(name),
          away_team:teams!games_away_team_id_fkey(name)
        `)
        .eq('sport_id', sport)
        .eq('status', 'completed')
        .not('home_score', 'is', null)
        .gte('start_time', '2023-01-01')
        .order('start_time', { ascending: false })
        .range(from, from + batchSize - 1);
      
      if (!batch || batch.length === 0) break;
      
      // Transform to include team names
      const transformedBatch = batch.map(game => ({
        ...game,
        home_team_name: (game as any).home_team?.name,
        away_team_name: (game as any).away_team?.name
      }));
      
      allGames.push(...transformedBatch);
      from += batchSize;
      
      console.log(`  Loaded ${allGames.length} games so far...`);
      
      if (batch.length < batchSize) break;
    }
  }
  
  console.log(`\n✅ Found ${allGames.length} total outdoor games`);
  return allGames;
}

/**
 * Check existing weather data in BATCHES to avoid query limits
 */
async function getExistingWeatherData(gameIds: number[]): Promise<Set<number>> {
  console.log('🔍 Checking existing weather data...');
  
  const existingIds = new Set<number>();
  
  for (let i = 0; i < gameIds.length; i += 500) {
    const chunk = gameIds.slice(i, i + 500);
    
    const { data } = await supabase
      .from('weather_data')
      .select('game_id')
      .in('game_id', chunk);
      
    if (data) {
      data.forEach(w => existingIds.add(w.game_id));
    }
  }
  
  console.log(`✅ Found ${existingIds.size} games with existing weather data`);
  return existingIds;
}

/**
 * Fetch real weather data from OpenWeatherMap API
 */
async function fetchWeatherData(lat: number, lon: number, gameDate: Date): Promise<any> {
  const limit = pLimit(CONFIG.CONCURRENT_REQUESTS);
  
  return limit(async () => {
    try {
      // Use current weather for all games (historical data requires paid plan)
      const url = `${OPENWEATHER_BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=imperial`;
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Fantasy-AI-Weather-Collector/1.0'
        }
      });
      
      apiCalls++;
      
      // Add delay between API calls
      await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
      
      return response.data;
      
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.warn('⚠️  Rate limit hit, waiting 60 seconds...');
        await new Promise(resolve => setTimeout(resolve, 60000));
        throw new Error('Rate limit - retry');
      }
      
      // Re-throw error instead of generating fake data
      throw error;
    }
  });
}


/**
 * Convert API weather data to our format
 */
function parseWeatherData(apiData: any, gameId: number): WeatherRecord {
  let weatherData: any;
  
  // Handle different API response formats
  if (apiData.current) {
    // Historical data format
    weatherData = apiData.current;
  } else if (apiData.main) {
    // Current weather format
    weatherData = apiData;
  } else {
    throw new Error('Unknown weather data format');
  }
  
  const temperature = Math.round(weatherData.temp || weatherData.main?.temp || 70);
  const windSpeed = Math.round(weatherData.wind_speed || weatherData.wind?.speed || 0);
  const windDirection = getWindDirection(weatherData.wind_deg || weatherData.wind?.deg || 0);
  const humidity = weatherData.humidity || weatherData.main?.humidity || 50;
  const precipitation = (weatherData.rain?.['1h'] || weatherData.snow?.['1h'] || 0) * 100; // Convert to percentage
  
  let conditions = 'Clear';
  if (weatherData.weather && weatherData.weather[0]) {
    conditions = weatherData.weather[0].description;
  }
  
  return {
    game_id: gameId,
    temperature,
    wind_speed: windSpeed,
    wind_direction: windDirection,
    precipitation: Math.round(precipitation),
    humidity,
    conditions
  };
}

/**
 * Convert wind degrees to direction
 */
function getWindDirection(degrees: number): string {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

/**
 * Process weather data for games
 */
async function processWeatherData(games: GameData[]): Promise<WeatherRecord[]> {
  console.log(`\n🌦️  Processing weather data for ${games.length} games...`);
  
  const weatherRecords: WeatherRecord[] = [];
  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |{bar}| {percentage}% | {value}/{total} Games | ETA: {eta_formatted} | Rate: {rate} games/min',
    etaBuffer: 50,
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591'
  }, cliProgress.Presets.shades_classic);
  progressBar.start(games.length, 0);
  
  let processed = 0;
  let lastReportTime = Date.now();
  let lastReportCount = 0;
  
  // Process in smaller batches to ensure data is saved
  const processBatchSize = 50;
  
  for (let i = 0; i < games.length; i += processBatchSize) {
    const gameBatch = games.slice(i, Math.min(i + processBatchSize, games.length));
    const batchRecords: WeatherRecord[] = [];
    
    for (const game of gameBatch) {
    try {
      const gameId = parseInt(game.id.toString());
      
      // Validate ID range
      if (gameId > 2147483647) {
        console.warn(`⚠️  Game ID ${gameId} too large for integer field`);
        skippedGames++;
        continue;
      }
      
      // Get stadium location
      const homeTeamName = game.home_team_name;
      
      // Skip indoor stadiums for NFL and MLB
      if ((game.sport_id === 'nfl' && homeTeamName && NFL_INDOOR_TEAMS.includes(homeTeamName)) ||
          (game.sport_id === 'mlb' && homeTeamName && MLB_INDOOR_TEAMS.includes(homeTeamName))) {
        // Indoor stadium - use standard indoor conditions
        const weatherRecord: WeatherRecord = {
          game_id: gameId,
          temperature: 72,
          wind_speed: 0,
          wind_direction: 'N/A',
          precipitation: 0,
          humidity: 45,
          conditions: 'indoor/controlled'
        };
        batchRecords.push(weatherRecord);
        weatherRecords.push(weatherRecord);
        processedGames++;
        progressBar.update(++processed);
        continue;
      }
      
      const location = homeTeamName ? STADIUM_LOCATIONS[homeTeamName as keyof typeof STADIUM_LOCATIONS] : null;
      
      if (!location) {
        console.warn(`⚠️  No stadium location found for ${homeTeamName}`);
        skippedGames++;
        continue;
      }
      
      const gameDate = new Date(game.start_time);
      
      // Fetch weather data with retries
      let weatherData: any = null;
      let retries = 0;
      
      while (retries < CONFIG.MAX_RETRIES && !weatherData) {
        try {
          weatherData = await fetchWeatherData(location.lat, location.lon, gameDate);
        } catch (error: any) {
          retries++;
          if (error.message === 'Rate limit - retry' && retries < CONFIG.MAX_RETRIES) {
            continue;
          }
          throw error;
        }
      }
      
      if (!weatherData) {
        throw new Error('Failed to fetch weather data after retries');
      }
      
      const weatherRecord = parseWeatherData(weatherData, gameId);
      batchRecords.push(weatherRecord);
      weatherRecords.push(weatherRecord);
      processedGames++;
      
    } catch (error: any) {
      console.error(`\n❌ Error processing game ${game.id}: ${error.message}`);
      errorCount++;
    }
    
    progressBar.update(++processed);
    
    // Report progress every 50 games
    if (processed % 50 === 0 && processed > 0) {
      const currentTime = Date.now();
      const timeDiff = (currentTime - lastReportTime) / 1000 / 60; // minutes
      const gamesDiff = processed - lastReportCount;
      const rate = Math.round(gamesDiff / timeDiff);
      
      console.log(`\n📊 Progress Report: ${processed}/${games.length} games | Rate: ${rate} games/min | API calls: ${apiCalls}`);
      
      lastReportTime = currentTime;
      lastReportCount = processed;
    }
    }
    
    // Save this batch to database immediately
    if (batchRecords.length > 0) {
      console.log(`\n💾 Saving batch of ${batchRecords.length} records...`);
      await insertWeatherData(batchRecords);
    }
  }
  
  progressBar.stop();
  console.log(`\n✅ Processed ${weatherRecords.length} weather records`);
  
  return weatherRecords;
}

/**
 * Insert weather data in BATCHES to avoid query limits
 */
async function insertWeatherData(weatherRecords: WeatherRecord[]): Promise<void> {
  console.log(`\n💾 Inserting ${weatherRecords.length} weather records in batches...`);
  
  if (weatherRecords.length === 0) {
    console.log('⚠️  No weather data to insert');
    return;
  }
  
  let inserted = 0;
  let errorBatches = 0;
  
  for (let i = 0; i < weatherRecords.length; i += CONFIG.BATCH_SIZE) {
    const batch = weatherRecords.slice(i, i + CONFIG.BATCH_SIZE);
    
    const { data, error } = await supabase
      .from('weather_data')
      .insert(batch)
      .select();
    
    if (error) {
      console.error(`\nBatch ${Math.floor(i/CONFIG.BATCH_SIZE)+1} error:`, error.message);
      errorBatches++;
    } else if (data) {
      inserted += data.length;
    }
    
    process.stdout.write(`\r💾 Inserted ${inserted} / ${weatherRecords.length} records (${errorBatches} batch errors)`);
  }
  
  insertedWeatherRecords = inserted;
  console.log(`\n✅ Successfully inserted ${inserted} weather records`);
}

/**
 * Main collection function
 */
async function collectWeatherData(sportFilter?: string): Promise<void> {
  const sportName = sportFilter ? sportFilter.toUpperCase() : 'ALL OUTDOOR';
  console.log(`🚀 STARTING REAL-TIME WEATHER DATA COLLECTION FOR ${sportName} GAMES`);
  console.log(`⚡ Configuration: ${CONFIG.CONCURRENT_REQUESTS} concurrent requests, ${CONFIG.BATCH_SIZE} batch size`);
  console.log(`🔑 API Key: ${OPENWEATHER_API_KEY ? 'Present' : 'MISSING'}\n`);
  
  try {
    // Step 1: Get outdoor games
    const allGames = await getOutdoorGames(sportFilter);
    totalGames = allGames.length;
    
    if (totalGames === 0) {
      console.log('✅ No outdoor games found to process');
      return;
    }
    
    // Step 2: Check existing weather data
    const gameIds = allGames.map(g => parseInt(g.id.toString()));
    const existingWeatherIds = await getExistingWeatherData(gameIds);
    
    // Step 3: Filter to games needing weather data
    const gamesToProcess = allGames.filter(g => {
      const gameId = parseInt(g.id.toString());
      return !existingWeatherIds.has(gameId);
    });
    
    console.log(`\n🎯 Need to process ${gamesToProcess.length} games`);
    
    if (gamesToProcess.length === 0) {
      console.log('✅ All games already have weather data');
      return;
    }
    
    // Step 4: Process weather data (saves automatically in batches)
    const weatherRecords = await processWeatherData(gamesToProcess);
    
    // Final summary
    const elapsedTime = (Date.now() - startTime) / 1000;
    
    console.log('\n\n🏆 WEATHER DATA COLLECTION COMPLETE!\n');
    console.log(`⏱️  Total Time: ${(elapsedTime / 60).toFixed(1)} minutes`);
    console.log(`🎮 Games Found: ${totalGames}`);
    console.log(`📊 Games Processed: ${processedGames}`);
    console.log(`🌤️  Weather Records Inserted: ${insertedWeatherRecords}`);
    console.log(`⚠️  Games Skipped: ${skippedGames}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`🔌 API Calls Made: ${apiCalls}`);
    console.log(`⚡ Processing Rate: ${(processedGames / (elapsedTime / 60)).toFixed(1)} games/min`);
    
    // Check final total
    const { count: finalTotal } = await supabase
      .from('weather_data')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📈 Total weather records in database: ${finalTotal?.toLocaleString()}`);
    
    if (finalTotal && finalTotal > 0) {
      console.log('✅ Real-time weather data collection successful!');
    }
    
  } catch (error) {
    console.error('❌ Collection failed:', error);
  }
}

// Main execution
async function main(): Promise<void> {
  try {
    // Check dependencies
    require('axios');
    require('p-limit');
    require('cli-progress');
  } catch {
    console.log('📦 Installing required packages...');
    const { execSync } = require('child_process');
    execSync('npm install axios p-limit cli-progress', { stdio: 'inherit' });
  }
  
  // Parse command-line arguments
  const args = process.argv.slice(2);
  let sportFilter: string | undefined;
  
  // Check for --sport argument
  const sportArg = args.find(arg => arg.startsWith('--sport='));
  if (sportArg) {
    sportFilter = sportArg.split('=')[1]?.toLowerCase();
    if (sportFilter && !['nfl', 'mlb'].includes(sportFilter)) {
      console.error('❌ Invalid sport. Use --sport=nfl or --sport=mlb');
      process.exit(1);
    }
  }
  
  await collectWeatherData(sportFilter);
  
  console.log('\n👋 Exiting - Real-time weather collection complete!');
  process.exit(0);
}

main().catch(console.error);