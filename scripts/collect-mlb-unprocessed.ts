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

console.log(`⚾ MLB UNPROCESSED GAMES COLLECTOR`);
console.log(`📊 Collecting stats for games we don't already have`);
console.log(`🖥️  ${CPU_CORES} cores ready\n`);

const CONFIG = {
  CONCURRENT_API_CALLS: Math.min(CPU_CORES * 2, 16),
  DB_INSERT_BATCH: 1000,
  PLAYER_BATCH: 500,
  GAMES_TO_PROCESS: 1000, // Process up to 1000 unprocessed games
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
let skippedGames = 0;

// Progress
const multibar = new cliProgress.MultiBar({
  clearOnComplete: false,
  hideCursor: true,
  format: '{bar} | {name} | {value}/{total} | {percentage}% | ETA: {eta}s'
}, cliProgress.Presets.shades_classic);

async function checkExistingPlayers() {
  const { data: existingPlayers } = await supabase
    .from('mlb_players')
    .select('mlb_player_id');
    
  existingPlayers?.forEach(p => playerCache.set(p.mlb_player_id, true));
  console.log(`📋 Loaded ${playerCache.size} existing players into cache\n`);
}

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
        
        // Batting stats
        if (player.stats?.batting && player.stats.batting.atBats >= 0) {
          const b = player.stats.batting;
          
          // Always include games played
          statsBuffer.push({
            mlb_player_id: mlbPlayerId,
            game_id: gameId,
            stat_type: 'games_played',
            stat_value: 1,
            fantasy_points: 0
          });
          
          // All batting stats
          const battingStats = [
            { type: 'at_bats', value: b.atBats || 0, fantasy: 0 },
            { type: 'runs', value: b.runs, fantasy: (b.runs || 0) * 2 },
            { type: 'hits', value: b.hits, fantasy: (b.hits || 0) * 3 },
            { type: 'doubles', value: b.doubles, fantasy: (b.doubles || 0) * 2 },
            { type: 'triples', value: b.triples, fantasy: (b.triples || 0) * 3 },
            { type: 'home_runs', value: b.homeRuns, fantasy: (b.homeRuns || 0) * 10 },
            { type: 'rbi', value: b.rbi, fantasy: (b.rbi || 0) * 2 },
            { type: 'walks', value: b.baseOnBalls, fantasy: (b.baseOnBalls || 0) },
            { type: 'strikeouts', value: b.strikeOuts, fantasy: -(b.strikeOuts || 0) },
            { type: 'stolen_bases', value: b.stolenBases, fantasy: (b.stolenBases || 0) * 5 },
            { type: 'caught_stealing', value: b.caughtStealing, fantasy: -(b.caughtStealing || 0) * 2 }
          ];
          
          battingStats.forEach(stat => {
            if (stat.value !== undefined && stat.value !== null) {
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
        
        // Pitching stats
        if (player.stats?.pitching && parseFloat(player.stats.pitching.inningsPitched || '0') > 0) {
          const p = player.stats.pitching;
          const ip = parseFloat(p.inningsPitched || '0');
          
          const pitchingStats = [
            { type: 'innings_pitched', value: ip, fantasy: ip * 3 },
            { type: 'hits_allowed', value: p.hits, fantasy: -(p.hits || 0) * 0.5 },
            { type: 'earned_runs', value: p.earnedRuns, fantasy: -(p.earnedRuns || 0) * 2 },
            { type: 'walks_allowed', value: p.baseOnBalls, fantasy: -(p.baseOnBalls || 0) },
            { type: 'strikeouts_p', value: p.strikeOuts, fantasy: (p.strikeOuts || 0) * 2 },
            { type: 'wins', value: p.wins || 0, fantasy: (p.wins || 0) * 10 },
            { type: 'losses', value: p.losses || 0, fantasy: -(p.losses || 0) * 5 },
            { type: 'saves', value: p.saves || 0, fantasy: (p.saves || 0) * 10 }
          ];
          
          pitchingStats.forEach(stat => {
            if (stat.value !== undefined && stat.value !== null) {
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
  
  // Flush stats
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

async function collectUnprocessedGames() {
  const startTime = Date.now();
  
  await checkExistingPlayers();
  
  console.log('🔍 Finding unprocessed MLB games...\n');
  
  // Get all game IDs that already have stats
  const { data: processedGames } = await supabase
    .from('mlb_stats')
    .select('game_id')
    .limit(50000);
    
  const processedGameIds = new Set(processedGames?.map(g => g.game_id) || []);
  console.log(`📊 Found ${processedGameIds.size} games with existing stats`);
  
  // Get unprocessed games
  const { data: allGames } = await supabase
    .from('games')
    .select('id, external_id, start_time')
    .eq('sport', 'MLB')
    .eq('status', 'final')
    .order('start_time', { ascending: false })
    .limit(5000);
    
  const unprocessedGames = allGames?.filter(g => !processedGameIds.has(g.id)) || [];
  
  console.log(`🎯 Found ${unprocessedGames.length} games without stats`);
  console.log(`📅 Processing up to ${Math.min(CONFIG.GAMES_TO_PROCESS, unprocessedGames.length)} games\n`);
  
  if (unprocessedGames.length === 0) {
    console.log('✅ All games already have stats!');
    return;
  }
  
  const gameBatch = unprocessedGames.slice(0, CONFIG.GAMES_TO_PROCESS);
  
  // Show date range
  const dates = gameBatch.map(g => new Date(g.start_time));
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  console.log(`📅 Date range: ${minDate.toLocaleDateString()} to ${maxDate.toLocaleDateString()}\n`);
  
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
        } else {
          skippedGames++;
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
  
  console.log('\n✅ MLB UNPROCESSED GAMES COLLECTION COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🎮 Games processed: ${gamesProcessed}`);
  console.log(`⏭️  Games skipped: ${skippedGames}`);
  console.log(`❌ Failed games: ${failedGames}`);
  console.log(`📊 Stats collected: ${statsCollected.toLocaleString()}`);
  console.log(`👥 New players found: ${playersFound}`);
  console.log(`⚡ Rate: ${(statsCollected / elapsedTime).toFixed(0)} stats/second`);
  
  // Check remaining
  const { data: checkRemaining } = await supabase
    .from('mlb_stats')
    .select('game_id')
    .limit(50000);
    
  const newProcessedCount = new Set(checkRemaining?.map(g => g.game_id) || []).size;
  const remaining = (allGames?.length || 0) - newProcessedCount;
  
  console.log(`\n📈 Status:`);
  console.log(`Total MLB games: ${allGames?.length || 0}`);
  console.log(`Games with stats: ${newProcessedCount}`);
  console.log(`Games remaining: ${remaining}`);
  
  if (remaining > 0) {
    console.log(`\n💡 Run this script again to process the next batch!`);
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
  
  await collectUnprocessedGames();
}

main().catch(console.error);