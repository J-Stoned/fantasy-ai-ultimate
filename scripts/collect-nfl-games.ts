#!/usr/bin/env tsx
/**
 * 🏈 NFL GAMES COLLECTOR - 2023 & 2024 Seasons
 * Phase 1A: Collect ~550 NFL games
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

console.log(chalk.bold.green('🏈 NFL GAMES COLLECTOR\n'));

// Configuration
const CONFIG = {
  CONCURRENT_REQUESTS: 10,  // ESPN can handle this
  API_DELAY: 500,          // 500ms between requests
};

// NFL Seasons
const SEASONS = [
  { 
    year: 2023,
    startDate: '2023-09-07',
    endDate: '2024-02-11',  // Super Bowl LVIII
    weeks: 18,
    postseason: true
  },
  {
    year: 2024,
    startDate: '2024-09-05',
    endDate: '2025-02-09',  // Super Bowl LIX
    weeks: 18,
    postseason: true
  }
];

// Tracking
let totalGames = 0;
let newGames = 0;

async function getNFLTeams() {
  console.log('🏟️  Loading NFL teams...');
  
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .or('sport_id.eq.nfl,sport_id.eq.NFL');
  
  if (!teams || teams.length === 0) {
    console.log('❌ No NFL teams found! Need to collect teams first.');
    return null;
  }
  
  console.log(`✅ Loaded ${teams.length} NFL teams\n`);
  return teams;
}

async function fetchGamesForWeek(year: number, seasonType: number, week: number) {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${year}&seasontype=${seasonType}&week=${week}`;
    
    const response = await axios.get(url, { timeout: 10000 });
    
    if (!response.data.events) {
      return [];
    }
    
    return response.data.events.map((event: any) => {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
      const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
      
      return {
        external_id: `espn_nfl_${event.id}`,
        sport_id: 'nfl',
        home_team_name: homeTeam.team.displayName,
        away_team_name: awayTeam.team.displayName,
        home_score: competition.status.type.completed ? parseInt(homeTeam.score) : null,
        away_score: competition.status.type.completed ? parseInt(awayTeam.score) : null,
        start_time: event.date,
        status: competition.status.type.completed ? 'completed' : 'scheduled',
        venue: competition.venue?.fullName || null,
        metadata: {
          season: year,
          week: week,
          seasonType: seasonType,
          attendance: competition.attendance || null
        }
      };
    });
    
  } catch (error: any) {
    console.log(`❌ Error fetching ${year} week ${week}:`, error.message);
    return [];
  }
}

async function collectNFLGames() {
  const startTime = Date.now();
  
  // Get teams first
  const teams = await getNFLTeams();
  if (!teams) return;
  
  // Create team lookup
  const teamLookup = new Map();
  teams.forEach(team => {
    teamLookup.set(team.name, team.id);
  });
  
  console.log('📊 Collecting NFL games from ESPN API...\n');
  
  const allGames: any[] = [];
  const limit = pLimit(CONFIG.CONCURRENT_REQUESTS);
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: '🏈 Progress |{bar}| {percentage}% | {value}/{total} Weeks | {games} Games',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  let totalWeeks = 0;
  for (const season of SEASONS) {
    totalWeeks += season.weeks + (season.postseason ? 5 : 0); // Regular + playoffs
  }
  
  progressBar.start(totalWeeks, 0, { games: 0 });
  
  let processedWeeks = 0;
  
  // Collect games for each season
  for (const season of SEASONS) {
    // Regular season (seasonType = 2)
    const regularWeekPromises = Array.from({ length: season.weeks }, (_, i) => i + 1).map(week =>
      limit(async () => {
        const games = await fetchGamesForWeek(season.year, 2, week);
        allGames.push(...games);
        processedWeeks++;
        progressBar.update(processedWeeks, { games: allGames.length });
        await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
      })
    );
    
    await Promise.all(regularWeekPromises);
    
    // Postseason (seasonType = 3)
    if (season.postseason) {
      const postseasonWeekPromises = Array.from({ length: 5 }, (_, i) => i + 1).map(week =>
        limit(async () => {
          const games = await fetchGamesForWeek(season.year, 3, week);
          allGames.push(...games);
          processedWeeks++;
          progressBar.update(processedWeeks, { games: allGames.length });
          await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
        })
      );
      
      await Promise.all(postseasonWeekPromises);
    }
  }
  
  progressBar.stop();
  
  console.log(`\n📊 Found ${allGames.length} total NFL games`);
  
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
  
  console.log('\n\n✅ NFL GAME COLLECTION COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Total games found: ${allGames.length}`);
  console.log(`🆕 New games added: ${newGames}`);
  console.log(`📊 Already existed: ${allGames.length - newGames}`);
  
  // Check total NFL games
  const { count } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .or('sport_id.eq.nfl,sport_id.eq.NFL');
    
  console.log(`\n📈 Total NFL games in database: ${count}`);
  
  if (newGames > 0) {
    console.log('\n🎯 Next: Collect NHL games, then move to Phase 2!');
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
  
  await collectNFLGames();
}

main().catch(console.error);