#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as os from 'os';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

// REAL DATA COLLECTION - FIXED VERSION
const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1',
  timeout: 30000
});

const CPU_CORES = os.cpus().length;

console.log(`⚾ REAL MLB DATA COLLECTOR - FIXED VERSION`);
console.log(`📊 Actually saving data this time!`);
console.log(`🖥️  ${CPU_CORES} cores ready\n`);

// Configuration
const CONFIG = {
  CONCURRENT_API_CALLS: 8, // Reduced for stability
  DB_INSERT_BATCH: 500, // Smaller batches for reliability
  GAMES_PER_BATCH: 20,
  API_DELAY_MS: 200,
};

// Tracking
let totalGamesProcessed = 0;
let totalStatsInserted = 0;
let totalPlayersCreated = 0;
let failedGames = 0;

// Progress
const multibar = new cliProgress.MultiBar({
  clearOnComplete: false,
  hideCursor: true,
  format: '{bar} | {name} | {value}/{total} | {percentage}%'
}, cliProgress.Presets.shades_classic);

async function processGame(gameId: number, gamePk: number): Promise<boolean> {
  try {
    const response = await mlbApi.get(`/game/${gamePk}/boxscore`);
    const boxscore = response.data;
    
    if (!boxscore.teams) return false;
    
    const playersToInsert: any[] = [];
    const statsToInsert: any[] = [];
    
    // Process both teams
    ['home', 'away'].forEach(teamType => {
      const team = boxscore.teams[teamType];
      if (!team?.players) return;
      
      const teamName = team.team?.name || teamType;
      
      Object.values(team.players).forEach((player: any) => {
        const mlbPlayerId = `mlb_${player.person.id}`;
        
        // Player info
        playersToInsert.push({
          mlb_player_id: mlbPlayerId,
          player_name: player.person.fullName,
          position: player.position?.abbreviation,
          jersey_number: parseInt(player.jerseyNumber) || null,
          current_team: teamName,
          bat_side: player.batSide?.code,
          pitch_hand: player.pitchHand?.code
        });
        
        // Batting stats
        if (player.stats?.batting && player.stats.batting.atBats >= 0) {
          const b = player.stats.batting;
          
          // Only add non-zero stats
          if (b.atBats > 0) statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'at_bats', stat_value: b.atBats, fantasy_points: 0 });
          if (b.hits > 0) statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'hits', stat_value: b.hits, fantasy_points: b.hits * 3 });
          if (b.doubles > 0) statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'doubles', stat_value: b.doubles, fantasy_points: b.doubles * 2 });
          if (b.triples > 0) statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'triples', stat_value: b.triples, fantasy_points: b.triples * 3 });
          if (b.homeRuns > 0) statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'home_runs', stat_value: b.homeRuns, fantasy_points: b.homeRuns * 10 });
          if (b.rbi > 0) statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'rbi', stat_value: b.rbi, fantasy_points: b.rbi * 2 });
          if (b.runs > 0) statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'runs', stat_value: b.runs, fantasy_points: b.runs * 2 });
          if (b.baseOnBalls > 0) statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'walks', stat_value: b.baseOnBalls, fantasy_points: b.baseOnBalls });
          if (b.strikeOuts > 0) statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'strikeouts', stat_value: b.strikeOuts, fantasy_points: -b.strikeOuts });
          if (b.stolenBases > 0) statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'stolen_bases', stat_value: b.stolenBases, fantasy_points: b.stolenBases * 5 });
        }
        
        // Pitching stats
        if (player.stats?.pitching && parseFloat(player.stats.pitching.inningsPitched || '0') > 0) {
          const p = player.stats.pitching;
          const ip = parseFloat(p.inningsPitched || '0');
          
          statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'innings_pitched', stat_value: ip, fantasy_points: ip * 3 });
          if (p.strikeOuts > 0) statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'strikeouts_p', stat_value: p.strikeOuts, fantasy_points: p.strikeOuts * 2 });
          if (p.earnedRuns > 0) statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'earned_runs', stat_value: p.earnedRuns, fantasy_points: -p.earnedRuns * 2 });
          if (p.hits > 0) statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'hits_allowed', stat_value: p.hits, fantasy_points: -p.hits * 0.5 });
          if (p.baseOnBalls > 0) statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'walks_allowed', stat_value: p.baseOnBalls, fantasy_points: -p.baseOnBalls });
          if (p.wins > 0) statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'wins', stat_value: 1, fantasy_points: 10 });
          if (p.saves > 0) statsToInsert.push({ mlb_player_id: mlbPlayerId, game_id: gameId, stat_type: 'saves', stat_value: 1, fantasy_points: 10 });
        }
      });
    });
    
    // Insert players (upsert to handle duplicates)
    if (playersToInsert.length > 0) {
      const { error: playerError } = await supabase
        .from('mlb_players')
        .upsert(playersToInsert, { onConflict: 'mlb_player_id' });
        
      if (!playerError) {
        totalPlayersCreated += playersToInsert.length;
      }
    }
    
    // Insert stats in batches
    if (statsToInsert.length > 0) {
      for (let i = 0; i < statsToInsert.length; i += CONFIG.DB_INSERT_BATCH) {
        const batch = statsToInsert.slice(i, i + CONFIG.DB_INSERT_BATCH);
        
        const { error: statsError, data } = await supabase
          .from('mlb_stats')
          .insert(batch)
          .select();
          
        if (!statsError && data) {
          totalStatsInserted += data.length;
        } else if (statsError) {
          console.error(`\nStats insert error for game ${gameId}:`, statsError.message);
        }
      }
    }
    
    return statsToInsert.length > 0;
    
  } catch (error: any) {
    if (error.response?.status !== 404) {
      console.error(`\nError processing game ${gamePk}:`, error.message);
    }
    return false;
  }
}

async function collectMLBData() {
  const startTime = Date.now();
  
  console.log('🔍 Getting MLB games from database...\n');
  
  // Get games that need stats
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id')
    .eq('sport', 'MLB')
    .eq('status', 'final')
    .order('start_time', { ascending: false })
    .limit(100); // Process 100 games for testing
    
  if (!games || games.length === 0) {
    console.log('No MLB games found!');
    return;
  }
  
  // Check already processed
  const { data: processed } = await supabase
    .from('mlb_stats')
    .select('game_id')
    .limit(10000);
    
  const processedSet = new Set(processed?.map(p => p.game_id) || []);
  const gamesToProcess = games.filter(g => !processedSet.has(g.id));
  
  console.log(`📊 Found ${games.length} MLB games`);
  console.log(`✅ Already processed: ${games.length - gamesToProcess.length}`);
  console.log(`🎯 Will process: ${gamesToProcess.length}\n`);
  
  if (gamesToProcess.length === 0) {
    console.log('All games already processed!');
    return;
  }
  
  // Progress bars
  const gamesBar = multibar.create(gamesToProcess.length, 0, { name: 'Games' });
  const statsBar = multibar.create(gamesToProcess.length * 200, 0, { name: 'Stats' });
  
  // Process in batches
  const limit = pLimit(CONFIG.CONCURRENT_API_CALLS);
  
  for (let i = 0; i < gamesToProcess.length; i += CONFIG.GAMES_PER_BATCH) {
    const batch = gamesToProcess.slice(i, i + CONFIG.GAMES_PER_BATCH);
    
    const promises = batch.map(game => 
      limit(async () => {
        const gamePk = parseInt(game.external_id.replace('mlb_', ''));
        const success = await processGame(game.id, gamePk);
        
        if (success) {
          totalGamesProcessed++;
          gamesBar.increment();
        } else {
          failedGames++;
        }
        
        // Update stats bar with current total
        statsBar.update(totalStatsInserted);
        
        // Delay
        await new Promise(r => setTimeout(r, CONFIG.API_DELAY_MS));
      })
    );
    
    await Promise.all(promises);
    
    // Log progress
    if ((i + CONFIG.GAMES_PER_BATCH) % 100 === 0) {
      console.log(`\n📊 Progress: ${totalGamesProcessed} games, ${totalStatsInserted} stats saved`);
    }
  }
  
  multibar.stop();
  
  // Summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n✅ MLB DATA COLLECTION COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Games processed: ${totalGamesProcessed}`);
  console.log(`❌ Failed games: ${failedGames}`);
  console.log(`📊 Stats inserted: ${totalStatsInserted.toLocaleString()}`);
  console.log(`👥 Players: ${totalPlayersCreated}`);
  console.log(`⚡ Rate: ${(totalStatsInserted / elapsedTime).toFixed(0)} stats/second`);
  
  // Verify in database
  const { count: totalStats } = await supabase
    .from('mlb_stats')
    .select('*', { count: 'exact', head: true });
    
  const { count: totalPlayers } = await supabase
    .from('mlb_players')
    .select('*', { count: 'exact', head: true });
    
  console.log('\n📈 DATABASE TOTALS:');
  console.log(`👥 MLB Players: ${totalPlayers?.toLocaleString()}`);
  console.log(`📊 MLB Stats: ${totalStats?.toLocaleString()}`);
  
  if (totalStats && totalStats > 114139) {
    console.log('\n🎉 NEW REAL DATA SUCCESSFULLY ADDED!');
  }
}

// Run it
async function main() {
  try {
    require('p-limit');
    require('cli-progress');
  } catch {
    console.log('📦 Installing packages...');
    const { execSync } = require('child_process');
    execSync('npm install p-limit cli-progress', { stdio: 'inherit' });
  }
  
  await collectMLBData();
}

main().catch(console.error);