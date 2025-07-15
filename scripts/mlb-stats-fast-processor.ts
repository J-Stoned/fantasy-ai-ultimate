#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as os from 'os';

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

console.log(`⚡ FAST MLB STATS PROCESSOR`);
console.log(`🖥️  CPU: ${CPU_CORES} cores`);
console.log(`📊 Optimized for Supabase rate limits\n`);

// Configuration respecting rate limits
const CONFIG = {
  CONCURRENT_API_CALLS: 4, // MLB API concurrent calls
  GAMES_PER_BATCH: 50, // Process 50 games at a time
  DB_INSERT_BATCH: 100, // Insert 100 records per Supabase call
  API_DELAY_MS: 200, // 200ms between API calls = 5/second
  DB_DELAY_MS: 100, // 100ms between DB operations = 10/second
};

// Caches
const playerCache = new Map<string, boolean>();
const statsBuffer: any[] = [];
const playersBuffer: any[] = [];

// Stats tracking
let totalGamesProcessed = 0;
let totalStatsInserted = 0;
let totalPlayersCreated = 0;

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
        
        // Add player if not cached
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
            metadata: { mlb_id: player.person.id }
          });
        }
        
        // Batting stats
        if (player.stats?.batting && player.stats.batting.atBats > 0) {
          const batting = player.stats.batting;
          
          // Key stats only to reduce DB load
          if (batting.hits > 0) {
            statsBuffer.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'hits',
              stat_value: batting.hits,
              fantasy_points: batting.hits * 3
            });
            statsCount++;
          }
          
          if (batting.homeRuns > 0) {
            statsBuffer.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'home_runs',
              stat_value: batting.homeRuns,
              fantasy_points: batting.homeRuns * 10
            });
            statsCount++;
          }
          
          if (batting.rbi > 0) {
            statsBuffer.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'rbi',
              stat_value: batting.rbi,
              fantasy_points: batting.rbi * 2
            });
            statsCount++;
          }
          
          // Total fantasy points
          const totalFantasy = calculateBattingFantasyPoints(batting);
          if (totalFantasy > 5) { // Only significant performances
            statsBuffer.push({
              mlb_player_id: mlbPlayerId,
              game_id: gameId,
              stat_type: 'batting_fantasy_total',
              stat_value: totalFantasy,
              fantasy_points: totalFantasy
            });
            statsCount++;
          }
        }
        
        // Pitching stats
        if (player.stats?.pitching && parseFloat(player.stats.pitching.inningsPitched || '0') > 0) {
          const pitching = player.stats.pitching;
          
          statsBuffer.push({
            mlb_player_id: mlbPlayerId,
            game_id: gameId,
            stat_type: 'innings_pitched',
            stat_value: parseFloat(pitching.inningsPitched || '0'),
            fantasy_points: parseFloat(pitching.inningsPitched || '0') * 3
          });
          statsCount++;
          
          if (pitching.strikeOuts > 0) {
            statsBuffer.push({
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
    
    return statsCount;
    
  } catch (error: any) {
    return 0;
  }
}

async function flushBuffers() {
  // Flush players
  if (playersBuffer.length > 0) {
    console.log(`💾 Inserting ${playersBuffer.length} players...`);
    const batch = playersBuffer.splice(0, CONFIG.DB_INSERT_BATCH);
    
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
  
  // Flush stats
  if (statsBuffer.length > 0) {
    console.log(`💾 Inserting ${statsBuffer.length} stats...`);
    
    // Process in chunks
    while (statsBuffer.length > 0) {
      const batch = statsBuffer.splice(0, CONFIG.DB_INSERT_BATCH);
      
      const { error } = await supabase
        .from('mlb_stats')
        .insert(batch);
        
      if (!error || error.message.includes('duplicate')) {
        totalStatsInserted += batch.length;
      }
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.DB_DELAY_MS));
    }
  }
}

async function processGames() {
  const startTime = Date.now();
  
  console.log('🏃 Fetching MLB games...\n');
  
  // Get all MLB games
  const { data: allGames } = await supabase
    .from('games')
    .select('id, external_id')
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
  
  // Process in batches
  for (let i = 0; i < gamesToProcess.length; i += CONFIG.GAMES_PER_BATCH) {
    const batch = gamesToProcess.slice(i, i + CONFIG.GAMES_PER_BATCH);
    const batchNum = Math.floor(i / CONFIG.GAMES_PER_BATCH) + 1;
    const totalBatches = Math.ceil(gamesToProcess.length / CONFIG.GAMES_PER_BATCH);
    
    console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.length} games)`);
    
    // Process games with controlled concurrency
    const promises: Promise<void>[] = [];
    
    for (let j = 0; j < batch.length; j += CONFIG.CONCURRENT_API_CALLS) {
      const concurrent = batch.slice(j, j + CONFIG.CONCURRENT_API_CALLS);
      
      await Promise.all(
        concurrent.map(async (game) => {
          const gamePk = parseInt(game.external_id.replace('mlb_', ''));
          const stats = await fetchGameStats(game.id, gamePk);
          if (stats > 0) {
            totalGamesProcessed++;
          }
        })
      );
      
      // Delay between API call groups
      await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY_MS));
      
      // Progress update
      const progress = ((i + j + concurrent.length) / gamesToProcess.length * 100).toFixed(1);
      process.stdout.write(`\r⚡ Progress: ${progress}% | Games: ${totalGamesProcessed} | Stats: ${statsBuffer.length}`);
    }
    
    // Flush buffers after each batch
    await flushBuffers();
  }
  
  // Final flush
  await flushBuffers();
  
  // Performance summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n✅ PROCESSING COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Games processed: ${totalGamesProcessed}`);
  console.log(`📊 Stats inserted: ${totalStatsInserted}`);
  console.log(`👥 Players created: ${totalPlayersCreated}`);
  console.log(`🚀 Rate: ${(totalGamesProcessed / elapsedTime * 60).toFixed(0)} games/minute`);
  
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
}

// Main execution
processGames().catch(console.error);