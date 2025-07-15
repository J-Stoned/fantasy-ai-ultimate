#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as os from 'os';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1',
  timeout: 20000
});

const CPU_CORES = os.cpus().length;

console.log(`⚾ MLB 2024 STATS COLLECTOR`);
console.log(`📊 Collecting REAL stats for 2024 games`);
console.log(`🖥️  ${CPU_CORES} cores ready\n`);

const CONFIG = {
  CONCURRENT_API_CALLS: Math.min(CPU_CORES * 2, 16),
  DB_INSERT_BATCH: 1000, // Mega batches!
  PLAYER_BATCH: 500,
  GAMES_TO_PROCESS: 500, // Process 500 games to start
  API_DELAY_MS: 100,
};

// Buffers
const statsBuffer: any[] = [];
const playersBuffer: any[] = [];
const playerCache = new Map<string, boolean>();

// Tracking
let gamesProcessed = 0;
let statsCollected = 0;
let playersFound = 0;
let failedGames = 0;

// Progress
const multibar = new cliProgress.MultiBar({
  clearOnComplete: false,
  hideCursor: true,
  format: '{bar} | {name} | {value}/{total} | {percentage}% | ETA: {eta}s'
}, cliProgress.Presets.shades_classic);

async function processGame(gameId: number, gamePk: number): Promise<number> {
  try {
    const response = await mlbApi.get(`/game/${gamePk}/boxscore`);
    const boxscore = response.data;
    
    if (!boxscore.teams) return 0;
    
    let statsCount = 0;
    
    ['home', 'away'].forEach(teamType => {
      const team = boxscore.teams[teamType];
      if (!team?.players) return;
      
      const teamName = team.team?.name || teamType;
      
      Object.values(team.players).forEach((player: any) => {
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
              birth_country: player.person.birthCountry,
              height: player.person.height,
              weight: player.person.weight
            }
          });
          playersFound++;
        }
        
        // Comprehensive batting stats
        if (player.stats?.batting && player.stats.batting.atBats >= 0) {
          const b = player.stats.batting;
          
          // Always include these
          statsBuffer.push({
            mlb_player_id: mlbPlayerId,
            game_id: gameId,
            stat_type: 'games_played',
            stat_value: 1,
            fantasy_points: 0
          });
          
          if (b.atBats >= 0) {
            statsBuffer.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'at_bats',
              stat_value: b.atBats || 0,
              fantasy_points: 0
            });
            statsCount++;
          }
          
          // All other batting stats
          const battingStats = [
            { type: 'runs', value: b.runs, fantasy: (b.runs || 0) * 2 },
            { type: 'hits', value: b.hits, fantasy: (b.hits || 0) * 3 },
            { type: 'doubles', value: b.doubles, fantasy: (b.doubles || 0) * 2 },
            { type: 'triples', value: b.triples, fantasy: (b.triples || 0) * 3 },
            { type: 'home_runs', value: b.homeRuns, fantasy: (b.homeRuns || 0) * 10 },
            { type: 'rbi', value: b.rbi, fantasy: (b.rbi || 0) * 2 },
            { type: 'walks', value: b.baseOnBalls, fantasy: (b.baseOnBalls || 0) },
            { type: 'strikeouts', value: b.strikeOuts, fantasy: -(b.strikeOuts || 0) },
            { type: 'stolen_bases', value: b.stolenBases, fantasy: (b.stolenBases || 0) * 5 },
            { type: 'caught_stealing', value: b.caughtStealing, fantasy: -(b.caughtStealing || 0) * 2 },
            { type: 'hit_by_pitch', value: b.hitByPitch, fantasy: (b.hitByPitch || 0) },
            { type: 'sac_flies', value: b.sacFlies, fantasy: (b.sacFlies || 0) * 0.5 },
            { type: 'sac_bunts', value: b.sacBunts, fantasy: 0 },
            { type: 'ground_into_dp', value: b.groundIntoDoublePlay, fantasy: -(b.groundIntoDoublePlay || 0) },
            { type: 'left_on_base', value: b.leftOnBase, fantasy: 0 }
          ];
          
          battingStats.forEach(stat => {
            if (stat.value > 0) {
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
          
          // Calculate total fantasy
          const fantasyTotal = battingStats.reduce((sum, s) => sum + s.fantasy, 0);
          if (fantasyTotal !== 0) {
            statsBuffer.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'batting_fantasy_total',
              stat_value: fantasyTotal,
              fantasy_points: fantasyTotal
            });
            statsCount++;
          }
        }
        
        // Comprehensive pitching stats
        if (player.stats?.pitching && parseFloat(player.stats.pitching.inningsPitched || '0') > 0) {
          const p = player.stats.pitching;
          const ip = parseFloat(p.inningsPitched || '0');
          
          const pitchingStats = [
            { type: 'innings_pitched', value: ip, fantasy: ip * 3 },
            { type: 'hits_allowed', value: p.hits, fantasy: -(p.hits || 0) * 0.5 },
            { type: 'runs_allowed', value: p.runs, fantasy: 0 },
            { type: 'earned_runs', value: p.earnedRuns, fantasy: -(p.earnedRuns || 0) * 2 },
            { type: 'walks_allowed', value: p.baseOnBalls, fantasy: -(p.baseOnBalls || 0) },
            { type: 'strikeouts_p', value: p.strikeOuts, fantasy: (p.strikeOuts || 0) * 2 },
            { type: 'home_runs_allowed', value: p.homeRuns, fantasy: -(p.homeRuns || 0) * 2 },
            { type: 'wins', value: p.wins || 0, fantasy: (p.wins || 0) * 10 },
            { type: 'losses', value: p.losses || 0, fantasy: -(p.losses || 0) * 5 },
            { type: 'saves', value: p.saves || 0, fantasy: (p.saves || 0) * 10 },
            { type: 'blown_saves', value: p.blownSaves || 0, fantasy: -(p.blownSaves || 0) * 5 },
            { type: 'holds', value: p.holds || 0, fantasy: (p.holds || 0) * 5 },
            { type: 'batters_faced', value: p.battersFaced, fantasy: 0 },
            { type: 'pitches_thrown', value: p.numberOfPitches, fantasy: 0 },
            { type: 'strikes', value: p.strikes, fantasy: 0 },
            { type: 'wild_pitches', value: p.wildPitches, fantasy: -(p.wildPitches || 0) },
            { type: 'hit_batters', value: p.hitBatsmen, fantasy: -(p.hitBatsmen || 0) },
            { type: 'balks', value: p.balks, fantasy: -(p.balks || 0) * 2 }
          ];
          
          pitchingStats.forEach(stat => {
            if (stat.value > 0 || stat.type === 'innings_pitched') {
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
          
          // ERA for the game
          if (p.era) {
            statsBuffer.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'era',
              stat_value: parseFloat(p.era),
              fantasy_points: 0
            });
            statsCount++;
          }
          
          // Total pitching fantasy
          const pitchingFantasy = pitchingStats.reduce((sum, s) => sum + s.fantasy, 0);
          if (pitchingFantasy !== 0) {
            statsBuffer.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'pitching_fantasy_total',
              stat_value: pitchingFantasy,
              fantasy_points: pitchingFantasy
            });
            statsCount++;
          }
        }
      });
    });
    
    statsCollected += statsCount;
    return statsCount;
    
  } catch (error: any) {
    failedGames++;
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
      console.error('\nPlayer insert error:', error.message);
    }
  }
  
  // Flush stats - MEGA BATCHES!
  if (statsBuffer.length >= CONFIG.DB_INSERT_BATCH || (force && statsBuffer.length > 0)) {
    console.log(`\n💾 Flushing ${statsBuffer.length} stats...`);
    
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

async function collectMLBStats() {
  const startTime = Date.now();
  
  console.log('🔍 Getting unprocessed MLB games...\n');
  
  // Get games that need stats
  const { data: existingStats } = await supabase
    .from('mlb_stats')
    .select('game_id')
    .limit(50000);
    
  const processedGameIds = new Set(existingStats?.map(s => s.game_id) || []);
  
  const { data: allGames } = await supabase
    .from('games')
    .select('id, external_id')
    .eq('sport', 'MLB')
    .eq('status', 'final')
    .order('start_time', { ascending: false })
    .limit(CONFIG.GAMES_TO_PROCESS + processedGameIds.size);
    
  const gamesToProcess = allGames?.filter(g => !processedGameIds.has(g.id)) || [];
  
  console.log(`📊 Total MLB games: ${allGames?.length || 0}`);
  console.log(`✅ Already have stats for: ${processedGameIds.size} games`);
  console.log(`🎯 Will process: ${Math.min(CONFIG.GAMES_TO_PROCESS, gamesToProcess.length)} games\n`);
  
  if (gamesToProcess.length === 0) {
    console.log('All games already have stats!');
    return;
  }
  
  const gameBatch = gamesToProcess.slice(0, CONFIG.GAMES_TO_PROCESS);
  
  // Progress bars
  const gamesBar = multibar.create(gameBatch.length, 0, { name: 'Games' });
  const statsBar = multibar.create(gameBatch.length * 300, 0, { name: 'Stats' });
  
  // Process with concurrency
  const limit = pLimit(CONFIG.CONCURRENT_API_CALLS);
  
  for (let i = 0; i < gameBatch.length; i += 50) {
    const batch = gameBatch.slice(i, i + 50);
    
    const promises = batch.map(game => 
      limit(async () => {
        const gamePk = parseInt(game.external_id.replace('mlb_', ''));
        const stats = await processGame(game.id, gamePk);
        
        if (stats > 0) {
          gamesProcessed++;
          gamesBar.increment();
          statsBar.increment(stats);
        }
        
        // Flush buffers periodically
        if (statsBuffer.length >= CONFIG.DB_INSERT_BATCH) {
          await flushBuffers();
        }
        
        // Rate limit
        await new Promise(r => setTimeout(r, CONFIG.API_DELAY_MS));
      })
    );
    
    await Promise.all(promises);
  }
  
  // Final flush
  console.log('\n\n💾 Final data flush...');
  await flushBuffers(true);
  
  multibar.stop();
  
  // Summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n✅ MLB STATS COLLECTION COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Games processed: ${gamesProcessed}`);
  console.log(`❌ Failed games: ${failedGames}`);
  console.log(`📊 Stats collected: ${statsCollected.toLocaleString()}`);
  console.log(`👥 Players found: ${playersFound}`);
  console.log(`⚡ Rate: ${(statsCollected / elapsedTime).toFixed(0)} stats/second`);
  
  // Final counts
  const { count: playerCount } = await supabase
    .from('mlb_players')
    .select('*', { count: 'exact', head: true });
    
  const { count: statsCount } = await supabase
    .from('mlb_stats')
    .select('*', { count: 'exact', head: true });
    
  console.log('\n📈 MLB Database Totals:');
  console.log(`👥 Total MLB Players: ${playerCount?.toLocaleString()}`);
  console.log(`📊 Total MLB Stats: ${statsCount?.toLocaleString()}`);
  
  if (statsCount && statsCount > 114139) {
    const newStats = statsCount - 114139;
    console.log(`\n🎉 Added ${newStats.toLocaleString()} NEW REAL STATS!`);
  }
}

// Main
async function main() {
  try {
    require('p-limit');
    require('cli-progress');
  } catch {
    console.log('📦 Installing packages...');
    const { execSync } = require('child_process');
    execSync('npm install p-limit cli-progress', { stdio: 'inherit' });
  }
  
  await collectMLBStats();
}

main().catch(console.error);