#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1',
  timeout: 10000
});

console.log('⚾ MLB 2024 SEASON GAME COLLECTOR');
console.log('📅 Collecting REAL games from 2024 season\n');

const CONFIG = {
  START_DATE: '2024-03-20', // MLB 2024 season start
  END_DATE: '2024-10-31',   // Including playoffs
  CONCURRENT_CALLS: 10,
  BATCH_SIZE: 100
};

// Tracking
let totalGames = 0;
let newGames = 0;
let existingGames = 0;

// MLB team mappings
const MLB_TEAMS: Record<number, { name: string, abbreviation: string }> = {
  108: { name: 'Los Angeles Angels', abbreviation: 'LAA' },
  109: { name: 'Arizona Diamondbacks', abbreviation: 'ARI' },
  110: { name: 'Baltimore Orioles', abbreviation: 'BAL' },
  111: { name: 'Boston Red Sox', abbreviation: 'BOS' },
  112: { name: 'Chicago Cubs', abbreviation: 'CHC' },
  113: { name: 'Cincinnati Reds', abbreviation: 'CIN' },
  114: { name: 'Cleveland Guardians', abbreviation: 'CLE' },
  115: { name: 'Colorado Rockies', abbreviation: 'COL' },
  116: { name: 'Detroit Tigers', abbreviation: 'DET' },
  117: { name: 'Houston Astros', abbreviation: 'HOU' },
  118: { name: 'Kansas City Royals', abbreviation: 'KC' },
  119: { name: 'Los Angeles Dodgers', abbreviation: 'LAD' },
  120: { name: 'Washington Nationals', abbreviation: 'WSH' },
  121: { name: 'New York Mets', abbreviation: 'NYM' },
  133: { name: 'Oakland Athletics', abbreviation: 'OAK' },
  134: { name: 'Pittsburgh Pirates', abbreviation: 'PIT' },
  135: { name: 'San Diego Padres', abbreviation: 'SD' },
  136: { name: 'Seattle Mariners', abbreviation: 'SEA' },
  137: { name: 'San Francisco Giants', abbreviation: 'SF' },
  138: { name: 'St. Louis Cardinals', abbreviation: 'STL' },
  139: { name: 'Tampa Bay Rays', abbreviation: 'TB' },
  140: { name: 'Texas Rangers', abbreviation: 'TEX' },
  141: { name: 'Toronto Blue Jays', abbreviation: 'TOR' },
  142: { name: 'Minnesota Twins', abbreviation: 'MIN' },
  143: { name: 'Philadelphia Phillies', abbreviation: 'PHI' },
  144: { name: 'Atlanta Braves', abbreviation: 'ATL' },
  145: { name: 'Chicago White Sox', abbreviation: 'CWS' },
  146: { name: 'Miami Marlins', abbreviation: 'MIA' },
  147: { name: 'New York Yankees', abbreviation: 'NYY' },
  158: { name: 'Milwaukee Brewers', abbreviation: 'MIL' }
};

async function ensureTeamsExist() {
  console.log('🏟️  Ensuring all MLB teams exist in database...');
  
  const teamsToInsert = Object.entries(MLB_TEAMS).map(([id, team]) => ({
    id: parseInt(id),
    name: team.name,
    abbreviation: team.abbreviation,
    sport: 'MLB',
    external_id: `mlb_${id}`
  }));
  
  const { error } = await supabase
    .from('teams')
    .upsert(teamsToInsert, { onConflict: 'id' });
    
  if (error) {
    console.error('Error inserting teams:', error.message);
  } else {
    console.log(`✅ ${teamsToInsert.length} MLB teams ready\n`);
  }
}

async function fetchGamesForDate(date: string) {
  try {
    const response = await mlbApi.get('/schedule', {
      params: {
        sportId: 1, // MLB
        startDate: date,
        endDate: date,
        gameType: 'R,F,D,L,W' // Regular season, playoffs, etc.
      }
    });
    
    const games: any[] = [];
    
    response.data.dates?.forEach((dateData: any) => {
      dateData.games?.forEach((game: any) => {
        if (game.status.codedGameState === 'F') { // Final games only
          games.push({
            external_id: `mlb_${game.gamePk}`,
            sport: 'MLB',
            start_time: game.gameDate,
            status: 'final',
            home_team_id: game.teams.home.team.id,
            away_team_id: game.teams.away.team.id,
            home_score: game.teams.home.score || 0,
            away_score: game.teams.away.score || 0,
            venue: game.venue?.name || 'Unknown',
            metadata: {
              game_type: game.gameType,
              game_number: game.gameNumber,
              double_header: game.doubleHeader !== 'N',
              season: game.season,
              series_description: game.seriesDescription
            }
          });
        }
      });
    });
    
    return games;
  } catch (error: any) {
    console.error(`Error fetching games for ${date}:`, error.message);
    return [];
  }
}

async function collectMLBGames() {
  const startTime = Date.now();
  
  // Ensure teams exist first
  await ensureTeamsExist();
  
  // Generate all dates in range
  const dates: string[] = [];
  const currentDate = new Date(CONFIG.START_DATE);
  const endDate = new Date(CONFIG.END_DATE);
  
  while (currentDate <= endDate) {
    dates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log(`📅 Collecting games from ${dates.length} days (${CONFIG.START_DATE} to ${CONFIG.END_DATE})\n`);
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: '⚾ Progress |{bar}| {percentage}% | {value}/{total} Days | {games} Games',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  progressBar.start(dates.length, 0, { games: 0 });
  
  // Process dates with concurrency limit
  const limit = pLimit(CONFIG.CONCURRENT_CALLS);
  const allGames: any[] = [];
  
  const promises = dates.map((date, index) => 
    limit(async () => {
      const games = await fetchGamesForDate(date);
      allGames.push(...games);
      progressBar.update(index + 1, { games: allGames.length });
      
      // Small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 100));
    })
  );
  
  await Promise.all(promises);
  progressBar.stop();
  
  console.log(`\n📊 Found ${allGames.length} games total`);
  
  // Check existing games
  const externalIds = allGames.map(g => g.external_id);
  const { data: existing } = await supabase
    .from('games')
    .select('external_id')
    .in('external_id', externalIds);
    
  const existingSet = new Set(existing?.map(g => g.external_id) || []);
  const newGamesToInsert = allGames.filter(g => !existingSet.has(g.external_id));
  
  console.log(`✅ Already have: ${existing?.length || 0} games`);
  console.log(`🆕 New games to add: ${newGamesToInsert.length}`);
  
  // Insert new games in batches
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
      
      // Progress
      process.stdout.write(`\r💾 Inserted ${newGames} / ${newGamesToInsert.length} games`);
    }
  }
  
  // Summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n✅ MLB 2024 GAME COLLECTION COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Total games found: ${allGames.length}`);
  console.log(`🆕 New games added: ${newGames}`);
  console.log(`📊 Already existed: ${allGames.length - newGames}`);
  
  // Check total MLB games
  const { count } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB')
    .eq('status', 'final');
    
  console.log(`\n📈 Total MLB games in database: ${count}`);
  
  if (newGames > 0) {
    console.log('\n🎯 Next step: Run mlb-real-data-collector.ts to get stats for these games!');
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
  
  await collectMLBGames();
}

main().catch(console.error);