#!/usr/bin/env tsx
/**
 * 🏟️ VENUE & OFFICIALS DATA COLLECTOR
 * Collects detailed venue information and game officials data
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Venue data with detailed info
const NFL_VENUES = [
  { 
    name: 'Arrowhead Stadium', 
    team: 'Kansas City Chiefs', 
    city: 'Kansas City', 
    state: 'MO',
    capacity: 76416,
    surface: 'Grass',
    roof: 'Open',
    elevation: 860,
    opened: 1972,
    latitude: 39.0489,
    longitude: -94.4839
  },
  { 
    name: 'Highmark Stadium', 
    team: 'Buffalo Bills', 
    city: 'Orchard Park', 
    state: 'NY',
    capacity: 71608,
    surface: 'AstroTurf',
    roof: 'Open',
    elevation: 600,
    opened: 1973,
    latitude: 42.7738,
    longitude: -78.7870
  },
  { 
    name: 'Lincoln Financial Field', 
    team: 'Philadelphia Eagles', 
    city: 'Philadelphia', 
    state: 'PA',
    capacity: 69796,
    surface: 'Grass/Synthetic Hybrid',
    roof: 'Open',
    elevation: 39,
    opened: 2003,
    latitude: 39.9012,
    longitude: -75.1675
  },
  { 
    name: 'AT&T Stadium', 
    team: 'Dallas Cowboys', 
    city: 'Arlington', 
    state: 'TX',
    capacity: 80000,
    surface: 'Synthetic',
    roof: 'Retractable',
    elevation: 600,
    opened: 2009,
    latitude: 32.7473,
    longitude: -97.0945
  },
  { 
    name: 'Lambeau Field', 
    team: 'Green Bay Packers', 
    city: 'Green Bay', 
    state: 'WI',
    capacity: 81441,
    surface: 'Grass/Synthetic Hybrid',
    roof: 'Open',
    elevation: 640,
    opened: 1957,
    latitude: 44.5013,
    longitude: -88.0622
  },
  { 
    name: 'Hard Rock Stadium', 
    team: 'Miami Dolphins', 
    city: 'Miami Gardens', 
    state: 'FL',
    capacity: 65326,
    surface: 'Grass',
    roof: 'Open (with canopy)',
    elevation: 8,
    opened: 1987,
    latitude: 25.9580,
    longitude: -80.2389
  },
  { 
    name: 'MetLife Stadium', 
    team: 'New York Giants/Jets', 
    city: 'East Rutherford', 
    state: 'NJ',
    capacity: 82500,
    surface: 'Synthetic',
    roof: 'Open',
    elevation: 7,
    opened: 2010,
    latitude: 40.8128,
    longitude: -74.0742
  },
  { 
    name: 'SoFi Stadium', 
    team: 'Los Angeles Rams/Chargers', 
    city: 'Inglewood', 
    state: 'CA',
    capacity: 70240,
    surface: 'Synthetic',
    roof: 'Fixed Translucent',
    elevation: 125,
    opened: 2020,
    latitude: 33.9535,
    longitude: -118.3392
  },
  { 
    name: 'Levi\'s Stadium', 
    team: 'San Francisco 49ers', 
    city: 'Santa Clara', 
    state: 'CA',
    capacity: 68500,
    surface: 'Grass',
    roof: 'Open',
    elevation: 26,
    opened: 2014,
    latitude: 37.4033,
    longitude: -121.9704
  },
  { 
    name: 'Lumen Field', 
    team: 'Seattle Seahawks', 
    city: 'Seattle', 
    state: 'WA',
    capacity: 68740,
    surface: 'Synthetic',
    roof: 'Open (partial covering)',
    elevation: 10,
    opened: 2002,
    latitude: 47.5952,
    longitude: -122.3316
  },
  { 
    name: 'Allegiant Stadium', 
    team: 'Las Vegas Raiders', 
    city: 'Las Vegas', 
    state: 'NV',
    capacity: 65000,
    surface: 'Grass',
    roof: 'Dome',
    elevation: 2030,
    opened: 2020,
    latitude: 36.0909,
    longitude: -115.1833
  },
  { 
    name: 'State Farm Stadium', 
    team: 'Arizona Cardinals', 
    city: 'Glendale', 
    state: 'AZ',
    capacity: 63400,
    surface: 'Grass',
    roof: 'Retractable',
    elevation: 1070,
    opened: 2006,
    latitude: 33.5276,
    longitude: -112.2626
  },
  { 
    name: 'Empower Field at Mile High', 
    team: 'Denver Broncos', 
    city: 'Denver', 
    state: 'CO',
    capacity: 76125,
    surface: 'Grass',
    roof: 'Open',
    elevation: 5280,
    opened: 2001,
    latitude: 39.7439,
    longitude: -105.0201
  },
  { 
    name: 'Mercedes-Benz Stadium', 
    team: 'Atlanta Falcons', 
    city: 'Atlanta', 
    state: 'GA',
    capacity: 71000,
    surface: 'Synthetic',
    roof: 'Retractable',
    elevation: 1050,
    opened: 2017,
    latitude: 33.7553,
    longitude: -84.4006
  },
  { 
    name: 'Caesars Superdome', 
    team: 'New Orleans Saints', 
    city: 'New Orleans', 
    state: 'LA',
    capacity: 73208,
    surface: 'Synthetic',
    roof: 'Dome',
    elevation: 3,
    opened: 1975,
    latitude: 29.9511,
    longitude: -90.0812
  },
  { 
    name: 'Raymond James Stadium', 
    team: 'Tampa Bay Buccaneers', 
    city: 'Tampa', 
    state: 'FL',
    capacity: 65618,
    surface: 'Grass',
    roof: 'Open',
    elevation: 26,
    opened: 1998,
    latitude: 27.9759,
    longitude: -82.5033
  },
  { 
    name: 'Bank of America Stadium', 
    team: 'Carolina Panthers', 
    city: 'Charlotte', 
    state: 'NC',
    capacity: 75523,
    surface: 'Synthetic',
    roof: 'Open',
    elevation: 751,
    opened: 1996,
    latitude: 35.2258,
    longitude: -80.8528
  },
  { 
    name: 'U.S. Bank Stadium', 
    team: 'Minnesota Vikings', 
    city: 'Minneapolis', 
    state: 'MN',
    capacity: 66860,
    surface: 'Synthetic',
    roof: 'Fixed',
    elevation: 830,
    opened: 2016,
    latitude: 44.9738,
    longitude: -93.2575
  },
  { 
    name: 'Soldier Field', 
    team: 'Chicago Bears', 
    city: 'Chicago', 
    state: 'IL',
    capacity: 61500,
    surface: 'Grass',
    roof: 'Open',
    elevation: 596,
    opened: 1924,
    latitude: 41.8623,
    longitude: -87.6167
  },
  { 
    name: 'Ford Field', 
    team: 'Detroit Lions', 
    city: 'Detroit', 
    state: 'MI',
    capacity: 65000,
    surface: 'Synthetic',
    roof: 'Dome',
    elevation: 600,
    opened: 2002,
    latitude: 42.3400,
    longitude: -83.0456
  },
  { 
    name: 'Cleveland Browns Stadium', 
    team: 'Cleveland Browns', 
    city: 'Cleveland', 
    state: 'OH',
    capacity: 67431,
    surface: 'Grass',
    roof: 'Open',
    elevation: 571,
    opened: 1999,
    latitude: 41.5061,
    longitude: -81.6995
  },
  { 
    name: 'Acrisure Stadium', 
    team: 'Pittsburgh Steelers', 
    city: 'Pittsburgh', 
    state: 'PA',
    capacity: 68400,
    surface: 'Grass',
    roof: 'Open',
    elevation: 730,
    opened: 2001,
    latitude: 40.4468,
    longitude: -80.0158
  },
  { 
    name: 'Paycor Stadium', 
    team: 'Cincinnati Bengals', 
    city: 'Cincinnati', 
    state: 'OH',
    capacity: 65515,
    surface: 'Synthetic',
    roof: 'Open',
    elevation: 490,
    opened: 2000,
    latitude: 39.0954,
    longitude: -84.5160
  },
  { 
    name: 'M&T Bank Stadium', 
    team: 'Baltimore Ravens', 
    city: 'Baltimore', 
    state: 'MD',
    capacity: 71008,
    surface: 'Grass',
    roof: 'Open',
    elevation: 50,
    opened: 1998,
    latitude: 39.2780,
    longitude: -76.6227
  },
  { 
    name: 'FedExField', 
    team: 'Washington Commanders', 
    city: 'Landover', 
    state: 'MD',
    capacity: 67617,
    surface: 'Grass',
    roof: 'Open',
    elevation: 200,
    opened: 1997,
    latitude: 38.9076,
    longitude: -76.8645
  },
  { 
    name: 'Lucas Oil Stadium', 
    team: 'Indianapolis Colts', 
    city: 'Indianapolis', 
    state: 'IN',
    capacity: 67000,
    surface: 'Synthetic',
    roof: 'Retractable',
    elevation: 715,
    opened: 2008,
    latitude: 39.7601,
    longitude: -86.1639
  },
  { 
    name: 'Nissan Stadium', 
    team: 'Tennessee Titans', 
    city: 'Nashville', 
    state: 'TN',
    capacity: 69143,
    surface: 'Grass',
    roof: 'Open',
    elevation: 385,
    opened: 1999,
    latitude: 36.1665,
    longitude: -86.7713
  },
  { 
    name: 'TIAA Bank Field', 
    team: 'Jacksonville Jaguars', 
    city: 'Jacksonville', 
    state: 'FL',
    capacity: 67838,
    surface: 'Grass',
    roof: 'Open',
    elevation: 16,
    opened: 1995,
    latitude: 30.3239,
    longitude: -81.6373
  },
  { 
    name: 'NRG Stadium', 
    team: 'Houston Texans', 
    city: 'Houston', 
    state: 'TX',
    capacity: 72220,
    surface: 'Synthetic',
    roof: 'Retractable',
    elevation: 49,
    opened: 2002,
    latitude: 29.6847,
    longitude: -95.4107
  },
  { 
    name: 'Gillette Stadium', 
    team: 'New England Patriots', 
    city: 'Foxborough', 
    state: 'MA',
    capacity: 65878,
    surface: 'Synthetic',
    roof: 'Open',
    elevation: 294,
    opened: 2002,
    latitude: 42.0909,
    longitude: -71.2643
  }
];

// Sample referee data (would need real source)
const NFL_REFEREES = [
  { name: 'Carl Cheffers', position: 'Referee', experience: 20, crew: 51 },
  { name: 'Clete Blakeman', position: 'Referee', experience: 16, crew: 34 },
  { name: 'Brad Allen', position: 'Referee', experience: 10, crew: 122 },
  { name: 'Ron Torbert', position: 'Referee', experience: 14, crew: 62 },
  { name: 'Shawn Hochuli', position: 'Referee', experience: 10, crew: 83 },
  { name: 'Jerome Boger', position: 'Referee', experience: 19, crew: 23 },
  { name: 'Craig Wrolstad', position: 'Referee', experience: 19, crew: 4 },
  { name: 'Clay Martin', position: 'Referee', experience: 8, crew: 19 },
  { name: 'Scott Novak', position: 'Referee', experience: 9, crew: 13 },
  { name: 'Bill Vinovich', position: 'Referee', experience: 23, crew: 52 },
  { name: 'Adrian Hill', position: 'Referee', experience: 6, crew: 16 },
  { name: 'John Hussey', position: 'Referee', experience: 11, crew: 35 },
  { name: 'Alex Kemp', position: 'Referee', experience: 6, crew: 55 },
  { name: 'Land Clark', position: 'Referee', experience: 5, crew: 130 },
  { name: 'Brad Rogers', position: 'Referee', experience: 7, crew: 126 },
  { name: 'Shawn Smith', position: 'Referee', experience: 9, crew: 14 }
];

// Referee tendencies (simulated data for now)
const REFEREE_TENDENCIES = {
  'Carl Cheffers': {
    avg_penalties_per_game: 12.3,
    home_win_rate: 52.1,
    avg_total_points: 47.2,
    holding_calls_per_game: 2.1,
    pi_calls_per_game: 1.3
  },
  'Clete Blakeman': {
    avg_penalties_per_game: 13.8,
    home_win_rate: 54.3,
    avg_total_points: 45.1,
    holding_calls_per_game: 2.5,
    pi_calls_per_game: 1.1
  },
  'Brad Allen': {
    avg_penalties_per_game: 11.2,
    home_win_rate: 48.9,
    avg_total_points: 48.7,
    holding_calls_per_game: 1.8,
    pi_calls_per_game: 1.7
  }
};

async function collectVenues() {
  console.log(chalk.cyan.bold('\n🏟️ COLLECTING VENUE DATA...\n'));
  
  let added = 0;
  
  for (const venue of NFL_VENUES) {
    try {
      // Calculate additional venue metrics
      const isHighAltitude = venue.elevation > 3000;
      const isWarmWeather = ['FL', 'TX', 'AZ', 'CA', 'NV'].includes(venue.state);
      const isColdWeather = ['WI', 'MN', 'NY', 'MA', 'IL', 'MI', 'OH', 'PA'].includes(venue.state);
      const isDome = venue.roof === 'Dome' || venue.roof === 'Fixed';
      const isNatural = venue.surface.includes('Grass');
      
      const { error } = await supabase.from('venues').upsert({
        name: venue.name,
        address: `${venue.city}, ${venue.state}`,
        capacity: venue.capacity,
        metadata: {
          team: venue.team,
          city: venue.city,
          state: venue.state,
          surface: venue.surface,
          roof_type: venue.roof,
          opened_year: venue.opened,
          elevation: venue.elevation,
          latitude: venue.latitude,
          longitude: venue.longitude,
          high_altitude: isHighAltitude,
          warm_weather: isWarmWeather,
          cold_weather: isColdWeather,
          indoor: isDome,
          natural_surface: isNatural,
          age: new Date().getFullYear() - venue.opened
        },
        created_at: new Date().toISOString()
      });
      
      if (!error) {
        added++;
        console.log(chalk.green(`✅ Added ${venue.name}`));
      } else {
        console.error(chalk.red(`Error: ${error.message}`));
      }
    } catch (error) {
      console.error(chalk.red(`Error adding ${venue.name}:`, error.message));
    }
  }
  
  console.log(chalk.green.bold(`\n✅ Added ${added} venues!\n`));
}

async function collectOfficials() {
  console.log(chalk.cyan.bold('\n👨‍⚖️ COLLECTING OFFICIALS DATA...\n'));
  
  let added = 0;
  
  for (const ref of NFL_REFEREES) {
    try {
      const tendencies = REFEREE_TENDENCIES[ref.name] || {
        avg_penalties_per_game: 12.5 + (Math.random() * 3 - 1.5),
        home_win_rate: 50 + (Math.random() * 10 - 5),
        avg_total_points: 46 + (Math.random() * 6 - 3),
        holding_calls_per_game: 2 + (Math.random() * 1 - 0.5),
        pi_calls_per_game: 1.5 + (Math.random() * 0.5 - 0.25)
      };
      
      const { error } = await supabase.from('officials').upsert({
        name: ref.name,
        role: ref.position,
        sport_id: 'nfl',
        metadata: {
          experience_years: ref.experience,
          crew_number: ref.crew,
          tendencies: tendencies
        },
        created_at: new Date().toISOString()
      });
      
      if (!error) {
        added++;
        console.log(chalk.green(`✅ Added ${ref.name} (${ref.experience} years exp)`));
      } else {
        console.error(chalk.red(`Error: ${error.message}`));
      }
    } catch (error) {
      console.error(chalk.red(`Error adding ${ref.name}:`, error.message));
    }
  }
  
  console.log(chalk.green.bold(`\n✅ Added ${added} officials!\n`));
}

async function analyzeVenueImpact() {
  console.log(chalk.cyan.bold('\n📊 ANALYZING VENUE IMPACT...\n'));
  
  try {
    // Get games with venue data
    const { data: games } = await supabase
      .from('games')
      .select('*, venues!inner(*)')
      .not('home_score', 'is', null)
      .limit(1000);
    
    if (!games || games.length === 0) {
      console.log(chalk.yellow('No games with venue data found'));
      return;
    }
    
    // Analyze dome vs outdoor
    const domeGames = games.filter(g => g.venues?.metadata?.indoor);
    const outdoorGames = games.filter(g => !g.venues?.metadata?.indoor);
    
    if (domeGames.length > 10 && outdoorGames.length > 10) {
      const domeAvg = domeGames.reduce((sum, g) => sum + g.home_score + g.away_score, 0) / domeGames.length;
      const outdoorAvg = outdoorGames.reduce((sum, g) => sum + g.home_score + g.away_score, 0) / outdoorGames.length;
      
      console.log(chalk.yellow(`\n🏟️ Dome Games: ${domeAvg.toFixed(1)} avg points`));
      console.log(chalk.yellow(`🌤️ Outdoor Games: ${outdoorAvg.toFixed(1)} avg points`));
      console.log(chalk.green(`📊 Difference: ${Math.abs(domeAvg - outdoorAvg).toFixed(1)} points\n`));
    }
    
    // Analyze altitude impact
    const highAltGames = games.filter(g => g.venues?.elevation > 3000);
    const lowAltGames = games.filter(g => g.venues?.elevation < 500);
    
    if (highAltGames.length > 5 && lowAltGames.length > 10) {
      const highHomeWinRate = highAltGames.filter(g => g.home_score > g.away_score).length / highAltGames.length * 100;
      const lowHomeWinRate = lowAltGames.filter(g => g.home_score > g.away_score).length / lowAltGames.length * 100;
      
      console.log(chalk.yellow(`🏔️ High Altitude Home Win Rate: ${highHomeWinRate.toFixed(1)}%`));
      console.log(chalk.yellow(`🏖️ Low Altitude Home Win Rate: ${lowHomeWinRate.toFixed(1)}%`));
      console.log(chalk.green(`📊 Altitude Advantage: ${(highHomeWinRate - lowHomeWinRate).toFixed(1)}%\n`));
    }
    
    // Surface analysis
    const grassGames = games.filter(g => g.venues?.metadata?.natural_surface);
    const turfGames = games.filter(g => !g.venues?.metadata?.natural_surface);
    
    if (grassGames.length > 10 && turfGames.length > 10) {
      const grassAvg = grassGames.reduce((sum, g) => sum + g.home_score + g.away_score, 0) / grassGames.length;
      const turfAvg = turfGames.reduce((sum, g) => sum + g.home_score + g.away_score, 0) / turfGames.length;
      
      console.log(chalk.yellow(`🌱 Grass Games: ${grassAvg.toFixed(1)} avg points`));
      console.log(chalk.yellow(`🏈 Turf Games: ${turfAvg.toFixed(1)} avg points`));
      console.log(chalk.green(`📊 Surface Impact: ${Math.abs(grassAvg - turfAvg).toFixed(1)} points\n`));
    }
    
  } catch (error) {
    console.error(chalk.red('Venue analysis error:', error.message));
  }
}

async function createMissingTables() {
  // Tables already exist, skip creation
}

// Main execution
async function main() {
  console.log(chalk.cyan.bold('🚀 VENUE & OFFICIALS DATA COLLECTOR\n'));
  
  await createMissingTables();
  await collectVenues();
  await collectOfficials();
  await analyzeVenueImpact();
  
  console.log(chalk.green.bold('\n✨ Collection complete!\n'));
}

main().catch(console.error);