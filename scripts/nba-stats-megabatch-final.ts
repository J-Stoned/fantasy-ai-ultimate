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

// BallDontLie API setup
const ballDontLieApi = axios.create({
  baseURL: 'https://api.balldontlie.io/v1',
  headers: { 
    'Authorization': config.apis.ballDontLie
  },
  timeout: 30000
});

// System info
const CPU_CORES = os.cpus().length;
const MEMORY_GB = os.totalmem() / (1024 * 1024 * 1024);

console.log(`🚀 MEGA BATCH NBA STATS PROCESSOR - FINAL VERSION`);
console.log(`🏀 Processing ALL NBA Data at Maximum Speed!`);
console.log(`🖥️  CPU: ${CPU_CORES} cores | RAM: ${MEMORY_GB.toFixed(1)}GB`);
console.log(`📊 Target: 2023-2024 NBA Season + More!\n`);

// Configuration for MAXIMUM throughput (following MLB pattern)
const CONFIG = {
  CONCURRENT_API_CALLS: Math.min(CPU_CORES * 3, 24), // 3x CPU cores like MLB
  STATS_PER_BATCH: 100, // BallDontLie max per page
  DB_INSERT_BATCH: 1000, // 1000+ record batches as requested!
  PLAYER_BATCH: 500, // Insert 500 players per batch
  API_DELAY_MS: 100, // Faster than v2 since auth is working
  DB_DELAY_MS: 50, // Minimal DB delay
  SEASONS: [2023, 2024], // Multiple seasons!
};

// Global buffers
const playerCache = new Map<string, any>();
const statsBuffer: any[] = [];
const playersBuffer: any[] = [];
const teamCache = new Map<number, any>();

// Tracking
let totalGamesProcessed = 0;
let totalStatsCollected = 0;
let totalStatsInserted = 0;
let totalPlayersCreated = 0;
let apiCallCount = 0;
let startTime = Date.now();

// Progress bars
const multibar = new cliProgress.MultiBar({
  clearOnComplete: false,
  hideCursor: true,
  format: '{bar} | {name} | {value}/{total} | {percentage}% | {rate}/s | ETA: {eta}s'
}, cliProgress.Presets.shades_classic);

// NBA Fantasy Points Calculation (Enhanced)
function calculateNBAFantasyPoints(stats: any): number {
  let points = 0;
  
  // DraftKings scoring system
  points += (stats.pts || 0) * 1;         // Points
  points += (stats.reb || 0) * 1.25;      // Rebounds
  points += (stats.ast || 0) * 1.5;       // Assists
  points += (stats.stl || 0) * 2;         // Steals
  points += (stats.blk || 0) * 2;         // Blocks
  points -= (stats.turnover || 0) * 0.5;  // Turnovers
  
  // Three-point bonus
  points += (stats.fg3m || 0) * 0.5;      // 3-pointers made
  
  // Double-double / Triple-double bonuses
  const statCategories = [
    stats.pts || 0,
    stats.reb || 0,
    stats.ast || 0,
    stats.stl || 0,
    stats.blk || 0
  ];
  const doubleDigitCategories = statCategories.filter(x => x >= 10).length;
  
  if (doubleDigitCategories >= 2) points += 1.5;  // Double-double
  if (doubleDigitCategories >= 3) points += 3;    // Triple-double
  
  return parseFloat(points.toFixed(2));
}

// Fetch all teams first for caching
async function fetchAndCacheTeams() {
  console.log('📋 Fetching NBA teams...');
  try {
    const response = await ballDontLieApi.get('/teams', { params: { per_page: 50 } });
    response.data.data.forEach((team: any) => {
      teamCache.set(team.id, team);
    });
    console.log(`✅ Cached ${teamCache.size} NBA teams`);
  } catch (error) {
    console.error('Failed to fetch teams:', error);
  }
}

// Process games by season
async function processSeasonGames(season: number) {
  console.log(`\n🏀 Processing ${season}-${season + 1} Season...\n`);
  
  const seasonBar = multibar.create(1230, 0, { name: `Season ${season}` }); // ~1230 games per season
  const statsBar = multibar.create(30000, 0, { name: 'Stats' }); // Estimate
  
  let currentCursor = 0;
  let hasMore = true;
  
  while (hasMore) {
    try {
      // Fetch games batch
      const gamesResponse = await ballDontLieApi.get('/games', {
        params: {
          seasons: [season],
          per_page: 100,
          cursor: currentCursor
        }
      });
      
      apiCallCount++;
      const games = gamesResponse.data.data;
      const meta = gamesResponse.data.meta;
      
      // Process each game
      const limit = pLimit(CONFIG.CONCURRENT_API_CALLS);
      const gamePromises = games.map((game: any) => 
        limit(async () => {
          if (game.status !== 'Final') return;
          
          // Store/update game in database
          const gameData = {
            external_id: `balldontlie_${game.id}`,
            sport: 'NBA',
            sport_id: 'nba',
            home_team_id: game.home_team.id,
            away_team_id: game.visitor_team.id,
            home_score: game.home_team_score,
            away_score: game.visitor_team_score,
            start_time: new Date(game.date).toISOString(),
            status: 'final',
            venue: `${game.home_team.full_name} Arena`,
            metadata: {
              season: game.season,
              postseason: game.postseason,
              home_team: game.home_team.full_name,
              away_team: game.visitor_team.full_name,
              balldontlie_id: game.id
            }
          };
          
          const { data: dbGame } = await supabase
            .from('games')
            .upsert(gameData, { onConflict: 'external_id' })
            .select()
            .single();
            
          if (dbGame) {
            // Fetch stats for this game
            const statsCount = await fetchGameStats(dbGame.id, game.id);
            if (statsCount > 0) {
              totalGamesProcessed++;
              seasonBar.increment();
              statsBar.increment(statsCount);
            }
          }
        })
      );
      
      await Promise.all(gamePromises);
      
      // Flush buffers periodically
      await flushBuffers(false);
      
      // Check if more pages
      currentCursor = meta.next_cursor;
      hasMore = currentCursor !== null;
      
      // Rate limit protection
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY_MS));
      }
      
    } catch (error: any) {
      console.error(`\nError processing season ${season}:`, error.message);
      if (error.response?.status === 429) {
        console.log('⏸️  Rate limit hit, waiting 60 seconds...');
        await new Promise(resolve => setTimeout(resolve, 60000));
        continue; // Retry
      }
      break;
    }
  }
}

async function fetchGameStats(gameId: number, ballDontLieGameId: number): Promise<number> {
  try {
    let allStats = [];
    let currentCursor = 0;
    let hasMore = true;
    
    // Fetch all stats for the game
    while (hasMore) {
      const response = await ballDontLieApi.get('/stats', {
        params: {
          game_ids: [ballDontLieGameId],
          per_page: CONFIG.STATS_PER_BATCH,
          cursor: currentCursor
        }
      });
      
      apiCallCount++;
      const { data, meta } = response.data;
      allStats = allStats.concat(data);
      
      currentCursor = meta.next_cursor;
      hasMore = currentCursor !== null;
      
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY_MS));
      }
    }

    let statsCount = 0;

    for (const stat of allStats) {
      const nbaPlayerId = `balldontlie_${stat.player.id}`;
      
      // Cache player data with full info
      if (!playerCache.has(nbaPlayerId)) {
        const team = teamCache.get(stat.team.id) || stat.team;
        const playerData = {
          id: nbaPlayerId,
          espn_id: nbaPlayerId,
          name: `${stat.player.first_name} ${stat.player.last_name}`,
          position: stat.player.position || 'N/A',
          team: team.abbreviation,
          sport: 'NBA',
          metadata: {
            balldontlie_id: stat.player.id,
            team_id: stat.team.id,
            team_name: team.full_name,
            conference: team.conference,
            division: team.division
          }
        };
        playerCache.set(nbaPlayerId, playerData);
        playersBuffer.push(playerData);
      }

      // All possible stats with proper handling
      const allPlayerStats = [
        // Playing time
        { type: 'minutes', value: stat.min ? parseMinutes(stat.min) : 0 },
        
        // Scoring
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
        
        // Rebounds
        { type: 'offensive_rebounds', value: stat.oreb || 0 },
        { type: 'defensive_rebounds', value: stat.dreb || 0 },
        { type: 'total_rebounds', value: stat.reb || 0 },
        
        // Playmaking & Defense
        { type: 'assists', value: stat.ast || 0 },
        { type: 'steals', value: stat.stl || 0 },
        { type: 'blocks', value: stat.blk || 0 },
        { type: 'turnovers', value: stat.turnover || 0 },
        { type: 'personal_fouls', value: stat.pf || 0 },
        
        // Advanced metrics
        { type: 'true_shooting_pct', value: calculateTrueShooting(stat) },
        { type: 'effective_fg_pct', value: calculateEffectiveFG(stat) },
        { type: 'usage_rate', value: calculateUsageRate(stat) },
        { type: 'ast_to_ratio', value: stat.ast && stat.turnover ? (stat.ast / stat.turnover) : 0 }
      ];

      // Add all stats to buffer
      allPlayerStats.forEach(s => {
        // Always include key stats even if 0
        const alwaysInclude = ['minutes', 'points', 'turnovers', 'personal_fouls'];
        if (s.value !== null && s.value !== undefined && (s.value !== 0 || alwaysInclude.includes(s.type))) {
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

      // Fantasy points
      const fantasyPoints = calculateNBAFantasyPoints(stat);
      const doubleDouble = [stat.pts, stat.reb, stat.ast, stat.stl, stat.blk].filter(x => x >= 10).length >= 2;
      const tripleDouble = [stat.pts, stat.reb, stat.ast, stat.stl, stat.blk].filter(x => x >= 10).length >= 3;
      
      statsBuffer.push({
        player_id: nbaPlayerId,
        game_id: gameId,
        stat_type: 'fantasy_points',
        stat_value: fantasyPoints,
        metadata: { 
          dk_points: fantasyPoints,
          double_double: doubleDouble,
          triple_double: tripleDouble,
          team: stat.team.abbreviation
        }
      });
      statsCount++;
    }

    totalStatsCollected += statsCount;
    return statsCount;

  } catch (error: any) {
    if (error.response?.status === 429) {
      console.log('⏸️  Rate limit hit, waiting...');
      await new Promise(resolve => setTimeout(resolve, 60000));
      return fetchGameStats(gameId, ballDontLieGameId);
    }
    return 0;
  }
}

// Helper functions
function parseMinutes(minString: string): number {
  if (!minString || minString === '00' || minString === '00:00') return 0;
  const parts = minString.split(':');
  return parseInt(parts[0]) + (parseInt(parts[1] || '0') / 60);
}

function calculateTrueShooting(stat: any): number {
  const pts = stat.pts || 0;
  const fga = stat.fga || 0;
  const fta = stat.fta || 0;
  if (fga + 0.44 * fta === 0) return 0;
  return pts / (2 * (fga + 0.44 * fta));
}

function calculateEffectiveFG(stat: any): number {
  const fgm = stat.fgm || 0;
  const fg3m = stat.fg3m || 0;
  const fga = stat.fga || 0;
  if (fga === 0) return 0;
  return (fgm + 0.5 * fg3m) / fga;
}

function calculateUsageRate(stat: any): number {
  const fga = stat.fga || 0;
  const fta = stat.fta || 0;
  const tov = stat.turnover || 0;
  const min = parseMinutes(stat.min);
  if (min === 0) return 0;
  return ((fga + 0.44 * fta + tov) * 48) / min / 5; // Simplified usage rate
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
    
    const currentTime = Date.now();
    const elapsedMinutes = ((currentTime - startTime) / 1000 / 60).toFixed(1);
    const statsPerSecond = (totalStatsInserted / ((currentTime - startTime) / 1000)).toFixed(0);
    
    console.log(`\n💾 [${elapsedMinutes}m] Flushing ${batches.length} mega batches (${batches.reduce((sum, b) => sum + b.length, 0)} stats) | ${statsPerSecond} stats/sec`);
    
    for (const batch of batches) {
      const { error } = await supabase
        .from('player_stats')
        .insert(batch);
        
      if (!error) {
        totalStatsInserted += batch.length;
      } else if (!error.message.includes('duplicate')) {
        console.error(`Warning: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.DB_DELAY_MS));
    }
  }
}

// Main processing function
async function processAllNBAData() {
  startTime = Date.now();
  
  // Fetch and cache teams
  await fetchAndCacheTeams();
  
  // Process each season
  for (const season of CONFIG.SEASONS) {
    await processSeasonGames(season);
  }
  
  // Final flush
  console.log('\n🏁 Final flush of remaining data...');
  await flushBuffers(true);
  
  multibar.stop();
  
  // Performance summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n✅ NBA MEGA BATCH PROCESSING COMPLETE! 🏆\n');
  console.log(`⏱️  Total Time: ${(elapsedTime / 60).toFixed(1)} minutes`);
  console.log(`🏀 Games Processed: ${totalGamesProcessed.toLocaleString()}`);
  console.log(`📊 Stats Collected: ${totalStatsCollected.toLocaleString()}`);
  console.log(`💾 Stats Inserted: ${totalStatsInserted.toLocaleString()}`);
  console.log(`👥 Players Created: ${totalPlayersCreated.toLocaleString()}`);
  console.log(`🌐 API Calls Made: ${apiCallCount.toLocaleString()}`);
  console.log(`🚀 Performance: ${(totalStatsInserted / elapsedTime).toFixed(0)} stats/second`);
  console.log(`⚡ Efficiency: ${(totalStatsCollected / apiCallCount).toFixed(1)} stats per API call`);
  
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
  console.log(`👥 Total NBA Players: ${playerCount?.toLocaleString() || 0}`);
  console.log(`📊 Total NBA Stats: ${statsCount?.toLocaleString() || 0}`);
  
  console.log('\n🎯 10X ACHIEVEMENT UNLOCKED! 🎯');
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
  await processAllNBAData();
}

main().catch(console.error);