#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as os from 'os';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

// REAL DATA COLLECTION - NO MORE FAKE STATS!
const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1',
  timeout: 15000
});

const CPU_CORES = os.cpus().length;

console.log(`⚾ REAL MLB DATA COLLECTOR - NO MORE LIES!`);
console.log(`📊 Fetching ACTUAL stats from MLB Stats API`);
console.log(`🖥️  ${CPU_CORES} cores ready for REAL data\n`);

// Configuration
const CONFIG = {
  CONCURRENT_API_CALLS: Math.min(CPU_CORES * 2, 16),
  DB_INSERT_BATCH: 1000,
  PLAYER_BATCH: 500,
  API_DELAY_MS: 100,
  START_DATE: '2024-03-01',
  END_DATE: '2024-10-31'
};

// Buffers
const statsBuffer: any[] = [];
const playersBuffer: any[] = [];
const playerCache = new Map<string, boolean>();

// Tracking
let totalGamesProcessed = 0;
let totalStatsCollected = 0;
let totalPlayersFound = 0;

// Progress
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

async function fetchAndProcessGame(gameId: number, gamePk: number): Promise<number> {
  try {
    // Get boxscore with full stats
    const response = await mlbApi.get(`/game/${gamePk}/boxscore`);
    const boxscore = response.data;
    
    if (!boxscore.teams) return 0;
    
    let statsCount = 0;
    
    // Process both teams
    const teams = ['home', 'away'];
    for (const teamType of teams) {
      const team = boxscore.teams[teamType];
      if (!team || !team.players) continue;
      
      const teamName = team.team?.name || teamType;
      
      // Process all players
      for (const [playerId, playerData] of Object.entries(team.players)) {
        const player = playerData as any;
        const mlbPlayerId = `mlb_${player.person.id}`;
        
        // Add player if new
        if (!playerCache.has(mlbPlayerId)) {
          playerCache.set(mlbPlayerId, true);
          playersBuffer.push({
            mlb_player_id: mlbPlayerId,
            player_name: player.person.fullName,
            position: player.position?.abbreviation,
            jersey_number: parseInt(player.jerseyNumber) || null,
            current_team: teamName,
            bat_side: player.batSide?.code,
            pitch_hand: player.pitchHand?.code,
            metadata: {
              mlb_id: player.person.id,
              status: player.status?.code
            }
          });
          totalPlayersFound++;
        }
        
        // BATTING STATS
        if (player.stats?.batting && Object.keys(player.stats.batting).length > 0) {
          const batting = player.stats.batting;
          
          // All batting stats
          const battingStats = [
            { type: 'at_bats', value: batting.atBats || 0, fantasy: 0 },
            { type: 'runs', value: batting.runs || 0, fantasy: (batting.runs || 0) * 2 },
            { type: 'hits', value: batting.hits || 0, fantasy: (batting.hits || 0) * 3 },
            { type: 'doubles', value: batting.doubles || 0, fantasy: (batting.doubles || 0) * 2 },
            { type: 'triples', value: batting.triples || 0, fantasy: (batting.triples || 0) * 3 },
            { type: 'home_runs', value: batting.homeRuns || 0, fantasy: (batting.homeRuns || 0) * 10 },
            { type: 'rbi', value: batting.rbi || 0, fantasy: (batting.rbi || 0) * 2 },
            { type: 'walks', value: batting.baseOnBalls || 0, fantasy: (batting.baseOnBalls || 0) * 1 },
            { type: 'strikeouts', value: batting.strikeOuts || 0, fantasy: -(batting.strikeOuts || 0) },
            { type: 'stolen_bases', value: batting.stolenBases || 0, fantasy: (batting.stolenBases || 0) * 5 },
            { type: 'caught_stealing', value: batting.caughtStealing || 0, fantasy: -(batting.caughtStealing || 0) * 2 },
            { type: 'batting_avg', value: parseFloat(batting.avg || '0'), fantasy: 0 },
            { type: 'obp', value: parseFloat(batting.obp || '0'), fantasy: 0 },
            { type: 'slg', value: parseFloat(batting.slg || '0'), fantasy: 0 },
            { type: 'ops', value: parseFloat(batting.ops || '0'), fantasy: 0 },
            { type: 'sac_bunts', value: batting.sacBunts || 0, fantasy: 0 },
            { type: 'sac_flies', value: batting.sacFlies || 0, fantasy: (batting.sacFlies || 0) * 0.5 },
            { type: 'ground_into_dp', value: batting.groundIntoDoublePlay || 0, fantasy: -(batting.groundIntoDoublePlay || 0) },
            { type: 'hit_by_pitch', value: batting.hitByPitch || 0, fantasy: (batting.hitByPitch || 0) * 1 },
            { type: 'left_on_base', value: batting.leftOnBase || 0, fantasy: 0 }
          ];
          
          // Calculate total fantasy points
          const totalFantasy = calculateBattingFantasyPoints(batting);
          battingStats.push({ type: 'batting_fantasy_total', value: totalFantasy, fantasy: totalFantasy });
          
          // Add all stats to buffer
          battingStats.forEach(stat => {
            statsBuffer.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: stat.type,
              stat_value: stat.value,
              fantasy_points: stat.fantasy
            });
            statsCount++;
          });
        }
        
        // PITCHING STATS
        if (player.stats?.pitching && parseFloat(player.stats.pitching.inningsPitched || '0') > 0) {
          const pitching = player.stats.pitching;
          
          const pitchingStats = [
            { type: 'innings_pitched', value: parseFloat(pitching.inningsPitched || '0'), fantasy: parseFloat(pitching.inningsPitched || '0') * 3 },
            { type: 'hits_allowed', value: pitching.hits || 0, fantasy: -(pitching.hits || 0) * 0.5 },
            { type: 'runs_allowed', value: pitching.runs || 0, fantasy: 0 },
            { type: 'earned_runs', value: pitching.earnedRuns || 0, fantasy: -(pitching.earnedRuns || 0) * 2 },
            { type: 'walks_allowed', value: pitching.baseOnBalls || 0, fantasy: -(pitching.baseOnBalls || 0) },
            { type: 'strikeouts_p', value: pitching.strikeOuts || 0, fantasy: (pitching.strikeOuts || 0) * 2 },
            { type: 'home_runs_allowed', value: pitching.homeRuns || 0, fantasy: -(pitching.homeRuns || 0) * 2 },
            { type: 'pitch_count', value: pitching.numberOfPitches || 0, fantasy: 0 },
            { type: 'strikes', value: pitching.strikes || 0, fantasy: 0 },
            { type: 'wins', value: pitching.wins || 0, fantasy: (pitching.wins || 0) * 10 },
            { type: 'losses', value: pitching.losses || 0, fantasy: -(pitching.losses || 0) * 5 },
            { type: 'saves', value: pitching.saves || 0, fantasy: (pitching.saves || 0) * 10 },
            { type: 'blown_saves', value: pitching.blownSaves || 0, fantasy: -(pitching.blownSaves || 0) * 5 },
            { type: 'holds', value: pitching.holds || 0, fantasy: (pitching.holds || 0) * 5 },
            { type: 'era', value: parseFloat(pitching.era || '0'), fantasy: 0 },
            { type: 'whip', value: parseFloat(pitching.whip || '0'), fantasy: 0 },
            { type: 'batters_faced', value: pitching.battersFaced || 0, fantasy: 0 },
            { type: 'outs', value: pitching.outs || 0, fantasy: 0 },
            { type: 'ground_outs', value: pitching.groundOuts || 0, fantasy: 0 },
            { type: 'fly_outs', value: pitching.airOuts || 0, fantasy: 0 },
            { type: 'wild_pitches', value: pitching.wildPitches || 0, fantasy: -(pitching.wildPitches || 0) },
            { type: 'hit_batters', value: pitching.hitBatsmen || 0, fantasy: -(pitching.hitBatsmen || 0) },
            { type: 'balks', value: pitching.balks || 0, fantasy: -(pitching.balks || 0) * 2 }
          ];
          
          // Calculate total pitching fantasy
          const totalPitchingFantasy = calculatePitchingFantasyPoints(pitching);
          pitchingStats.push({ type: 'pitching_fantasy_total', value: totalPitchingFantasy, fantasy: totalPitchingFantasy });
          
          // Add all stats
          pitchingStats.forEach(stat => {
            statsBuffer.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: stat.type,
              stat_value: stat.value,
              fantasy_points: stat.fantasy
            });
            statsCount++;
          });
        }
        
        // FIELDING STATS
        if (player.stats?.fielding && Object.keys(player.stats.fielding).length > 0) {
          const fielding = player.stats.fielding;
          
          const fieldingStats = [
            { type: 'putouts', value: fielding.putOuts || 0, fantasy: 0 },
            { type: 'assists', value: fielding.assists || 0, fantasy: 0 },
            { type: 'errors', value: fielding.errors || 0, fantasy: -(fielding.errors || 0) * 2 },
            { type: 'fielding_pct', value: parseFloat(fielding.fielding || '0'), fantasy: 0 }
          ];
          
          fieldingStats.forEach(stat => {
            if (stat.value !== 0) {
              statsBuffer.push({
                mlb_player_id: mlbPlayerId,
                game_id: gameId,
                stat_type: stat.type,
                stat_value: stat.value,
                fantasy_points: stat.fantasy
              });
              statsCount++;
            }
          });
        }
      }
    }
    
    totalStatsCollected += statsCount;
    return statsCount;
    
  } catch (error: any) {
    if (error.response?.status === 404) {
      // Game data not available
      return 0;
    }
    console.error(`\nError fetching game ${gamePk}:`, error.message);
    return 0;
  }
}

async function flushBuffers(force: boolean = false) {
  // Flush players
  if (playersBuffer.length >= CONFIG.PLAYER_BATCH || (force && playersBuffer.length > 0)) {
    const batch = playersBuffer.splice(0, CONFIG.PLAYER_BATCH);
    
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
  
  // Flush stats - MEGA BATCHES!
  if (statsBuffer.length >= CONFIG.DB_INSERT_BATCH || (force && statsBuffer.length > 0)) {
    while (statsBuffer.length > 0) {
      const batch = statsBuffer.splice(0, CONFIG.DB_INSERT_BATCH);
      
      const { error } = await supabase
        .from('mlb_stats')
        .insert(batch);
        
      if (error && !error.message.includes('duplicate')) {
        console.error('Stats insert error:', error.message);
      }
    }
  }
}

async function collectRealMLBData() {
  const startTime = Date.now();
  
  console.log('🔍 Checking existing MLB games in database...\n');
  
  // Get MLB games that need stats
  const { data: mlbGames } = await supabase
    .from('games')
    .select('id, external_id, start_time')
    .eq('sport', 'MLB')
    .eq('status', 'final')
    .gte('start_time', CONFIG.START_DATE)
    .lte('start_time', CONFIG.END_DATE)
    .order('start_time', { ascending: false });
    
  if (!mlbGames || mlbGames.length === 0) {
    console.log('No MLB games found in database!');
    console.log('You need to first collect game data before collecting stats.');
    return;
  }
  
  // Check which games already have stats
  const { data: processedGames } = await supabase
    .from('mlb_stats')
    .select('game_id')
    .limit(10000);
    
  const processedSet = new Set(processedGames?.map(g => g.game_id) || []);
  const gamesToProcess = mlbGames.filter(g => !processedSet.has(g.id));
  
  console.log(`📊 Total MLB games: ${mlbGames.length}`);
  console.log(`✅ Already processed: ${mlbGames.length - gamesToProcess.length}`);
  console.log(`🎯 Games to process: ${gamesToProcess.length}\n`);
  
  if (gamesToProcess.length === 0) {
    console.log('All games already have stats!');
    
    // Show what we have
    const { count: statsCount } = await supabase
      .from('mlb_stats')
      .select('*', { count: 'exact', head: true });
      
    const { count: playerCount } = await supabase
      .from('mlb_players')
      .select('*', { count: 'exact', head: true });
      
    console.log(`\n📈 Current MLB Database:`);
    console.log(`👥 Players: ${playerCount?.toLocaleString()}`);
    console.log(`📊 Stats: ${statsCount?.toLocaleString()}`);
    return;
  }
  
  // Create progress bars
  const gamesBar = multibar.create(gamesToProcess.length, 0, { name: 'Games' });
  const statsBar = multibar.create(gamesToProcess.length * 500, 0, { name: 'Stats' }); // Estimate 500 stats per game
  
  // Process games with controlled concurrency
  const limit = pLimit(CONFIG.CONCURRENT_API_CALLS);
  
  console.log('🚀 Starting REAL data collection...\n');
  
  for (let i = 0; i < gamesToProcess.length; i += 50) {
    const batch = gamesToProcess.slice(i, i + 50);
    
    const promises = batch.map(game => 
      limit(async () => {
        const gamePk = parseInt(game.external_id.replace('mlb_', ''));
        const statsCount = await fetchAndProcessGame(game.id, gamePk);
        
        if (statsCount > 0) {
          totalGamesProcessed++;
          gamesBar.increment();
          statsBar.increment(statsCount);
        }
        
        // Delay between API calls
        await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY_MS));
      })
    );
    
    await Promise.all(promises);
    
    // Flush buffers periodically
    await flushBuffers();
    
    // Progress update
    console.log(`\n⚡ Batch ${Math.floor(i/50) + 1}/${Math.ceil(gamesToProcess.length/50)} complete`);
  }
  
  // Final flush
  console.log('\n💾 Final data flush...');
  await flushBuffers(true);
  
  multibar.stop();
  
  // Performance summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n✅ REAL MLB DATA COLLECTION COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Games processed: ${totalGamesProcessed}`);
  console.log(`📊 Stats collected: ${totalStatsCollected.toLocaleString()}`);
  console.log(`👥 Players found: ${totalPlayersFound}`);
  console.log(`⚡ Rate: ${(totalStatsCollected / elapsedTime).toFixed(0)} stats/second`);
  
  // Final database counts
  const { count: playerCount } = await supabase
    .from('mlb_players')
    .select('*', { count: 'exact', head: true });
    
  const { count: statsCount } = await supabase
    .from('mlb_stats')
    .select('*', { count: 'exact', head: true });
    
  console.log('\n📈 MLB Database Totals:');
  console.log(`👥 Total MLB Players: ${playerCount?.toLocaleString()}`);
  console.log(`📊 Total MLB Stats: ${statsCount?.toLocaleString()}`);
  console.log(`📊 Average stats per game: ${statsCount && totalGamesProcessed ? Math.round(statsCount / totalGamesProcessed) : 0}`);
  
  console.log('\n🎯 THIS IS REAL DATA - NO MORE LIES!');
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
  
  await collectRealMLBData();
}

main().catch(console.error);