#!/usr/bin/env tsx
/**
 * 🏒 NHL GAMES COLLECTOR - 2023-24 & 2024-25 Seasons
 * Phase 1B: Collect ~2,500 NHL games
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

console.log(chalk.bold.cyan('🏒 NHL GAMES COLLECTOR\n'));

// Configuration
const CONFIG = {
  CONCURRENT_REQUESTS: 10,  // ESPN can handle this
  API_DELAY: 500,          // 500ms between requests
};

// NHL Seasons
const SEASONS = [
  { 
    year: 2023,
    name: '2023-24',
    startDate: '2023-10-10',
    endDate: '2024-06-24',  // Stanley Cup Finals
    regularSeasonGames: 1312,
    playoffGames: 100  // Approximate
  },
  {
    year: 2024,
    name: '2024-25',
    startDate: '2024-10-08',
    endDate: '2025-07-14',  // Current date as end (season in progress)
    regularSeasonGames: 1312,  // Full season
    playoffGames: 0  // Not started yet
  }
];

// Tracking
let totalGames = 0;
let newGames = 0;

async function getNHLTeams() {
  console.log('🏟️  Loading NHL teams...');
  
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .or('sport_id.eq.nhl,sport_id.eq.NHL');
  
  if (!teams || teams.length === 0) {
    console.log('❌ No NHL teams found! Need to collect teams first.');
    return null;
  }
  
  console.log(`✅ Loaded ${teams.length} NHL teams\n`);
  return teams;
}

async function fetchGamesForDateRange(startDate: string, endDate: string) {
  try {
    // ESPN NHL API uses date ranges
    const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=${startDate.replace(/-/g, '')}-${endDate.replace(/-/g, '')}`;
    
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
          attendance: competition.attendance || null
        }
      };
    });
    
  } catch (error: any) {
    console.log(`❌ Error fetching games:`, error.message);
    return [];
  }
}

async function collectNHLGames() {
  const startTime = Date.now();
  
  // Get teams first
  const teams = await getNHLTeams();
  if (!teams) {
    console.log('\n⚠️  Need to collect NHL teams first!');
    console.log('Creating NHL teams collector...');
    return;
  }
  
  // Create team lookup
  const teamLookup = new Map();
  teams.forEach(team => {
    teamLookup.set(team.name, team.id);
  });
  
  console.log('📊 Collecting NHL games from ESPN API...\n');
  
  const allGames: any[] = [];
  const limit = pLimit(CONFIG.CONCURRENT_REQUESTS);
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: '🏒 Progress |{bar}| {percentage}% | {value}/{total} Batches | {games} Games',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  // Process in weekly batches for each season
  const batches: { start: Date, end: Date }[] = [];
  
  for (const season of SEASONS) {
    const seasonStart = new Date(season.startDate);
    const seasonEnd = new Date(season.endDate);
    
    let currentDate = new Date(seasonStart);
    while (currentDate < seasonEnd) {
      const batchEnd = new Date(currentDate);
      batchEnd.setDate(batchEnd.getDate() + 7); // 7-day batches
      
      if (batchEnd > seasonEnd) {
        batchEnd.setTime(seasonEnd.getTime());
      }
      
      batches.push({
        start: new Date(currentDate),
        end: new Date(batchEnd)
      });
      
      currentDate.setDate(currentDate.getDate() + 7);
    }
  }
  
  progressBar.start(batches.length, 0, { games: 0 });
  
  let processedBatches = 0;
  
  // Fetch games for each batch
  const batchPromises = batches.map((batch, index) =>
    limit(async () => {
      const startStr = batch.start.toISOString().split('T')[0];
      const endStr = batch.end.toISOString().split('T')[0];
      
      const games = await fetchGamesForDateRange(startStr, endStr);
      allGames.push(...games);
      
      processedBatches++;
      progressBar.update(processedBatches, { games: allGames.length });
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
    })
  );
  
  await Promise.all(batchPromises);
  progressBar.stop();
  
  console.log(`\n📊 Found ${allGames.length} total NHL games`);
  
  // Map team names to IDs and filter valid games
  const validGames = allGames.filter(game => {
    const homeId = teamLookup.get(game.home_team_name);
    const awayId = teamLookup.get(game.away_team_name);
    
    if (!homeId || !awayId) {
      console.log(`Missing team mapping: ${game.home_team_name} vs ${game.away_team_name}`);
      return false;
    }
    
    game.home_team_id = homeId;
    game.away_team_id = awayId;
    delete game.home_team_name;
    delete game.away_team_name;
    return true;
  });
  
  console.log(`✅ ${validGames.length} games with valid team mappings`);
  
  // Check existing games
  const externalIds = validGames.map(g => g.external_id);
  const { data: existing } = await supabase
    .from('games')
    .select('external_id')
    .in('external_id', externalIds);
    
  const existingSet = new Set(existing?.map(g => g.external_id) || []);
  const newGamesToInsert = validGames.filter(g => !existingSet.has(g.external_id));
  
  console.log(`✅ Already have: ${existing?.length || 0} games`);
  console.log(`🆕 New games to add: ${newGamesToInsert.length}`);
  
  // Insert new games in batches
  if (newGamesToInsert.length > 0) {
    console.log('\n💾 Inserting new games...');
    
    const batchSize = 100;
    for (let i = 0; i < newGamesToInsert.length; i += batchSize) {
      const batch = newGamesToInsert.slice(i, i + batchSize);
      
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
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Total games found: ${allGames.length}`);
  console.log(`🆕 New games added: ${newGames}`);
  console.log(`📊 Already existed: ${allGames.length - newGames}`);
  
  // Check total NHL games
  const { count } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .or('sport_id.eq.nhl,sport_id.eq.NHL');
    
  console.log(`\n📈 Total NHL games in database: ${count}`);
  
  if (newGames > 0) {
    console.log('\n🎯 Next: Move to Phase 2 - Complete player collections!');
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
  
  await collectNHLGames();
}

main().catch(console.error);