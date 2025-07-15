#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as os from 'os';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const mlbApi = axios.create({
  baseURL: 'https://statsapi.mlb.com/api/v1',
  timeout: 20000
});

const CPU_CORES = os.cpus().length;

console.log(`⚾ MLB CONTINUOUS COLLECTOR`);
console.log(`📊 Will process ALL unprocessed games`);
console.log(`🖥️  ${CPU_CORES} cores ready\n`);

const CONFIG = {
  CONCURRENT_API_CALLS: Math.min(CPU_CORES * 2, 16),
  DB_INSERT_BATCH: 1000,
  PLAYER_BATCH: 500,
  GAMES_PER_RUN: 500, // Process 500 games per run
  API_DELAY_MS: 100,
  CONTINUE_UNTIL_DONE: true
};

// Tracking
let totalGamesProcessed = 0;
let totalStatsCollected = 0;
let totalPlayersFound = 0;
let totalFailedGames = 0;
let runNumber = 0;

async function processGame(gameId: number, gamePk: number, playerCache: Map<string, boolean>): Promise<{stats: any[], players: any[]}> {
  try {
    const response = await mlbApi.get(`/game/${gamePk}/boxscore`);
    const boxscore = response.data;
    
    if (!boxscore.teams) return { stats: [], players: [] };
    
    const stats: any[] = [];
    const newPlayers: any[] = [];
    
    ['home', 'away'].forEach(teamType => {
      const team = boxscore.teams[teamType];
      if (!team?.players) return;
      
      const teamName = team.team?.name || teamType;
      
      Object.values(team.players).forEach((player: any) => {
        const mlbPlayerId = `mlb_${player.person.id}`;
        
        // Track new players
        if (!playerCache.has(mlbPlayerId)) {
          playerCache.set(mlbPlayerId, true);
          newPlayers.push({
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
        }
        
        // Collect all stats (batting and pitching)
        if (player.stats?.batting && player.stats.batting.atBats >= 0) {
          const b = player.stats.batting;
          
          stats.push({
            mlb_player_id: mlbPlayerId,
            game_id: gameId,
            stat_type: 'games_played',
            stat_value: 1,
            fantasy_points: 0
          });
          
          const battingStats = [
            { type: 'at_bats', value: b.atBats || 0 },
            { type: 'runs', value: b.runs || 0 },
            { type: 'hits', value: b.hits || 0 },
            { type: 'doubles', value: b.doubles || 0 },
            { type: 'triples', value: b.triples || 0 },
            { type: 'home_runs', value: b.homeRuns || 0 },
            { type: 'rbi', value: b.rbi || 0 },
            { type: 'walks', value: b.baseOnBalls || 0 },
            { type: 'strikeouts', value: b.strikeOuts || 0 },
            { type: 'stolen_bases', value: b.stolenBases || 0 }
          ];
          
          battingStats.forEach(s => {
            if (s.value !== undefined) {
              stats.push({
                mlb_player_id: mlbPlayerId,
                game_id: gameId,
                stat_type: s.type,
                stat_value: s.value,
                fantasy_points: 0
              });
            }
          });
        }
        
        if (player.stats?.pitching && parseFloat(player.stats.pitching.inningsPitched || '0') > 0) {
          const p = player.stats.pitching;
          
          const pitchingStats = [
            { type: 'innings_pitched', value: parseFloat(p.inningsPitched || '0') },
            { type: 'hits_allowed', value: p.hits || 0 },
            { type: 'earned_runs', value: p.earnedRuns || 0 },
            { type: 'walks_allowed', value: p.baseOnBalls || 0 },
            { type: 'strikeouts_p', value: p.strikeOuts || 0 },
            { type: 'wins', value: p.wins || 0 },
            { type: 'losses', value: p.losses || 0 },
            { type: 'saves', value: p.saves || 0 }
          ];
          
          pitchingStats.forEach(s => {
            if (s.value !== undefined) {
              stats.push({
                mlb_player_id: mlbPlayerId,
                game_id: gameId,
                stat_type: s.type,
                stat_value: s.value,
                fantasy_points: 0
              });
            }
          });
        }
      });
    });
    
    return { stats, players: newPlayers };
    
  } catch (error: any) {
    return { stats: [], players: [] };
  }
}

async function processGamesRun() {
  runNumber++;
  console.log(`\n🏃 RUN #${runNumber} STARTING...\n`);
  
  const runStartTime = Date.now();
  
  // Load existing players
  const playerCache = new Map<string, boolean>();
  const { data: existingPlayers } = await supabase
    .from('mlb_players')
    .select('mlb_player_id');
  existingPlayers?.forEach(p => playerCache.set(p.mlb_player_id, true));
  console.log(`📋 Loaded ${playerCache.size} existing players\n`);
  
  // Get processed game IDs
  const { data: processedGames } = await supabase
    .from('mlb_stats')
    .select('game_id')
    .limit(50000);
  const processedGameIds = new Set(processedGames?.map(g => g.game_id) || []);
  
  // Get unprocessed games
  const { data: unprocessedGames } = await supabase
    .from('games')
    .select('id, external_id, start_time')
    .eq('sport', 'MLB')
    .eq('status', 'final')
    .order('start_time', { ascending: false })
    .limit(processedGameIds.size + CONFIG.GAMES_PER_RUN + 100);
    
  const gamesToProcess = unprocessedGames
    ?.filter(g => !processedGameIds.has(g.id))
    .slice(0, CONFIG.GAMES_PER_RUN) || [];
    
  if (gamesToProcess.length === 0) {
    console.log('✅ ALL GAMES PROCESSED! No more unprocessed games found.');
    return false; // No more games to process
  }
  
  console.log(`🎯 Processing ${gamesToProcess.length} games this run`);
  
  // Progress bars
  const multibar = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: '{bar} | {name} | {value}/{total} | {percentage}%'
  }, cliProgress.Presets.shades_classic);
  
  const gamesBar = multibar.create(gamesToProcess.length, 0, { name: 'Games' });
  const statsBar = multibar.create(gamesToProcess.length * 250, 0, { name: 'Stats' });
  
  // Process games in batches
  const limit = pLimit(CONFIG.CONCURRENT_API_CALLS);
  const allPlayers: any[] = [];
  const allStats: any[] = [];
  let runGamesProcessed = 0;
  let runStatsCollected = 0;
  let runFailedGames = 0;
  
  for (let i = 0; i < gamesToProcess.length; i += 50) {
    const batch = gamesToProcess.slice(i, i + 50);
    
    const promises = batch.map(game => 
      limit(async () => {
        const gamePk = parseInt(game.external_id.replace('mlb_', ''));
        const result = await processGame(game.id, gamePk, playerCache);
        
        if (result.stats.length > 0) {
          allPlayers.push(...result.players);
          allStats.push(...result.stats);
          runGamesProcessed++;
          runStatsCollected += result.stats.length;
          gamesBar.increment();
          statsBar.increment(result.stats.length);
        } else {
          runFailedGames++;
        }
        
        await new Promise(r => setTimeout(r, CONFIG.API_DELAY_MS));
      })
    );
    
    await Promise.all(promises);
  }
  
  multibar.stop();
  
  // Insert all players first (to avoid foreign key issues)
  if (allPlayers.length > 0) {
    console.log(`\n💾 Inserting ${allPlayers.length} new players...`);
    
    for (let i = 0; i < allPlayers.length; i += CONFIG.PLAYER_BATCH) {
      const batch = allPlayers.slice(i, i + CONFIG.PLAYER_BATCH);
      await supabase
        .from('mlb_players')
        .upsert(batch, { onConflict: 'mlb_player_id', ignoreDuplicates: false });
    }
  }
  
  // Then insert all stats
  if (allStats.length > 0) {
    console.log(`💾 Inserting ${allStats.length} stats...`);
    
    for (let i = 0; i < allStats.length; i += CONFIG.DB_INSERT_BATCH) {
      const batch = allStats.slice(i, i + CONFIG.DB_INSERT_BATCH);
      const { error } = await supabase
        .from('mlb_stats')
        .insert(batch);
        
      if (error && !error.message.includes('duplicate')) {
        console.error('Stats insert error:', error.message);
      }
    }
  }
  
  // Update totals
  totalGamesProcessed += runGamesProcessed;
  totalStatsCollected += runStatsCollected;
  totalPlayersFound += allPlayers.length;
  totalFailedGames += runFailedGames;
  
  // Run summary
  const runTime = (Date.now() - runStartTime) / 1000;
  console.log(`\n📊 RUN #${runNumber} COMPLETE!`);
  console.log(`⏱️  Time: ${runTime.toFixed(1)}s`);
  console.log(`🎮 Games: ${runGamesProcessed}`);
  console.log(`📊 Stats: ${runStatsCollected.toLocaleString()}`);
  console.log(`⚡ Rate: ${(runStatsCollected / runTime).toFixed(0)} stats/second`);
  
  return true; // More games available
}

async function continuousCollection() {
  const startTime = Date.now();
  
  console.log('🚀 STARTING CONTINUOUS MLB COLLECTION');
  console.log('Will continue until all games are processed...\n');
  
  // Keep running until no more games
  let hasMoreGames = true;
  
  while (hasMoreGames && CONFIG.CONTINUE_UNTIL_DONE) {
    hasMoreGames = await processGamesRun();
    
    if (hasMoreGames) {
      console.log('\n⏸️  Pausing 5 seconds before next run...');
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  
  // Final summary
  const totalTime = (Date.now() - startTime) / 1000;
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ CONTINUOUS COLLECTION COMPLETE!');
  console.log('='.repeat(60));
  console.log(`\n📈 FINAL TOTALS:`);
  console.log(`🏃 Total runs: ${runNumber}`);
  console.log(`⏱️  Total time: ${(totalTime / 60).toFixed(1)} minutes`);
  console.log(`🎮 Games processed: ${totalGamesProcessed.toLocaleString()}`);
  console.log(`📊 Stats collected: ${totalStatsCollected.toLocaleString()}`);
  console.log(`👥 Players found: ${totalPlayersFound.toLocaleString()}`);
  console.log(`❌ Failed games: ${totalFailedGames}`);
  console.log(`⚡ Overall rate: ${(totalStatsCollected / totalTime).toFixed(0)} stats/second`);
  
  // Check final status
  const { count: totalMLBGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB')
    .eq('status', 'final');
    
  const { data: finalCheck } = await supabase
    .from('mlb_stats')
    .select('game_id')
    .limit(50000);
  const processedCount = new Set(finalCheck?.map(g => g.game_id) || []).size;
  
  console.log(`\n📊 DATABASE STATUS:`);
  console.log(`Total MLB games: ${totalMLBGames}`);
  console.log(`Games with stats: ${processedCount}`);
  console.log(`Coverage: ${((processedCount / (totalMLBGames || 1)) * 100).toFixed(1)}%`);
  
  const { count: totalStats } = await supabase
    .from('mlb_stats')
    .select('*', { count: 'exact', head: true });
  console.log(`Total MLB stats: ${totalStats?.toLocaleString()}`);
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
  
  await continuousCollection();
}

main().catch(console.error);