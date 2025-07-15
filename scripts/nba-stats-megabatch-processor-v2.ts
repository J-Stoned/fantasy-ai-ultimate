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
  timeout: 30000
});

// System info
const CPU_CORES = os.cpus().length;
const MEMORY_GB = os.totalmem() / (1024 * 1024 * 1024);

console.log(`🚀 MEGA BATCH NBA STATS PROCESSOR V2`);
console.log(`🏀 Direct from BallDontLie API`);
console.log(`🖥️  CPU: ${CPU_CORES} cores | RAM: ${MEMORY_GB.toFixed(1)}GB`);
console.log(`📊 Processing 2023-2024 NBA Season!\n`);

// Configuration for MAXIMUM throughput
const CONFIG = {
  CONCURRENT_API_CALLS: Math.min(CPU_CORES * 2, 12), // Reduced for rate limits
  STATS_PER_BATCH: 100, // BallDontLie max per page
  DB_INSERT_BATCH: 1000, // Insert 1000 records per Supabase call
  PLAYER_BATCH: 500, // Insert 500 players per batch
  API_DELAY_MS: 2000, // 2 second delay between requests (30/min limit)
  DB_DELAY_MS: 50, // Minimal DB delay
  START_DATE: '2023-10-01',
  END_DATE: '2024-06-30',
};

// Global buffers
const playerCache = new Map<string, any>();
const statsBuffer: any[] = [];
const playersBuffer: any[] = [];
const gamesBuffer: any[] = [];

// Tracking
let totalGamesProcessed = 0;
let totalStatsCollected = 0;
let totalStatsInserted = 0;
let totalPlayersCreated = 0;
let totalGamesCreated = 0;

// Progress bars
const multibar = new cliProgress.MultiBar({
  clearOnComplete: false,
  hideCursor: true,
  format: '{bar} | {name} | {value}/{total} | {percentage}% | {rate}/s | ETA: {eta}s'
}, cliProgress.Presets.shades_classic);

// NBA Fantasy Points Calculation
function calculateNBAFantasyPoints(stats: any): number {
  let points = 0;
  // DraftKings scoring
  points += (stats.pts || 0) * 1;         // Points
  points += (stats.reb || 0) * 1.25;      // Rebounds
  points += (stats.ast || 0) * 1.5;       // Assists
  points += (stats.stl || 0) * 2;         // Steals
  points += (stats.blk || 0) * 2;         // Blocks
  points -= (stats.turnover || 0) * 0.5;  // Turnovers
  
  // Efficiency bonus
  if (stats.fga > 0) {
    const fgPct = stats.fgm / stats.fga;
    if (fgPct >= 0.5 && stats.fga >= 10) points += 2; // Efficiency bonus
  }
  
  // Double-double / Triple-double
  const categories = [stats.pts, stats.reb, stats.ast, stats.stl, stats.blk].filter(x => x >= 10).length;
  if (categories >= 2) points += 1.5;     // Double-double
  if (categories >= 3) points += 3;       // Triple-double
  
  return parseFloat(points.toFixed(2));
}

async function fetchAndStoreGames(startDate: string, endDate: string) {
  console.log(`📅 Fetching games from ${startDate} to ${endDate}...`);
  
  let currentPage = 1;
  let totalPages = 1;
  const allGames = [];
  
  while (currentPage <= totalPages) {
    try {
      const response = await ballDontLieApi.get('/games', {
        params: {
          start_date: startDate,
          end_date: endDate,
          per_page: 100,
          page: currentPage
        }
      });
      
      const { data, meta } = response.data;
      totalPages = meta.total_pages;
      
      // Transform games to our format
      for (const game of data) {
        if (game.status === 'Final') {
          const gameData = {
            external_id: `balldontlie_${game.id}`,
            sport: 'NBA',
            sport_id: 'nba',
            home_team_id: game.home_team.id,
            away_team_id: game.visitor_team.id,
            home_score: game.home_team_score,
            away_score: game.visitor_team_score,
            start_time: game.date,
            status: 'final',
            venue: game.home_team.full_name + ' Arena',
            metadata: {
              season: game.season,
              postseason: game.postseason,
              home_team_name: game.home_team.full_name,
              away_team_name: game.visitor_team.full_name,
              balldontlie_id: game.id
            }
          };
          
          allGames.push(gameData);
          gamesBuffer.push(gameData);
        }
      }
      
      currentPage++;
      
      // Rate limit protection
      if (currentPage <= totalPages) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY_MS));
      }
      
    } catch (error: any) {
      console.error(`Error fetching games page ${currentPage}:`, error.message);
      if (error.response?.status === 429) {
        console.log('⏸️  Rate limit hit, waiting 60 seconds...');
        await new Promise(resolve => setTimeout(resolve, 60000));
        continue; // Retry same page
      }
      break;
    }
  }
  
  console.log(`✅ Found ${allGames.length} completed games`);
  
  // Store games in database
  if (gamesBuffer.length > 0) {
    console.log('💾 Storing games in database...');
    
    const batches = [];
    while (gamesBuffer.length > 0) {
      batches.push(gamesBuffer.splice(0, 100));
    }
    
    for (const batch of batches) {
      const { error, data } = await supabase
        .from('games')
        .upsert(batch, {
          onConflict: 'external_id',
          ignoreDuplicates: false
        })
        .select();
      
      if (!error) {
        totalGamesCreated += data.length;
      }
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.DB_DELAY_MS));
    }
  }
  
  return allGames;
}

async function fetchGameStats(gameId: number, ballDontLieGameId: number): Promise<number> {
  try {
    // Get all stats for this game
    let allStats = [];
    let currentPage = 1;
    let totalPages = 1;
    
    while (currentPage <= totalPages) {
      const response = await ballDontLieApi.get('/stats', {
        params: {
          game_ids: [ballDontLieGameId],
          per_page: CONFIG.STATS_PER_BATCH,
          page: currentPage
        }
      });
      
      const { data, meta } = response.data;
      allStats = allStats.concat(data);
      totalPages = meta.total_pages;
      currentPage++;
      
      if (currentPage <= totalPages) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY_MS));
      }
    }

    let statsCount = 0;

    for (const stat of allStats) {
      const nbaPlayerId = `balldontlie_${stat.player.id}`;
      
      // Cache player data
      if (!playerCache.has(nbaPlayerId)) {
        const playerData = {
          id: nbaPlayerId,
          espn_id: nbaPlayerId,
          name: `${stat.player.first_name} ${stat.player.last_name}`,
          position: stat.player.position || 'N/A',
          team: stat.team.abbreviation,
          sport: 'NBA',
          metadata: {
            balldontlie_id: stat.player.id,
            team_id: stat.team.id,
            team_name: stat.team.full_name
          }
        };
        playerCache.set(nbaPlayerId, playerData);
        playersBuffer.push(playerData);
      }

      // Process all stats
      const playerStats = [
        // Basic stats
        { type: 'minutes', value: stat.min ? (parseInt(stat.min.split(':')[0]) + parseInt(stat.min.split(':')[1])/60) : 0 },
        { type: 'points', value: stat.pts || 0 },
        { type: 'field_goals_made', value: stat.fgm || 0 },
        { type: 'field_goals_attempted', value: stat.fga || 0 },
        { type: 'field_goal_pct', value: stat.fg_pct || 0 },
        { type: 'three_pointers_made', value: stat.fg3m || 0 },
        { type: 'three_pointers_attempted', value: stat.fg3a || 0 },
        { type: 'three_point_pct', value: stat.fg3_pct || 0 },
        { type: 'free_throws_made', value: stat.ftm || 0 },
        { type: 'free_throws_attempted', value: stat.fta || 0 },
        { type: 'free_throw_pct', value: stat.ft_pct || 0 },
        { type: 'offensive_rebounds', value: stat.oreb || 0 },
        { type: 'defensive_rebounds', value: stat.dreb || 0 },
        { type: 'total_rebounds', value: stat.reb || 0 },
        { type: 'assists', value: stat.ast || 0 },
        { type: 'steals', value: stat.stl || 0 },
        { type: 'blocks', value: stat.blk || 0 },
        { type: 'turnovers', value: stat.turnover || 0 },
        { type: 'personal_fouls', value: stat.pf || 0 },
        
        // Advanced stats
        { type: 'plus_minus', value: 0 }, // Not available in BallDontLie
        { type: 'true_shooting_pct', value: stat.pts > 0 ? (stat.pts / (2 * (stat.fga + 0.44 * stat.fta))) : 0 },
        { type: 'effective_fg_pct', value: stat.fga > 0 ? ((stat.fgm + 0.5 * stat.fg3m) / stat.fga) : 0 }
      ];

      // Add all stats to buffer
      playerStats.forEach(s => {
        if (s.value !== null && s.value !== undefined && (s.value !== 0 || ['minutes', 'points', 'turnovers', 'personal_fouls'].includes(s.type))) {
          statsBuffer.push({
            player_id: nbaPlayerId,
            game_id: gameId,
            stat_type: s.type,
            stat_value: parseFloat(s.value.toFixed(3)),
            metadata: {}
          });
          statsCount++;
        }
      });

      // Calculate and add fantasy points
      const fantasyPoints = calculateNBAFantasyPoints(stat);
      statsBuffer.push({
        player_id: nbaPlayerId,
        game_id: gameId,
        stat_type: 'fantasy_points',
        stat_value: fantasyPoints,
        metadata: { 
          double_double: [stat.pts, stat.reb, stat.ast].filter(x => x >= 10).length >= 2,
          triple_double: [stat.pts, stat.reb, stat.ast].filter(x => x >= 10).length >= 3,
          dk_points: fantasyPoints
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
      return fetchGameStats(gameId, ballDontLieGameId);
    }
    console.error(`Error fetching stats for game ${ballDontLieGameId}:`, error.message);
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
        
      if (!error) {
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
      const { error } = await supabase
        .from('player_stats')
        .insert(batch);
        
      if (!error) {
        totalStatsInserted += batch.length;
      } else if (!error.message.includes('duplicate')) {
        console.error(`Warning: Batch insert error - ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.DB_DELAY_MS));
    }
  }
}

async function processNBASeason() {
  const startTime = Date.now();
  
  // First, fetch and store all games
  const games = await fetchAndStoreGames(CONFIG.START_DATE, CONFIG.END_DATE);
  
  if (games.length === 0) {
    console.log('No games found to process');
    return;
  }
  
  // Get game IDs from database
  const { data: dbGames } = await supabase
    .from('games')
    .select('id, external_id')
    .in('external_id', games.map(g => g.external_id));
    
  if (!dbGames || dbGames.length === 0) {
    console.log('Failed to retrieve games from database');
    return;
  }
  
  // Create mapping
  const gameIdMap = new Map(dbGames.map(g => [g.external_id, g.id]));
  
  console.log(`\n🏀 Processing ${dbGames.length} NBA games...\n`);
  
  // Create progress bars
  const gamesBar = multibar.create(dbGames.length, 0, { name: 'Games' });
  const statsBar = multibar.create(dbGames.length * 300, 0, { name: 'Stats' }); // Estimate 300 stats per game
  
  // Process games with rate limiting
  const limit = pLimit(1); // Process one at a time due to strict rate limits
  
  let processed = 0;
  for (const game of games) {
    const dbGameId = gameIdMap.get(game.external_id);
    if (!dbGameId) continue;
    
    await limit(async () => {
      const ballDontLieId = game.metadata.balldontlie_id;
      const stats = await fetchGameStats(dbGameId, ballDontLieId);
      
      if (stats > 0) {
        totalGamesProcessed++;
        gamesBar.increment();
        statsBar.increment(stats);
      }
      
      // Flush buffers periodically
      if (processed % 10 === 0) {
        await flushBuffers(false);
      }
      
      processed++;
    });
    
    // Rate limit between games
    await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY_MS));
  }
  
  // Final flush
  console.log('\n🏁 Final flush of remaining data...');
  await flushBuffers(true);
  
  multibar.stop();
  
  // Performance summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n✅ NBA MEGA BATCH PROCESSING COMPLETE!\n');
  console.log(`⏱️  Time: ${(elapsedTime / 60).toFixed(1)} minutes`);
  console.log(`🏀 Games processed: ${totalGamesProcessed}`);
  console.log(`📊 Stats collected: ${totalStatsCollected}`);
  console.log(`💾 Stats inserted: ${totalStatsInserted}`);
  console.log(`👥 Players created: ${totalPlayersCreated}`);
  console.log(`🎮 Games created: ${totalGamesCreated}`);
  console.log(`🚀 Performance: ${(totalStatsInserted / elapsedTime).toFixed(0)} stats/second`);
  
  // Final database counts
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .like('id', 'balldontlie_%');
    
  const { count: statsCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .like('player_id', 'balldontlie_%');
    
  console.log('\n📈 Database Totals:');
  console.log(`👥 Total NBA Players: ${playerCount}`);
  console.log(`📊 Total NBA Stats: ${statsCount}`);
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
  await processNBASeason();
}

main().catch(console.error);