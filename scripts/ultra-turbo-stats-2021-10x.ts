#!/usr/bin/env tsx
/**
 * 🔥 ULTRA TURBO STATS COLLECTOR - 10X BEAST MODE 🔥
 * 
 * MAXIMIZED for Ryzen 5 7600X (12 threads) + 32GB RAM
 * - 500 concurrent HTTP requests
 * - Parallel database operations
 * - In-memory caching for ALL lookups
 * - Batch inserts of 10,000 records
 * - Multi-sport parallel processing
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import { Worker } from 'worker_threads';
import os from 'os';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🔥 MAXIMUM PERFORMANCE SETTINGS
const HTTP_LIMIT = pLimit(500); // 500 concurrent HTTP requests!
const DB_LIMIT = pLimit(50); // 50 concurrent DB operations
const BATCH_SIZE = 1000; // Insert 1k records at once (Supabase limit)
const GAME_BATCH = 500; // Process 500 games in parallel

// Global caches - loaded once, used everywhere
const playerCache = new Map<string, number>();
const teamCache = new Map<string, number>();
const existingStatsCache = new Set<string>();

// Season configurations
const SEASONS = {
  NFL: {
    sport: 'NFL',
    urlPath: 'football/nfl',
    start: '2021-09-01',
    end: '2022-02-28',
    expectedStats: 50000
  },
  NBA: {
    sport: 'NBA', 
    urlPath: 'basketball/nba',
    start: '2021-10-19',
    end: '2022-06-16',
    expectedStats: 100000
  },
  MLB: {
    sport: 'MLB',
    urlPath: 'baseball/mlb', 
    start: '2021-04-01',
    end: '2021-11-30',
    expectedStats: 200000
  },
  NHL: {
    sport: 'NHL',
    urlPath: 'hockey/nhl',
    start: '2021-10-12', 
    end: '2022-06-26',
    expectedStats: 80000
  }
};

// Load all data into memory at startup
async function loadAllDataIntoMemory() {
  console.log(chalk.cyan('⚡ LOADING ENTIRE DATABASE INTO MEMORY...'));
  
  const startTime = Date.now();
  
  // Load all players (with pagination - 1K limit)
  console.log(chalk.gray('  Loading players...'));
  let offset = 0;
  let playerCount = 0;
  
  while (true) {
    const { data: players } = await supabase
      .from('players')
      .select('id, external_id, sport')
      .range(offset, offset + 999)
      .order('id');
    
    if (!players || players.length === 0) break;
    
    players.forEach(p => {
      playerCache.set(p.external_id, p.id);
      playerCount++;
    });
    
    offset += players.length;
    if (players.length < 1000) break;
  }
  
  console.log(chalk.green(`  ✅ Loaded ${playerCount.toLocaleString()} players`));
  
  // Load all teams
  console.log(chalk.gray('  Loading teams...'));
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id, sport');
  
  teams?.forEach(t => {
    teamCache.set(t.external_id, t.id);
  });
  
  console.log(chalk.green(`  ✅ Loaded ${teams?.length || 0} teams`));
  
  // Load existing stat game/player combos to avoid duplicates
  console.log(chalk.gray('  Loading existing stats for deduplication...'));
  offset = 0;
  let statCount = 0;
  
  while (true) {
    const { data: stats } = await supabase
      .from('player_game_logs')
      .select('player_id, game_id')
      .range(offset, offset + 999);
    
    if (!stats || stats.length === 0) break;
    
    stats.forEach(s => {
      existingStatsCache.add(`${s.player_id}_${s.game_id}`);
      statCount++;
    });
    
    offset += stats.length;
    if (stats.length < 1000) break;
  }
  
  console.log(chalk.green(`  ✅ Loaded ${statCount.toLocaleString()} existing stat records`));
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(chalk.cyan(`  ⚡ Memory load complete in ${elapsed}s\n`));
}

// Process a single game's stats
async function processGameStats(game: any, sport: string, urlPath: string): Promise<any[]> {
  const gameStats = [];
  
  try {
    const espnGameId = game.external_id.split('_').pop();
    const url = `https://site.api.espn.com/apis/site/v2/sports/${urlPath}/summary?event=${espnGameId}`;
    
    const response = await axios.get(url, { 
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (response.data.boxscore?.players) {
      for (const team of response.data.boxscore.players) {
        const teamExternalId = `espn_${sport.toLowerCase()}_${team.team.id}`;
        const teamId = teamCache.get(teamExternalId);
        
        if (!teamId) continue;
        
        for (const statGroup of team.statistics || []) {
          for (const athlete of statGroup.athletes || []) {
            if (!athlete.stats || athlete.stats.length === 0) continue;
            
            const playerExternalId = `espn_${sport.toLowerCase()}_${athlete.athlete.id}`;
            const playerId = playerCache.get(playerExternalId);
            
            if (!playerId) continue;
            
            // Skip if we already have this stat
            const statKey = `${playerId}_${game.id}`;
            if (existingStatsCache.has(statKey)) continue;
            
            // Parse stats based on sport
            const stats = parseStatsFast(athlete.stats, statGroup.name, sport);
            
            if (Object.keys(stats).length > 0) {
              gameStats.push({
                player_id: playerId,
                game_id: game.id,
                team_id: teamId,
                game_date: new Date(game.start_time).toISOString().split('T')[0],
                is_home: team.homeAway === 'home',
                stats: stats,
                fantasy_points: calculateFantasyPointsFast(stats, sport),
                metadata: {
                  season: '2021',
                  stat_category: statGroup.name,
                  espn_game_id: espnGameId
                }
              });
              
              // Add to cache to prevent duplicates within this run
              existingStatsCache.add(statKey);
            }
          }
        }
      }
    }
  } catch (error) {
    // Silently skip failed games
  }
  
  return gameStats;
}

// Fast stat parsing
function parseStatsFast(statArray: any[], category: string, sport: string): any {
  const stats: any = {};
  
  // Quick mapping based on array position
  if (sport === 'NBA' && statArray.length >= 15) {
    stats.minutes_played = parseFloat(statArray[0]) || 0;
    stats.field_goals_made = parseInt(statArray[1]) || 0;
    stats.field_goals_attempted = parseInt(statArray[2]) || 0;
    stats.three_pointers_made = parseInt(statArray[4]) || 0;
    stats.three_pointers_attempted = parseInt(statArray[5]) || 0;
    stats.free_throws_made = parseInt(statArray[7]) || 0;
    stats.free_throws_attempted = parseInt(statArray[8]) || 0;
    stats.offensive_rebounds = parseInt(statArray[10]) || 0;
    stats.defensive_rebounds = parseInt(statArray[11]) || 0;
    stats.rebounds = parseInt(statArray[12]) || 0;
    stats.assists = parseInt(statArray[13]) || 0;
    stats.steals = parseInt(statArray[14]) || 0;
    stats.blocks = parseInt(statArray[15]) || 0;
    stats.turnovers = parseInt(statArray[16]) || 0;
    stats.fouls = parseInt(statArray[17]) || 0;
    stats.points = parseInt(statArray[19]) || 0;
  } else if (sport === 'NHL' && category.toLowerCase().includes('skater')) {
    stats.goals = parseInt(statArray[0]) || 0;
    stats.assists = parseInt(statArray[1]) || 0;
    stats.points = parseInt(statArray[2]) || 0;
    stats.plus_minus = parseInt(statArray[3]) || 0;
    stats.penalty_minutes = parseInt(statArray[4]) || 0;
    stats.shots_on_goal = parseInt(statArray[12]) || 0;
  } else if (sport === 'MLB' && category.toLowerCase().includes('batting')) {
    stats.at_bats = parseInt(statArray[0]) || 0;
    stats.runs = parseInt(statArray[1]) || 0;
    stats.hits = parseInt(statArray[2]) || 0;
    stats.runs_batted_in = parseInt(statArray[3]) || 0;
    stats.home_runs = parseInt(statArray[4]) || 0;
    stats.walks = parseInt(statArray[5]) || 0;
    stats.strikeouts = parseInt(statArray[6]) || 0;
  } else if (sport === 'NFL') {
    // NFL stats vary by position, just grab key ones
    statArray.forEach((value, index) => {
      if (value && value !== '0' && value !== '-') {
        stats[`stat_${index}`] = parseFloat(value) || value;
      }
    });
  }
  
  return stats;
}

// Fast fantasy points calculation
function calculateFantasyPointsFast(stats: any, sport: string): number {
  switch (sport) {
    case 'NBA':
      return (stats.points || 0) + 
             (stats.rebounds || 0) * 1.2 + 
             (stats.assists || 0) * 1.5 + 
             (stats.steals || 0) * 3 + 
             (stats.blocks || 0) * 3 - 
             (stats.turnovers || 0);
    case 'NHL':
      return (stats.goals || 0) * 3 + 
             (stats.assists || 0) * 2 + 
             (stats.shots_on_goal || 0) * 0.5;
    case 'MLB':
      return (stats.hits || 0) * 3 + 
             (stats.runs || 0) * 2 + 
             (stats.runs_batted_in || 0) * 2 + 
             (stats.home_runs || 0) * 4 + 
             (stats.walks || 0) - 
             (stats.strikeouts || 0) * 0.5;
    default:
      return 0;
  }
}

// Collect stats for a sport
async function collectSportStats(sportKey: string) {
  const config = SEASONS[sportKey as keyof typeof SEASONS];
  console.log(chalk.bold.cyan(`\n${'='.repeat(70)}`));
  console.log(chalk.bold.cyan(`COLLECTING ${config.sport} STATS`));
  console.log(chalk.bold.cyan('='.repeat(70)));
  
  // Get all games for this sport
  console.log(chalk.yellow('📊 Loading games...'));
  
  const allGames = [];
  let offset = 0;
  
  while (true) {
    const { data: games } = await supabase
      .from('games')
      .select('id, external_id, start_time')
      .eq('sport', config.sport)
      .eq('status', 'Final')
      .gte('start_time', config.start)
      .lte('start_time', config.end)
      .range(offset, offset + 999)
      .order('id');
    
    if (!games || games.length === 0) break;
    
    allGames.push(...games);
    offset += games.length;
    
    if (games.length < 1000) break;
  }
  
  console.log(chalk.green(`✅ Found ${allGames.length.toLocaleString()} games`));
  
  // Multi-progress bar
  const multiBar = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: ' {bar} | {percentage}% | {value}/{total} | {speed} games/sec | {sport}'
  }, cliProgress.Presets.shades_classic);
  
  const progressBar = multiBar.create(allGames.length, 0, { speed: 0, sport: config.sport });
  
  const allStats = [];
  let processedGames = 0;
  const startTime = Date.now();
  
  // Process games in massive batches
  for (let i = 0; i < allGames.length; i += GAME_BATCH) {
    const gameBatch = allGames.slice(i, i + GAME_BATCH);
    
    // Process all games in this batch in parallel
    const batchPromises = gameBatch.map(game => 
      HTTP_LIMIT(async () => processGameStats(game, config.sport, config.urlPath))
    );
    
    const batchResults = await Promise.all(batchPromises);
    const batchStats = batchResults.flat();
    
    allStats.push(...batchStats);
    processedGames += gameBatch.length;
    
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const gamesPerSecond = Math.round(processedGames / elapsedSeconds);
    
    progressBar.update(processedGames, { speed: gamesPerSecond });
  }
  
  multiBar.stop();
  
  // Insert all stats in massive batches
  if (allStats.length > 0) {
    console.log(chalk.blue(`\n⚡ Inserting ${allStats.length.toLocaleString()} stats in batches...`));
    
    let inserted = 0;
    for (let i = 0; i < allStats.length; i += BATCH_SIZE) {
      const batch = allStats.slice(i, i + BATCH_SIZE);
      
      const { error } = await DB_LIMIT(async () => 
        supabase.from('player_game_logs').insert(batch)
      );
      
      if (!error) {
        inserted += batch.length;
      }
    }
    
    console.log(chalk.green(`✅ Inserted ${inserted.toLocaleString()} stats`));
  }
  
  return allStats.length;
}

// Main function - process all sports in parallel!
async function ultraTurboCollect() {
  console.log(chalk.bold.red('🔥 ULTRA TURBO STATS COLLECTOR - 10X BEAST MODE'));
  console.log(chalk.yellow('⚡ 500x HTTP | 50x DB | 10K batch inserts'));
  console.log(chalk.yellow(`🔥 ${os.cpus().length} CPU cores | ${(os.totalmem() / 1e9).toFixed(1)}GB RAM\n`));
  
  const totalStartTime = Date.now();
  
  try {
    // Load everything into memory first
    await loadAllDataIntoMemory();
    
    // Process ALL sports in parallel!
    const sportPromises = Object.keys(SEASONS).map(sport => 
      collectSportStats(sport)
    );
    
    const results = await Promise.all(sportPromises);
    
    // Final summary
    const totalElapsed = ((Date.now() - totalStartTime) / 1000 / 60).toFixed(1);
    const totalStats = results.reduce((sum, count) => sum + count, 0);
    
    console.log(chalk.bold.cyan(`\n${'='.repeat(70)}`));
    console.log(chalk.bold.green('✅ ULTRA TURBO COLLECTION COMPLETE!'));
    console.log(chalk.bold.cyan('='.repeat(70)));
    
    console.log(chalk.white(`\n⏱️  Total time: ${totalElapsed} minutes`));
    console.log(chalk.white(`📊 Total stats collected: ${totalStats.toLocaleString()}`));
    console.log(chalk.white(`⚡ Average speed: ${Math.round(totalStats / (parseFloat(totalElapsed) * 60))} stats/second`));
    
    Object.keys(SEASONS).forEach((sport, index) => {
      const config = SEASONS[sport as keyof typeof SEASONS];
      const collected = results[index];
      const percentage = Math.round((collected / config.expectedStats) * 100);
      console.log(chalk.green(`\n${sport}: ${collected.toLocaleString()} stats (${percentage}% of expected)`));
    });
    
    console.log(chalk.bold.red('\n🔥 10X BEAST MODE COMPLETE!'));
    
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
  }
}

// Launch the beast!
ultraTurboCollect()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });