#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as os from 'os';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

// Direct connection credentials
const supabaseUrl = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

// BallDontLie API setup
const ballDontLieApiKey = '59de4292-dfc4-4a8a-b337-1e804f4109c6';
const ballDontLieApi = axios.create({
  baseURL: 'https://api.balldontlie.io/v1',
  headers: { 'Authorization': ballDontLieApiKey },
  timeout: 15000
});

// System info
const CPU_CORES = os.cpus().length;
const MEMORY_GB = os.totalmem() / (1024 * 1024 * 1024);

console.log(`🚀 MEGA BATCH NBA STATS PROCESSOR`);
console.log(`🏀 Powered by BallDontLie API`);
console.log(`🖥️  CPU: ${CPU_CORES} cores | RAM: ${MEMORY_GB.toFixed(1)}GB`);
console.log(`📊 Processing with 1000+ record batches!\n`);

// Configuration for MAXIMUM throughput
const CONFIG = {
  CONCURRENT_API_CALLS: Math.min(CPU_CORES * 3, 24), // 3x CPU cores
  GAMES_PER_BATCH: 100, // BallDontLie allows 100 per page
  DB_INSERT_BATCH: 1000, // Insert 1000 records per Supabase call
  PLAYER_BATCH: 500, // Insert 500 players per batch
  API_DELAY_MS: 50, // Respect rate limits (30 req/min)
  DB_DELAY_MS: 50, // Minimal DB delay
  SEASON: 2023, // 2023-2024 season
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

// NBA Fantasy Points Calculation
function calculateNBAFantasyPoints(stats: any): number {
  let points = 0;
  // Standard NBA fantasy scoring
  points += (stats.pts || 0) * 1;      // Points
  points += (stats.reb || 0) * 1.2;    // Rebounds
  points += (stats.ast || 0) * 1.5;    // Assists
  points += (stats.stl || 0) * 3;      // Steals
  points += (stats.blk || 0) * 3;      // Blocks
  points -= (stats.turnover || 0) * 1; // Turnovers
  
  // Bonus for double-double / triple-double
  const categories = [stats.pts, stats.reb, stats.ast, stats.stl, stats.blk].filter(x => x >= 10).length;
  if (categories >= 2) points += 5;    // Double-double bonus
  if (categories >= 3) points += 10;   // Triple-double bonus
  
  return points;
}

async function fetchPlayerInfo(playerId: number) {
  try {
    const response = await ballDontLieApi.get(`/players/${playerId}`);
    return response.data;
  } catch (error) {
    return null;
  }
}

async function fetchGameStats(gameId: number, ballDontLieGameId: number): Promise<number> {
  try {
    // Get stats for this specific game
    const response = await ballDontLieApi.get('/stats', {
      params: {
        game_ids: [ballDontLieGameId],
        per_page: 100 // Max allowed
      }
    });

    let statsCount = 0;
    const gameStats = response.data.data;

    for (const stat of gameStats) {
      const nbaPlayerId = `nba_${stat.player.id}`;
      
      // Cache player data
      if (!playerCache.has(nbaPlayerId)) {
        const playerInfo = await fetchPlayerInfo(stat.player.id);
        const playerData = {
          id: nbaPlayerId,
          espn_id: nbaPlayerId, // Using NBA format for consistency
          name: `${stat.player.first_name} ${stat.player.last_name}`,
          position: playerInfo?.position || stat.player.position || 'N/A',
          team: stat.team.abbreviation,
          sport: 'NBA',
          metadata: {
            balldontlie_id: stat.player.id,
            height: playerInfo?.height_feet ? `${playerInfo.height_feet}'${playerInfo.height_inches || 0}"` : null,
            weight: playerInfo?.weight_pounds,
            college: playerInfo?.college,
            draft_year: playerInfo?.draft_year,
            draft_round: playerInfo?.draft_round,
            draft_number: playerInfo?.draft_number
          }
        };
        playerCache.set(nbaPlayerId, playerData);
        playersBuffer.push(playerData);
      }

      // Minutes played (if any)
      if (stat.min && stat.min !== '00:00') {
        const minutes = parseInt(stat.min.split(':')[0]) + (parseInt(stat.min.split(':')[1]) / 60);
        statsBuffer.push({
          player_id: nbaPlayerId,
          game_id: gameId,
          stat_type: 'minutes',
          stat_value: minutes.toFixed(2),
          metadata: { fantasy_points: 0 }
        });
        statsCount++;
      }

      // All scoring stats
      const scoringStats = [
        { type: 'points', value: stat.pts, points: stat.pts * 1 },
        { type: 'field_goals_made', value: stat.fgm, points: 0 },
        { type: 'field_goals_attempted', value: stat.fga, points: 0 },
        { type: 'field_goal_pct', value: stat.fg_pct, points: 0 },
        { type: 'three_pointers_made', value: stat.fg3m, points: stat.fg3m * 0.5 },
        { type: 'three_pointers_attempted', value: stat.fg3a, points: 0 },
        { type: 'three_point_pct', value: stat.fg3_pct, points: 0 },
        { type: 'free_throws_made', value: stat.ftm, points: 0 },
        { type: 'free_throws_attempted', value: stat.fta, points: 0 },
        { type: 'free_throw_pct', value: stat.ft_pct, points: 0 }
      ];

      // Rebounding stats
      const reboundStats = [
        { type: 'offensive_rebounds', value: stat.oreb, points: stat.oreb * 1.5 },
        { type: 'defensive_rebounds', value: stat.dreb, points: stat.dreb * 1 },
        { type: 'total_rebounds', value: stat.reb, points: stat.reb * 1.2 }
      ];

      // Other stats
      const otherStats = [
        { type: 'assists', value: stat.ast, points: stat.ast * 1.5 },
        { type: 'steals', value: stat.stl, points: stat.stl * 3 },
        { type: 'blocks', value: stat.blk, points: stat.blk * 3 },
        { type: 'turnovers', value: stat.turnover, points: -stat.turnover * 1 },
        { type: 'personal_fouls', value: stat.pf, points: 0 }
      ];

      // Combine all stats
      const allStats = [...scoringStats, ...reboundStats, ...otherStats];

      // Add all stats to buffer
      allStats.forEach(s => {
        if (s.value !== null && s.value !== undefined) {
          statsBuffer.push({
            player_id: nbaPlayerId,
            game_id: gameId,
            stat_type: s.type,
            stat_value: s.value,
            metadata: { fantasy_points: s.points || 0 }
          });
          statsCount++;
        }
      });

      // Calculate and add total fantasy points
      const totalFantasy = calculateNBAFantasyPoints(stat);
      statsBuffer.push({
        player_id: nbaPlayerId,
        game_id: gameId,
        stat_type: 'fantasy_points_total',
        stat_value: totalFantasy,
        metadata: { 
          fantasy_points: totalFantasy,
          double_double: [stat.pts, stat.reb, stat.ast].filter(x => x >= 10).length >= 2,
          triple_double: [stat.pts, stat.reb, stat.ast].filter(x => x >= 10).length >= 3
        }
      });
      statsCount++;
    }

    totalStatsCollected += statsCount;
    return statsCount;

  } catch (error: any) {
    if (error.response?.status === 429) {
      console.log('⏸️  Rate limit hit, waiting 60 seconds...');
      await new Promise(resolve => setTimeout(resolve, 60000));
      return fetchGameStats(gameId, ballDontLieGameId); // Retry
    }
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
        .from('players')
        .upsert(batch, { 
          onConflict: 'id',
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
        .from('player_stats')
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
            .from('player_stats')
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
  
  console.log('🏃 Fetching NBA games from database...\n');
  
  // Get all NBA games from 2023-2024 season
  const { data: allGames, count } = await supabase
    .from('games')
    .select('id, external_id, start_time', { count: 'exact' })
    .eq('sport', 'NBA')
    .eq('status', 'completed')
    .gte('start_time', '2023-10-01')
    .lte('start_time', '2024-06-30')
    .order('start_time', { ascending: false });
    
  if (!allGames || allGames.length === 0) {
    console.log('No NBA games found for 2023-2024 season');
    return;
  }
  
  // Check already processed
  const { data: processedStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .like('player_id', 'nba_%')
    .limit(50000);
    
  const processedSet = new Set(processedStats?.map(s => s.game_id) || []);
  const gamesToProcess = allGames.filter(g => !processedSet.has(g.id));
  
  console.log(`📊 Total NBA games (2023-24): ${allGames.length}`);
  console.log(`✅ Already processed: ${allGames.length - gamesToProcess.length}`);
  console.log(`🎯 Games to process: ${gamesToProcess.length}\n`);
  
  if (gamesToProcess.length === 0) {
    console.log('All games already processed!');
    return;
  }
  
  // Create progress bars
  const gamesBar = multibar.create(gamesToProcess.length, 0, { name: 'Games' });
  const statsBar = multibar.create(gamesToProcess.length * 25, 0, { name: 'Stats' }); // Estimate 25 stats per game
  
  // Process games with maximum concurrency
  const limit = pLimit(CONFIG.CONCURRENT_API_CALLS);
  
  for (let i = 0; i < gamesToProcess.length; i += CONFIG.GAMES_PER_BATCH) {
    const batch = gamesToProcess.slice(i, i + CONFIG.GAMES_PER_BATCH);
    
    const promises = batch.map(game => 
      limit(async () => {
        const ballDontLieGameId = parseInt(game.external_id.replace('nba_', ''));
        const stats = await fetchGameStats(game.id, ballDontLieGameId);
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
    
    // Rate limit protection
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
  
  console.log('\n\n✅ NBA MEGA BATCH PROCESSING COMPLETE!\n');
  console.log(`⏱️  Time: ${elapsedTime.toFixed(1)}s`);
  console.log(`🏀 Games processed: ${totalGamesProcessed}`);
  console.log(`📊 Stats collected: ${totalStatsCollected}`);
  console.log(`💾 Stats inserted: ${totalStatsInserted}`);
  console.log(`👥 Players created: ${totalPlayersCreated}`);
  console.log(`🚀 Performance: ${(totalGamesProcessed / elapsedTime * 60).toFixed(0)} games/minute`);
  console.log(`📈 Stats rate: ${(totalStatsInserted / elapsedTime).toFixed(0)} stats/second`);
  
  // Final database counts
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .like('id', 'nba_%');
    
  const { count: statsCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .like('player_id', 'nba_%');
    
  console.log('\n📈 Database Totals:');
  console.log(`👥 Total NBA Players: ${playerCount}`);
  console.log(`📊 Total NBA Stats: ${statsCount}`);
  
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