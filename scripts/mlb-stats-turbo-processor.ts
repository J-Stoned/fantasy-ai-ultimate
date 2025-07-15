#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as os from 'os';
import { Worker } from 'worker_threads';
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

// System info
const CPU_CORES = os.cpus().length;
const MEMORY_GB = os.totalmem() / (1024 * 1024 * 1024);

console.log(`💻 TURBO MLB STATS PROCESSOR`);
console.log(`🖥️  CPU: ${CPU_CORES} cores | RAM: ${MEMORY_GB.toFixed(1)}GB`);
console.log(`⚡ Running at MAXIMUM SPEED!\n`);

// Configuration for maximum performance
const CONFIG = {
  CONCURRENT_API_CALLS: Math.min(CPU_CORES * 2, 16), // 2x CPU cores, max 16
  BATCH_SIZE: 100, // Process 100 games per batch
  DB_BATCH_SIZE: 500, // Insert 500 records at once
  PLAYER_CACHE_SIZE: 10000,
  API_DELAY_MS: 50, // Minimal delay between API calls
};

// Global caches for performance
const playerCache = new Map<string, boolean>();
const statsQueue: any[] = [];
const playersQueue: any[] = [];

// Progress tracking
const multibar = new cliProgress.MultiBar({
  clearOnComplete: false,
  hideCursor: true,
  format: '{bar} | {name} | {value}/{total} | {percentage}% | ETA: {eta}s'
}, cliProgress.Presets.shades_classic);

// Helper functions
function calculateBattingFantasyPoints(stats: any): number {
  let points = 0;
  points += (stats.hits || 0) * 3;
  points += (stats.doubles || 0) * 2;
  points += (stats.triples || 0) * 3;
  points += (stats.homeRuns || 0) * 10;
  points += (stats.rbi || 0) * 2;
  points += (stats.runs || 0) * 2;
  points += (stats.baseOnBalls || 0) * 1;
  points += (stats.stolenBases || 0) * 5;
  points -= (stats.strikeOuts || 0) * 1;
  return points;
}

function calculatePitchingFantasyPoints(stats: any): number {
  let points = 0;
  const innings = parseFloat(stats.inningsPitched || '0');
  points += innings * 3;
  points += (stats.strikeOuts || 0) * 2;
  points += (stats.wins || 0) * 10;
  points += (stats.saves || 0) * 10;
  points -= (stats.earnedRuns || 0) * 2;
  points -= (stats.hits || 0) * 0.5;
  points -= (stats.baseOnBalls || 0) * 1;
  return points;
}

async function processGameBatch(games: any[]): Promise<number> {
  const limit = pLimit(CONFIG.CONCURRENT_API_CALLS);
  let totalStats = 0;
  
  const promises = games.map(game => 
    limit(async () => {
      try {
        const gamePk = parseInt(game.external_id.replace('mlb_', ''));
        const stats = await fetchGameStats(game.id, gamePk);
        totalStats += stats;
      } catch (error) {
        // Silently continue on error
      }
    })
  );
  
  await Promise.all(promises);
  return totalStats;
}

async function fetchGameStats(gameId: number, gamePk: number): Promise<number> {
  try {
    const response = await mlbApi.get(`/game/${gamePk}/boxscore`);
    let statsCount = 0;
    
    const processTeamPlayers = (teamPlayers: any, teamName: string) => {
      Object.values(teamPlayers || {}).forEach((player: any) => {
        const mlbPlayerId = `mlb_${player.person.id}`;
        
        // Add to player queue if not cached
        if (!playerCache.has(mlbPlayerId)) {
          playerCache.set(mlbPlayerId, true);
          playersQueue.push({
            mlb_player_id: mlbPlayerId,
            player_name: player.person.fullName,
            position: player.position?.abbreviation,
            jersey_number: parseInt(player.jerseyNumber) || null,
            current_team: teamName,
            bat_side: player.batSide?.code,
            pitch_hand: player.pitchHand?.code,
            metadata: { mlb_id: player.person.id }
          });
        }
        
        // Process batting stats
        if (player.stats?.batting) {
          const batting = player.stats.batting;
          
          if (batting.atBats > 0) {
            statsQueue.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'at_bats',
              stat_value: batting.atBats,
              fantasy_points: 0
            });
            statsCount++;
          }
          
          if (batting.hits > 0) {
            statsQueue.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'hits',
              stat_value: batting.hits,
              fantasy_points: batting.hits * 3
            });
            statsCount++;
          }
          
          if (batting.homeRuns > 0) {
            statsQueue.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'home_runs',
              stat_value: batting.homeRuns,
              fantasy_points: batting.homeRuns * 10
            });
            statsCount++;
          }
          
          if (batting.rbi > 0) {
            statsQueue.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'rbi',
              stat_value: batting.rbi,
              fantasy_points: batting.rbi * 2
            });
            statsCount++;
          }
          
          const totalFantasy = calculateBattingFantasyPoints(batting);
          if (totalFantasy > 0) {
            statsQueue.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'batting_fantasy_total',
              stat_value: totalFantasy,
              fantasy_points: totalFantasy
            });
            statsCount++;
          }
        }
        
        // Process pitching stats
        if (player.stats?.pitching && parseFloat(player.stats.pitching.inningsPitched || '0') > 0) {
          const pitching = player.stats.pitching;
          
          statsQueue.push({
            mlb_player_id: mlbPlayerId,
            game_id: gameId,
            stat_type: 'innings_pitched',
            stat_value: parseFloat(pitching.inningsPitched || '0'),
            fantasy_points: parseFloat(pitching.inningsPitched || '0') * 3
          });
          statsCount++;
          
          if (pitching.strikeOuts > 0) {
            statsQueue.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'strikeouts',
              stat_value: pitching.strikeOuts,
              fantasy_points: pitching.strikeOuts * 2
            });
            statsCount++;
          }
        }
      });
    };
    
    // Process both teams
    processTeamPlayers(response.data.teams?.home?.players, response.data.teams?.home?.team?.name || 'home');
    processTeamPlayers(response.data.teams?.away?.players, response.data.teams?.away?.team?.name || 'away');
    
    // Flush queues if they're getting large
    if (playersQueue.length >= CONFIG.DB_BATCH_SIZE) {
      await flushPlayerQueue();
    }
    if (statsQueue.length >= CONFIG.DB_BATCH_SIZE) {
      await flushStatsQueue();
    }
    
    return statsCount;
    
  } catch (error: any) {
    return 0;
  }
}

async function flushPlayerQueue() {
  if (playersQueue.length === 0) return;
  
  const batch = playersQueue.splice(0, CONFIG.DB_BATCH_SIZE);
  
  // Bulk upsert
  const { error } = await supabase
    .from('mlb_players')
    .upsert(batch, { 
      onConflict: 'mlb_player_id',
      ignoreDuplicates: false 
    });
    
  if (error && !error.message.includes('duplicate')) {
    console.error('Player insert error:', error.message);
  }
}

async function flushStatsQueue() {
  if (statsQueue.length === 0) return;
  
  const batch = statsQueue.splice(0, CONFIG.DB_BATCH_SIZE);
  
  // Bulk insert (no upsert for stats)
  const { error } = await supabase
    .from('mlb_stats')
    .insert(batch);
    
  if (error && !error.message.includes('duplicate')) {
    console.error('Stats insert error:', error.message);
  }
}

async function turboProcess() {
  const startTime = Date.now();
  
  console.log('🏃 Fetching all MLB games...\n');
  
  // Get ALL MLB games
  const { data: games, count } = await supabase
    .from('games')
    .select('id, external_id, start_time', { count: 'exact' })
    .eq('sport', 'MLB')
    .eq('status', 'final')
    .order('start_time', { ascending: false });
    
  if (!games || games.length === 0) {
    console.log('No MLB games found');
    return;
  }
  
  console.log(`📊 Found ${games.length} MLB games to process\n`);
  
  // Check what's already processed
  const { data: processedGames } = await supabase
    .from('mlb_stats')
    .select('game_id')
    .limit(10000);
    
  const processedSet = new Set(processedGames?.map(g => g.game_id) || []);
  const gamesToProcess = games.filter(g => !processedSet.has(g.id));
  
  console.log(`⏭️  Skipping ${games.length - gamesToProcess.length} already processed games`);
  console.log(`🎯 Processing ${gamesToProcess.length} new games\n`);
  
  if (gamesToProcess.length === 0) {
    console.log('✅ All games already processed!');
    return;
  }
  
  // Create progress bars
  const gamesBar = multibar.create(gamesToProcess.length, 0, { name: 'Games' });
  const statsBar = multibar.create(gamesToProcess.length * 50, 0, { name: 'Stats' }); // Estimate 50 stats per game
  
  // Process in batches
  let totalStats = 0;
  let processedGamesCount = 0;
  
  for (let i = 0; i < gamesToProcess.length; i += CONFIG.BATCH_SIZE) {
    const batch = gamesToProcess.slice(i, i + CONFIG.BATCH_SIZE);
    const batchStats = await processGameBatch(batch);
    
    totalStats += batchStats;
    processedGamesCount += batch.length;
    
    gamesBar.update(processedGamesCount);
    statsBar.update(totalStats);
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY_MS));
  }
  
  // Final flush
  console.log('\n\n💾 Flushing remaining data...');
  await flushPlayerQueue();
  await flushStatsQueue();
  
  multibar.stop();
  
  // Performance stats
  const elapsedTime = (Date.now() - startTime) / 1000;
  const gamesPerSecond = processedGamesCount / elapsedTime;
  const statsPerSecond = totalStats / elapsedTime;
  
  console.log('\n\n🏁 TURBO PROCESSING COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Games: ${processedGamesCount} (${gamesPerSecond.toFixed(1)}/sec)`);
  console.log(`📊 Stats: ${totalStats} (${statsPerSecond.toFixed(1)}/sec)`);
  console.log(`🚀 Performance: ${(processedGamesCount / elapsedTime * 60).toFixed(0)} games/minute`);
  
  // Final counts
  const { count: playerCount } = await supabase
    .from('mlb_players')
    .select('*', { count: 'exact', head: true });
    
  const { count: statsCount } = await supabase
    .from('mlb_stats')
    .select('*', { count: 'exact', head: true });
    
  console.log('\n📈 Database Totals:');
  console.log(`👥 MLB Players: ${playerCount}`);
  console.log(`📊 MLB Stats: ${statsCount}`);
  
  if (gamesToProcess.length > processedGamesCount) {
    console.log(`\n⚠️  Some games may have failed. Run again to retry.`);
  }
}

// Install required packages if needed
async function checkDependencies() {
  try {
    require('p-limit');
    require('cli-progress');
  } catch {
    console.log('📦 Installing required packages...');
    const { execSync } = require('child_process');
    execSync('npm install p-limit cli-progress', { stdio: 'inherit' });
  }
}

// Main execution
async function main() {
  await checkDependencies();
  await turboProcess();
}

main().catch(console.error);