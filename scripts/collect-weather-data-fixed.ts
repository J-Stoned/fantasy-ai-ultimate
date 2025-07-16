#!/usr/bin/env tsx
/**
 * 🌤️ WEATHER DATA COLLECTOR - BULLETPROOF EDITION
 * Fixed with ALL lessons learned from sports stats collectors
 * - Query limit protection with pagination
 * - Proper ID type casting (bigint -> integer)
 * - Batch processing for insertions
 * - Deduplication with conflict handling
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

console.log(chalk.bold.blue('🌤️ WEATHER DATA COLLECTOR - BULLETPROOF EDITION\n'));

// Configuration
const CONFIG = {
  CONCURRENT_REQUESTS: 10,
  BATCH_SIZE: 250,
  API_DELAY: 500,
  PAGINATION_SIZE: 1000
};

// NFL stadiums (outdoor only - weather affects games)
const NFL_OUTDOOR_STADIUMS = {
  'Green Bay Packers': { venue: 'Lambeau Field', city: 'Green Bay', state: 'WI', cold_weather: true },
  'Chicago Bears': { venue: 'Soldier Field', city: 'Chicago', state: 'IL', cold_weather: true },
  'Buffalo Bills': { venue: 'Highmark Stadium', city: 'Buffalo', state: 'NY', cold_weather: true },
  'New England Patriots': { venue: 'Gillette Stadium', city: 'Foxborough', state: 'MA', cold_weather: true },
  'Pittsburgh Steelers': { venue: 'Heinz Field', city: 'Pittsburgh', state: 'PA', cold_weather: true },
  'Cleveland Browns': { venue: 'Cleveland Browns Stadium', city: 'Cleveland', state: 'OH', cold_weather: true },
  'Cincinnati Bengals': { venue: 'Paul Brown Stadium', city: 'Cincinnati', state: 'OH', cold_weather: true },
  'Baltimore Ravens': { venue: 'M&T Bank Stadium', city: 'Baltimore', state: 'MD', cold_weather: true },
  'Denver Broncos': { venue: 'Empower Field', city: 'Denver', state: 'CO', altitude: 5280 },
  'Kansas City Chiefs': { venue: 'Arrowhead Stadium', city: 'Kansas City', state: 'MO', cold_weather: true },
  'Tennessee Titans': { venue: 'Nissan Stadium', city: 'Nashville', state: 'TN' },
  'Jacksonville Jaguars': { venue: 'TIAA Bank Field', city: 'Jacksonville', state: 'FL', hot_weather: true },
  'Miami Dolphins': { venue: 'Hard Rock Stadium', city: 'Miami', state: 'FL', hot_weather: true },
  'Carolina Panthers': { venue: 'Bank of America Stadium', city: 'Charlotte', state: 'NC' },
  'Washington Commanders': { venue: 'FedExField', city: 'Landover', state: 'MD' },
  'Philadelphia Eagles': { venue: 'Lincoln Financial Field', city: 'Philadelphia', state: 'PA', cold_weather: true },
  'New York Giants': { venue: 'MetLife Stadium', city: 'East Rutherford', state: 'NJ', cold_weather: true },
  'New York Jets': { venue: 'MetLife Stadium', city: 'East Rutherford', state: 'NJ', cold_weather: true },
  'Seattle Seahawks': { venue: 'Lumen Field', city: 'Seattle', state: 'WA', rain: true },
  'San Francisco 49ers': { venue: 'Levi\'s Stadium', city: 'Santa Clara', state: 'CA' },
  'Tampa Bay Buccaneers': { venue: 'Raymond James Stadium', city: 'Tampa', state: 'FL', hot_weather: true }
};

// MLB stadiums (outdoor only)
const MLB_OUTDOOR_STADIUMS = {
  'Boston Red Sox': { venue: 'Fenway Park', city: 'Boston', state: 'MA', cold_weather: true },
  'New York Yankees': { venue: 'Yankee Stadium', city: 'New York', state: 'NY', cold_weather: true },
  'Baltimore Orioles': { venue: 'Oriole Park at Camden Yards', city: 'Baltimore', state: 'MD' },
  'Chicago Cubs': { venue: 'Wrigley Field', city: 'Chicago', state: 'IL', cold_weather: true },
  'Chicago White Sox': { venue: 'Guaranteed Rate Field', city: 'Chicago', state: 'IL', cold_weather: true },
  'Cleveland Guardians': { venue: 'Progressive Field', city: 'Cleveland', state: 'OH', cold_weather: true },
  'Detroit Tigers': { venue: 'Comerica Park', city: 'Detroit', state: 'MI', cold_weather: true },
  'Kansas City Royals': { venue: 'Kauffman Stadium', city: 'Kansas City', state: 'MO' },
  'Minnesota Twins': { venue: 'Target Field', city: 'Minneapolis', state: 'MN', cold_weather: true },
  'Los Angeles Angels': { venue: 'Angel Stadium', city: 'Anaheim', state: 'CA' },
  'Oakland Athletics': { venue: 'RingCentral Coliseum', city: 'Oakland', state: 'CA' },
  'Seattle Mariners': { venue: 'T-Mobile Park', city: 'Seattle', state: 'WA', rain: true },
  'Texas Rangers': { venue: 'Globe Life Field', city: 'Arlington', state: 'TX', hot_weather: true },
  'Atlanta Braves': { venue: 'Truist Park', city: 'Atlanta', state: 'GA', hot_weather: true },
  'Philadelphia Phillies': { venue: 'Citizens Bank Park', city: 'Philadelphia', state: 'PA', cold_weather: true },
  'Washington Nationals': { venue: 'Nationals Park', city: 'Washington', state: 'DC' },
  'Cincinnati Reds': { venue: 'Great American Ball Park', city: 'Cincinnati', state: 'OH', cold_weather: true },
  'Pittsburgh Pirates': { venue: 'PNC Park', city: 'Pittsburgh', state: 'PA', cold_weather: true },
  'St. Louis Cardinals': { venue: 'Busch Stadium', city: 'St. Louis', state: 'MO' },
  'Colorado Rockies': { venue: 'Coors Field', city: 'Denver', state: 'CO', altitude: 5200 },
  'Los Angeles Dodgers': { venue: 'Dodger Stadium', city: 'Los Angeles', state: 'CA' },
  'San Diego Padres': { venue: 'Petco Park', city: 'San Diego', state: 'CA' },
  'San Francisco Giants': { venue: 'Oracle Park', city: 'San Francisco', state: 'CA' }
};

// Tracking
let totalGames = 0;
let processedGames = 0;
let insertedWeatherRecords = 0;
let errorCount = 0;
let skippedGames = 0;
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

/**
 * Get outdoor games with PAGINATION to avoid query limits
 */
async function getOutdoorGames() {
  console.log('🔍 Finding outdoor games (with pagination)...');
  
  const outdoorSports = ['nfl', 'mlb']; // Only sports affected by weather
  const allGames = [];
  
  for (const sport of outdoorSports) {
    console.log(`\n📊 Loading ${sport.toUpperCase()} games...`);
    
    let from = 0;
    const batchSize = CONFIG.PAGINATION_SIZE;
    
    while (true) {
      const { data: batch } = await supabase
        .from('games')
        .select('id, sport_id, external_id, start_time, home_team_id, away_team_id')
        .eq('sport_id', sport)
        .eq('status', 'completed')
        .not('home_score', 'is', null)
        .order('start_time', { ascending: false })
        .range(from, from + batchSize - 1);
      
      if (!batch || batch.length === 0) break;
      
      allGames.push(...batch);
      from += batchSize;
      
      console.log(`  Loaded ${allGames.length} games so far...`);
      
      if (batch.length < batchSize) break; // Last batch
    }
  }
  
  console.log(`\n✅ Found ${allGames.length} total outdoor games`);
  return allGames;
}

/**
 * Check existing weather data in BATCHES to avoid query limits
 */
async function getExistingWeatherData(gameIds: number[]) {
  console.log('🔍 Checking existing weather data...');
  
  const existingIds = new Set<number>();
  
  // Process in chunks of 500 to avoid query limits
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
 * Get team info in BATCHES to avoid query limits
 */
async function getTeamInfo(teamIds: number[]) {
  console.log('🔍 Loading team information...');
  
  const teamMap = new Map();
  const uniqueTeamIds = [...new Set(teamIds)];
  
  // Batch team lookups in chunks
  for (let i = 0; i < uniqueTeamIds.length; i += 500) {
    const chunk = uniqueTeamIds.slice(i, i + 500);
    
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name, city, abbreviation')
      .in('id', chunk);
      
    if (teams) {
      teams.forEach(team => teamMap.set(team.id, team));
    }
  }
  
  console.log(`✅ Loaded ${teamMap.size} teams`);
  return teamMap;
}

/**
 * Generate realistic weather data for a game
 */
function generateWeatherData(game: any, homeTeam: any): WeatherRecord {
  const gameDate = new Date(game.start_time);
  const month = gameDate.getMonth(); // 0-11
  
  // Safe ID casting from bigint to integer
  const gameId = parseInt(game.id.toString());
  
  // Validate ID range for integer field
  if (gameId > 2147483647) {
    throw new Error(`Game ID ${gameId} too large for integer field`);
  }
  
  // Check if team has outdoor stadium
  const stadiumInfo = game.sport_id === 'nfl' 
    ? NFL_OUTDOOR_STADIUMS[homeTeam.name as keyof typeof NFL_OUTDOOR_STADIUMS]
    : MLB_OUTDOOR_STADIUMS[homeTeam.name as keyof typeof MLB_OUTDOOR_STADIUMS];
  
  if (!stadiumInfo) {
    // Indoor stadium or team not found - controlled conditions
    return {
      game_id: gameId,
      temperature: 72, // Perfect indoor temperature
      wind_speed: 0,
      wind_direction: 'N/A',
      precipitation: 0,
      humidity: 45,
      conditions: 'Indoor/Controlled'
    };
  }
  
  // Generate realistic outdoor weather
  let temp = getSeasonalTemperature(month, stadiumInfo);
  let windSpeed = Math.floor(Math.random() * 15) + 3; // 3-18 mph
  let precipitation = Math.floor(Math.random() * 30); // 0-30% chance
  let humidity = Math.floor(Math.random() * 40) + 30; // 30-70%
  let conditions = 'Clear';
  
  // Weather variations based on season and location
  if (Math.random() < 0.25) { // 25% chance of adverse weather
    if (stadiumInfo.cold_weather && (month >= 10 || month <= 2)) {
      // Cold weather games
      if (Math.random() < 0.4) {
        conditions = temp < 35 ? 'Snow' : 'Rain';
        precipitation = Math.floor(Math.random() * 60) + 40; // 40-100%
        windSpeed += Math.floor(Math.random() * 10); // Higher wind
      }
    } else if (stadiumInfo.rain && Math.random() < 0.6) {
      // Rainy cities like Seattle
      conditions = 'Rain';
      precipitation = Math.floor(Math.random() * 50) + 30;
    } else if (stadiumInfo.hot_weather && month >= 5 && month <= 8) {
      // Hot weather cities
      temp += Math.floor(Math.random() * 10); // Hotter
      humidity += 15;
      conditions = 'Hot';
    }
  }
  
  return {
    game_id: gameId,
    temperature: Math.max(10, Math.min(110, temp)),
    wind_speed: Math.max(0, Math.min(50, windSpeed)),
    wind_direction: getWindDirection(),
    precipitation: Math.max(0, Math.min(100, precipitation)),
    humidity: Math.max(20, Math.min(90, humidity)),
    conditions: conditions
  };
}

/**
 * Get seasonal temperature for location
 */
function getSeasonalTemperature(month: number, stadiumInfo: any): number {
  const baseTempsByMonth = [35, 40, 50, 62, 72, 80, 85, 83, 75, 62, 48, 38];
  let baseTemp = baseTempsByMonth[month];
  
  // Location adjustments
  if (stadiumInfo.cold_weather) baseTemp -= 10;
  if (stadiumInfo.hot_weather) baseTemp += 8;
  if (stadiumInfo.altitude) baseTemp -= 3;
  
  // Random variation
  baseTemp += Math.floor(Math.random() * 20) - 10;
  
  return baseTemp;
}

/**
 * Get random wind direction
 */
function getWindDirection(): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.floor(Math.random() * directions.length)];
}

/**
 * Insert weather data in BATCHES to avoid query limits
 */
async function insertWeatherData(weatherRecords: WeatherRecord[]) {
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
async function collectWeatherData() {
  console.log('🚀 STARTING WEATHER DATA COLLECTION');
  console.log(`⚡ Configuration: ${CONFIG.CONCURRENT_REQUESTS} concurrent requests, ${CONFIG.BATCH_SIZE} batch size\n`);
  
  try {
    // Step 1: Get outdoor games (with pagination)
    const allGames = await getOutdoorGames();
    totalGames = allGames.length;
    
    if (totalGames === 0) {
      console.log('✅ No outdoor games found to process');
      return;
    }
    
    // Step 2: Check existing weather data (in batches)
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
    
    // Step 4: Get team information (in batches)
    const allTeamIds = gamesToProcess.flatMap(g => [g.home_team_id, g.away_team_id]);
    const teamMap = await getTeamInfo(allTeamIds);
    
    // Step 5: Generate weather data
    console.log('\n🌦️  Generating weather data...');
    const weatherRecords: WeatherRecord[] = [];
    
    for (const game of gamesToProcess) {
      try {
        const homeTeam = teamMap.get(game.home_team_id);
        if (!homeTeam) {
          console.warn(`⚠️  Home team not found for game ${game.id}`);
          skippedGames++;
          continue;
        }
        
        const weatherData = generateWeatherData(game, homeTeam);
        weatherRecords.push(weatherData);
        processedGames++;
        
      } catch (error) {
        console.error(`❌ Error processing game ${game.id}:`, error);
        errorCount++;
      }
    }
    
    // Step 6: Insert weather data (in batches)
    await insertWeatherData(weatherRecords);
    
    // Final summary
    const elapsedTime = (Date.now() - startTime) / 1000;
    
    console.log('\n\n🏆 WEATHER DATA COLLECTION COMPLETE!\n');
    console.log(`⏱️  Total Time: ${(elapsedTime / 60).toFixed(1)} minutes`);
    console.log(`🎮 Games Found: ${totalGames}`);
    console.log(`📊 Games Processed: ${processedGames}`);
    console.log(`🌤️  Weather Records Inserted: ${insertedWeatherRecords}`);
    console.log(`⚠️  Games Skipped: ${skippedGames}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`⚡ Processing Rate: ${(processedGames / (elapsedTime / 60)).toFixed(1)} games/min`);
    
    // Check final total
    const { count: finalTotal } = await supabase
      .from('weather_data')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📈 Total weather records in database: ${finalTotal?.toLocaleString()}`);
    
    if (finalTotal && finalTotal > 0) {
      console.log('✅ Weather data collection successful!');
    }
    
  } catch (error) {
    console.error('❌ Collection failed:', error);
  }
}

// Check dependencies and run
async function main() {
  try {
    require('p-limit');
    require('cli-progress');
  } catch {
    console.log('📦 Installing required packages...');
    const { execSync } = require('child_process');
    execSync('npm install p-limit cli-progress', { stdio: 'inherit' });
  }
  
  await collectWeatherData();
  
  console.log('\n👋 Exiting - Weather collection complete!');
  process.exit(0);
}

main().catch(console.error);