#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as os from 'os';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import { config, validateConfig } from './config';

// Validate configuration
validateConfig();

const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey
);

const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1',
  timeout: 15000
});

// System info
const CPU_CORES = os.cpus().length;
const MEMORY_GB = os.totalmem() / (1024 * 1024 * 1024);

console.log(`🚀 MEGA BATCH MLB STATS PROCESSOR`);
console.log(`🖥️  CPU: ${CPU_CORES} cores | RAM: ${MEMORY_GB.toFixed(1)}GB`);
console.log(`📊 Processing with 1000+ record batches!\n`);

// Configuration for MAXIMUM throughput
const CONFIG = {
  CONCURRENT_API_CALLS: Math.min(CPU_CORES * 3, 24), // 3x CPU cores
  GAMES_PER_BATCH: 200, // Process 200 games at once
  DB_INSERT_BATCH: 1000, // Insert 1000 records per Supabase call as requested
  PLAYER_BATCH: 500, // Insert 500 players per batch
  API_DELAY_MS: 25, // Minimal API delay
  DB_DELAY_MS: 50, // Minimal DB delay
};

// Global buffers
const playerCache = new Map<string, any>();
const statsBuffer: any[] = [];
const playersBuffer: any[] = [];

// Tracking
let totalGamesProcessed = 0;
let totalStatsCollected = 0;
let totalStatsInserted = 0;
let totalPlayersCreated = 0;

// Progress bars
const multibar = new cliProgress.MultiBar({
  clearOnComplete: false,
  hideCursor: true,
  format: '{bar} | {name} | {value}/{total} | {percentage}% | {rate}/s | ETA: {eta}s'
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

async function fetchGameStats(gameId: number, gamePk: number): Promise<number> {
  try {
    const response = await mlbApi.get(`/game/${gamePk}/boxscore`);
    let statsCount = 0;
    
    const processTeamPlayers = (teamPlayers: any, teamName: string) => {
      Object.values(teamPlayers || {}).forEach((player: any) => {
        const mlbPlayerId = `mlb_${player.person.id}`;
        
        // Cache full player data
        if (!playerCache.has(mlbPlayerId)) {
          const playerData = {
            mlb_player_id: mlbPlayerId,
            player_name: player.person.fullName,
            position: player.position?.abbreviation,
            jersey_number: parseInt(player.jerseyNumber) || null,
            current_team: teamName,
            bat_side: player.batSide?.code,
            pitch_hand: player.pitchHand?.code,
            metadata: { mlb_id: player.person.id }
          };
          playerCache.set(mlbPlayerId, playerData);
          playersBuffer.push(playerData);
        }
        
        // Collect ALL batting stats
        if (player.stats?.batting) {
          const batting = player.stats.batting;
          
          // Always record at bats (even if 0)
          statsBuffer.push({
            mlb_player_id: mlbPlayerId,
            game_id: gameId,
            stat_type: 'at_bats',
            stat_value: batting.atBats || 0,
            fantasy_points: 0
          });
          statsCount++;
          
          // Record all hitting stats
          const hittingStats = [
            { type: 'hits', value: batting.hits, points: batting.hits * 3 },
            { type: 'doubles', value: batting.doubles, points: batting.doubles * 2 },
            { type: 'triples', value: batting.triples, points: batting.triples * 3 },
            { type: 'home_runs', value: batting.homeRuns, points: batting.homeRuns * 10 },
            { type: 'rbi', value: batting.rbi, points: batting.rbi * 2 },
            { type: 'runs', value: batting.runs, points: batting.runs * 2 },
            { type: 'walks', value: batting.baseOnBalls, points: batting.baseOnBalls * 1 },
            { type: 'strikeouts', value: batting.strikeOuts, points: -batting.strikeOuts * 1 },
            { type: 'stolen_bases', value: batting.stolenBases, points: batting.stolenBases * 5 },
            { type: 'caught_stealing', value: batting.caughtStealing, points: -batting.caughtStealing * 2 }
          ];
          
          hittingStats.forEach(stat => {
            if (stat.value > 0) {
              statsBuffer.push({
                mlb_player_id: mlbPlayerId,
                game_id: gameId,
                stat_type: stat.type,
                stat_value: stat.value,
                fantasy_points: stat.points || 0
              });
              statsCount++;
            }
          });
          
          // Always add total fantasy points
          const totalFantasy = calculateBattingFantasyPoints(batting);
          statsBuffer.push({
            mlb_player_id: mlbPlayerId,
            game_id: gameId,
            stat_type: 'batting_fantasy_total',
            stat_value: totalFantasy,
            fantasy_points: totalFantasy
          });
          statsCount++;
        }
        
        // Collect ALL pitching stats
        if (player.stats?.pitching && parseFloat(player.stats.pitching.inningsPitched || '0') > 0) {
          const pitching = player.stats.pitching;
          
          // All pitching stats
          const pitchingStats = [
            { type: 'innings_pitched', value: parseFloat(pitching.inningsPitched || '0'), points: parseFloat(pitching.inningsPitched || '0') * 3 },
            { type: 'strikeouts_p', value: pitching.strikeOuts, points: pitching.strikeOuts * 2 },
            { type: 'earned_runs', value: pitching.earnedRuns, points: -pitching.earnedRuns * 2 },
            { type: 'hits_allowed', value: pitching.hits, points: -pitching.hits * 0.5 },
            { type: 'walks_allowed', value: pitching.baseOnBalls, points: -pitching.baseOnBalls * 1 },
            { type: 'wins', value: pitching.wins || 0, points: pitching.wins * 10 },
            { type: 'losses', value: pitching.losses || 0, points: -pitching.losses * 5 },
            { type: 'saves', value: pitching.saves || 0, points: pitching.saves * 10 },
            { type: 'holds', value: pitching.holds || 0, points: pitching.holds * 5 },
            { type: 'blown_saves', value: pitching.blownSaves || 0, points: -pitching.blownSaves * 5 }
          ];
          
          pitchingStats.forEach(stat => {
            if (stat.value > 0 || stat.type === 'innings_pitched') {
              statsBuffer.push({
                mlb_player_id: mlbPlayerId,
                game_id: gameId,
                stat_type: stat.type,
                stat_value: stat.value,
                fantasy_points: stat.points || 0
              });
              statsCount++;
            }
          });
          
          // ERA for the game
          if (pitching.era) {
            statsBuffer.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'era',
              stat_value: parseFloat(pitching.era),
              fantasy_points: 0
            });
            statsCount++;
          }
          
          // Total pitching fantasy
          const totalPitchingFantasy = calculatePitchingFantasyPoints(pitching);
          statsBuffer.push({
            mlb_player_id: mlbPlayerId,
            game_id: gameId,
            stat_type: 'pitching_fantasy_total',
            stat_value: totalPitchingFantasy,
            fantasy_points: totalPitchingFantasy
          });
          statsCount++;
        }
      });
    };
    
    // Process both teams
    processTeamPlayers(response.data.teams?.home?.players, response.data.teams?.home?.team?.name || 'home');
    processTeamPlayers(response.data.teams?.away?.players, response.data.teams?.away?.team?.name || 'away');
    
    totalStatsCollected += statsCount;
    return statsCount;
    
  } catch (error: any) {
    return 0;
  }
}

async function flushBuffers(force: boolean = false) {
  // Flush players buffer
  if (playersBuffer.length >= CONFIG.PLAYER_BATCH || (force && playersBuffer.length > 0)) {
    const batches = [];
    while (playersBuffer.length > 0) {
      batches.push(playersBuffer.splice(0, CONFIG.PLAYER_BATCH));
    }
    
    for (const batch of batches) {
      const { error } = await supabase
        .from('mlb_players')
        .upsert(batch, { 
          onConflict: 'mlb_player_id',
          ignoreDuplicates: false 
        });
        
      if (!error || error.message.includes('duplicate')) {
        totalPlayersCreated += batch.length;
      }
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.DB_DELAY_MS));
    }
  }
  
  // Flush stats buffer - MEGA BATCHES!
  if (statsBuffer.length >= CONFIG.DB_INSERT_BATCH || (force && statsBuffer.length > 0)) {
    const batches = [];
    while (statsBuffer.length > 0) {
      batches.push(statsBuffer.splice(0, CONFIG.DB_INSERT_BATCH));
    }
    
    console.log(`\n💾 Flushing ${batches.length} mega batches (${batches.reduce((sum, b) => sum + b.length, 0)} total stats)...`);
    
    for (const batch of batches) {
      const { error, data } = await supabase
        .from('mlb_stats')
        .insert(batch)
        .select();
        
      if (!error) {
        totalStatsInserted += batch.length;
      } else if (!error.message.includes('duplicate')) {
        console.error(`Warning: Batch insert error - ${error.message}`);
        // Try smaller chunks if mega batch fails
        const smallerBatches = [];
        while (batch.length > 0) {
          smallerBatches.push(batch.splice(0, 100));
        }
        for (const smallBatch of smallerBatches) {
          const { error: smallError } = await supabase
            .from('mlb_stats')
            .insert(smallBatch);
          if (!smallError) {
            totalStatsInserted += smallBatch.length;
          }
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.DB_DELAY_MS));
    }
  }
}

async function processGames() {
  const startTime = Date.now();
  
  console.log('🏃 Fetching MLB games from database...\n');
  
  // Get all MLB games
  const { data: allGames, count } = await supabase
    .from('games')
    .select('id, external_id', { count: 'exact' })
    .eq('sport', 'MLB')
    .eq('status', 'final')
    .order('start_time', { ascending: false });
    
  if (!allGames || allGames.length === 0) {
    console.log('No MLB games found');
    return;
  }
  
  // Check already processed
  const { data: processedStats } = await supabase
    .from('mlb_stats')
    .select('game_id')
    .limit(50000);
    
  const processedSet = new Set(processedStats?.map(s => s.game_id) || []);
  const gamesToProcess = allGames.filter(g => !processedSet.has(g.id));
  
  console.log(`📊 Total MLB games: ${allGames.length}`);
  console.log(`✅ Already processed: ${allGames.length - gamesToProcess.length}`);
  console.log(`🎯 Games to process: ${gamesToProcess.length}\n`);
  
  if (gamesToProcess.length === 0) {
    console.log('All games already processed!');
    return;
  }
  
  // Create progress bars
  const gamesBar = multibar.create(gamesToProcess.length, 0, { name: 'Games' });
  const statsBar = multibar.create(gamesToProcess.length * 100, 0, { name: 'Stats' }); // Estimate 100 stats per game
  
  // Process games with maximum concurrency
  const limit = pLimit(CONFIG.CONCURRENT_API_CALLS);
  
  for (let i = 0; i < gamesToProcess.length; i += CONFIG.GAMES_PER_BATCH) {
    const batch = gamesToProcess.slice(i, i + CONFIG.GAMES_PER_BATCH);
    
    const promises = batch.map(game => 
      limit(async () => {
        const gamePk = parseInt(game.external_id.replace('mlb_', ''));
        const stats = await fetchGameStats(game.id, gamePk);
        if (stats > 0) {
          totalGamesProcessed++;
          gamesBar.increment();
          statsBar.increment(stats);
        }
      })
    );
    
    await Promise.all(promises);
    
    // Flush buffers periodically
    await flushBuffers(false);
    
    // Small delay between mega batches
    if (i + CONFIG.GAMES_PER_BATCH < gamesToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY_MS));
    }
  }
  
  // Final flush with force
  console.log('\n🏁 Final flush of remaining data...');
  await flushBuffers(true);
  
  multibar.stop();
  
  // Performance summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n✅ MEGA BATCH PROCESSING COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Games processed: ${totalGamesProcessed}`);
  console.log(`📊 Stats collected: ${totalStatsCollected}`);
  console.log(`💾 Stats inserted: ${totalStatsInserted}`);
  console.log(`👥 Players created: ${totalPlayersCreated}`);
  console.log(`🚀 Performance: ${(totalGamesProcessed / elapsedTime * 60).toFixed(0)} games/minute`);
  console.log(`📈 Stats rate: ${(totalStatsInserted / elapsedTime).toFixed(0)} stats/second`);
  
  // Final database counts
  const { count: playerCount } = await supabase
    .from('mlb_players')
    .select('*', { count: 'exact', head: true });
    
  const { count: statsCount } = await supabase
    .from('mlb_stats')
    .select('*', { count: 'exact', head: true });
    
  console.log('\n📈 Database Totals:');
  console.log(`👥 Total MLB Players: ${playerCount}`);
  console.log(`📊 Total MLB Stats: ${statsCount}`);
  
  if (totalStatsCollected > totalStatsInserted) {
    console.log(`\n⚠️  Note: ${totalStatsCollected - totalStatsInserted} stats may be duplicates or failed inserts`);
  }
}

// Check dependencies
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
  await processGames();
}

main().catch(console.error);