#!/usr/bin/env tsx
/**
 * 🏒 NHL GAMES COLLECTOR V2 - Get ALL games
 * Uses daily fetching to ensure we don't miss any games
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

console.log(chalk.bold.cyan('🏒 NHL GAMES COLLECTOR V2 - COMPLETE COLLECTION\n'));

// Configuration
const CONFIG = {
  CONCURRENT_REQUESTS: 5,   // Lower to avoid rate limits
  API_DELAY: 1000,         // 1 second between requests
  BATCH_SIZE: 100
};

// Tracking
let totalGames = 0;
let newGames = 0;
let duplicates = 0;

async function getNHLTeams() {
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .or('sport_id.eq.nhl,sport_id.eq.NHL');
  
  const teamLookup = new Map();
  teams?.forEach(team => {
    teamLookup.set(team.name, team.id);
  });
  
  return teamLookup;
}

async function fetchGamesForDate(date: string) {
  try {
    const dateStr = date.replace(/-/g, '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${dateStr}`;
    
    const response = await axios.get(url, { timeout: 10000 });
    
    if (!response.data.events) {
      return [];
    }
    
    return response.data.events.map((event: any) => {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
      const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
      
      return {
        external_id: `espn_nhl_${event.id}`,
        sport_id: 'nhl',
        home_team_name: homeTeam.team.displayName,
        away_team_name: awayTeam.team.displayName,
        home_score: competition.status.type.completed ? parseInt(homeTeam.score) : null,
        away_score: competition.status.type.completed ? parseInt(awayTeam.score) : null,
        start_time: event.date,
        status: competition.status.type.completed ? 'completed' : 'scheduled',
        venue: competition.venue?.fullName || null,
        metadata: {
          period: competition.status.period,
          clock: competition.status.displayClock,
          attendance: competition.attendance || null,
          date: date
        }
      };
    });
    
  } catch (error: any) {
    if (error.response?.status === 404) {
      return []; // No games on this date
    }
    console.log(`❌ Error fetching ${date}:`, error.message);
    return [];
  }
}

async function collectAllNHLGames() {
  const startTime = Date.now();
  
  // Get teams
  console.log('🏟️  Loading NHL teams...');
  const teamLookup = await getNHLTeams();
  console.log(`✅ Loaded ${teamLookup.size} NHL teams\n`);
  
  // Get existing games to check what we have
  const { data: existingGames } = await supabase
    .from('games')
    .select('external_id')
    .or('sport_id.eq.nhl,sport_id.eq.NHL');
  
  const existingSet = new Set(existingGames?.map(g => g.external_id) || []);
  console.log(`📊 Already have ${existingSet.size} NHL games in database\n`);
  
  console.log('🏒 Collecting ALL NHL games by date...\n');
  
  // Define date ranges for each season
  const dateRanges = [
    // 2023-24 season
    { start: new Date('2023-10-10'), end: new Date('2024-06-24'), season: '2023-24' },
    // 2024-25 season (up to current date)
    { start: new Date('2024-10-08'), end: new Date('2025-07-14'), season: '2024-25' }
  ];
  
  const allGames: any[] = [];
  const limit = pLimit(CONFIG.CONCURRENT_REQUESTS);
  
  for (const range of dateRanges) {
    console.log(`\n📅 Processing ${range.season} season...`);
    
    // Generate all dates in range
    const dates: string[] = [];
    const currentDate = new Date(range.start);
    
    while (currentDate <= range.end) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    console.log(`📊 Checking ${dates.length} days for games...`);
    
    // Progress bar
    const progressBar = new cliProgress.SingleBar({
      format: `${range.season} |{bar}| {percentage}% | {value}/{total} Days | {games} Games Found`,
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
    
    progressBar.start(dates.length, 0, { games: 0 });
    
    let processedDays = 0;
    let seasonGames = 0;
    
    // Fetch games for each date
    const datePromises = dates.map((date, index) =>
      limit(async () => {
        const games = await fetchGamesForDate(date);
        
        if (games.length > 0) {
          allGames.push(...games);
          seasonGames += games.length;
        }
        
        processedDays++;
        progressBar.update(processedDays, { games: seasonGames });
        
        await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
      })
    );
    
    await Promise.all(datePromises);
    progressBar.stop();
    
    console.log(`✅ Found ${seasonGames} games in ${range.season}`);
  }
  
  console.log(`\n📊 Total games found: ${allGames.length}`);
  
  // Remove duplicates
  const uniqueGames = new Map();
  allGames.forEach(game => {
    uniqueGames.set(game.external_id, game);
  });
  
  const gamesToProcess = Array.from(uniqueGames.values());
  console.log(`✅ Unique games after deduplication: ${gamesToProcess.length}`);
  
  // Map team names to IDs
  const validGames = gamesToProcess.filter(game => {
    const homeId = teamLookup.get(game.home_team_name);
    const awayId = teamLookup.get(game.away_team_name);
    
    if (!homeId || !awayId) {
      // Skip All-Star games and international games
      return false;
    }
    
    game.home_team_id = homeId;
    game.away_team_id = awayId;
    delete game.home_team_name;
    delete game.away_team_name;
    return true;
  });
  
  console.log(`✅ ${validGames.length} games with valid team mappings`);
  
  // Filter out existing games
  const newGamesToInsert = validGames.filter(g => !existingSet.has(g.external_id));
  
  console.log(`🆕 New games to add: ${newGamesToInsert.length}`);
  
  // Insert new games
  if (newGamesToInsert.length > 0) {
    console.log('\n💾 Inserting new games...');
    
    for (let i = 0; i < newGamesToInsert.length; i += CONFIG.BATCH_SIZE) {
      const batch = newGamesToInsert.slice(i, i + CONFIG.BATCH_SIZE);
      
      const { data, error } = await supabase
        .from('games')
        .insert(batch)
        .select();
        
      if (error) {
        console.error('Insert error:', error.message);
      } else if (data) {
        newGames += data.length;
      }
      
      process.stdout.write(`\r💾 Inserted ${newGames} / ${newGamesToInsert.length} games`);
    }
  }
  
  // Summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n✅ NHL GAME COLLECTION COMPLETE!\n');
  console.log(`⏱️  Time: ${(elapsedTime / 60).toFixed(1)} minutes`);
  console.log(`🎮 Total games found: ${gamesToProcess.length}`);
  console.log(`🆕 New games added: ${newGames}`);
  console.log(`📊 Already existed: ${gamesToProcess.length - newGamesToInsert.length}`);
  
  // Final count
  const { count } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .or('sport_id.eq.nhl,sport_id.eq.NHL');
    
  console.log(`\n📈 Total NHL games in database: ${count?.toLocaleString()}`);
  
  if (count && count >= 1800) {
    console.log('\n🎯 SUCCESS! Collected expected number of NHL games!');
  }
}

// Run
async function main() {
  try {
    require('p-limit');
    require('cli-progress');
  } catch {
    console.log('📦 Installing required packages...');
    const { execSync } = require('child_process');
    execSync('npm install p-limit cli-progress', { stdio: 'inherit' });
  }
  
  await collectAllNHLGames();
}

main().catch(console.error);