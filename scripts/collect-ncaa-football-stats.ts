#!/usr/bin/env tsx
/**
 * 🏈 NCAA FOOTBALL STATS COLLECTOR - ULTRA SPEED EDITION
 * Collects all player stats from 869 games (2024-2025 season)
 * Target: ~150,000 stats with Yahoo Fantasy scoring
 * Optimized for Ryzen 5 7600X with aggressive batching
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.red('🏈 NCAA FOOTBALL STATS COLLECTOR - ULTRA SPEED EDITION\n'));

// AGGRESSIVE CONFIGURATION
const CONFIG = {
  CONCURRENT_REQUESTS: 20,     // Maxed out for Ryzen 5
  DB_QUERY_BATCH: 1000,        // Database query limit
  INSERT_BATCH: 900,           // Just under Supabase limit
  COLLECTION_BATCH: 1000,      // Process 1000 games at once
  MAX_MEMORY_RECORDS: 100000,  // Hold 100K records in memory
  SAVE_INTERVAL: 50000,        // Save every 50K records
  ESPN_API: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football',
  SPORT_ID: 'NCAA_FB',
  API_DELAY: 50,
  NO_TIMEOUT: true
};

// Yahoo College Football Fantasy Scoring
const YAHOO_CFB_SCORING = {
  // Passing
  passingYards: 0.04,      // 1 point per 25 yards
  passingTDs: 4,
  interceptions: -2,
  
  // Rushing
  rushingYards: 0.1,       // 1 point per 10 yards
  rushingTDs: 6,
  
  // Receiving
  receivingYards: 0.1,     // 1 point per 10 yards
  receivingTDs: 6,
  receptions: 0,           // No PPR in standard
  
  // Special
  twoPointConversions: 2,
  fumbles: -2,
  
  // Kicking
  fieldGoalsMade: 3,
  fieldGoals50Plus: 1,     // Bonus
  extraPoints: 1,
  
  // Defense/ST
  defensiveTDs: 6,
  safeties: 2,
  sacks: 1,
  interceptionsDef: 2,
  fumblesRecovered: 2
};

// Progress tracking
let totalGames = 0;
let processedGames = 0;
let totalStats = 0;
let errorCount = 0;
const startTime = Date.now();
const limit = pLimit(CONFIG.CONCURRENT_REQUESTS);

// Progress bar
const progressBar = new cliProgress.SingleBar({
  format: 'NCAA Football Stats |{bar}| {percentage}% | {value}/{total} games | {stats} stats | {duration_formatted}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
});

interface PlayerGameLog {
  player_id: number;
  game_id: number;
  team_id: number;
  game_date: string;
  opponent_id: number;
  is_home: boolean;
  minutes_played?: number;
  stats: any;
  fantasy_points: number;
}

/**
 * Calculate Yahoo fantasy points for college football
 */
function calculateYahooFantasyPoints(stats: any): number {
  let points = 0;
  
  // Passing
  points += (stats.passing?.yards || 0) * YAHOO_CFB_SCORING.passingYards;
  points += (stats.passing?.touchdowns || 0) * YAHOO_CFB_SCORING.passingTDs;
  points += (stats.passing?.interceptions || 0) * YAHOO_CFB_SCORING.interceptions;
  
  // Rushing
  points += (stats.rushing?.yards || 0) * YAHOO_CFB_SCORING.rushingYards;
  points += (stats.rushing?.touchdowns || 0) * YAHOO_CFB_SCORING.rushingTDs;
  
  // Receiving
  points += (stats.receiving?.yards || 0) * YAHOO_CFB_SCORING.receivingYards;
  points += (stats.receiving?.touchdowns || 0) * YAHOO_CFB_SCORING.receivingTDs;
  points += (stats.receiving?.receptions || 0) * YAHOO_CFB_SCORING.receptions;
  
  // Special
  points += (stats.fumbles?.lost || 0) * YAHOO_CFB_SCORING.fumbles;
  
  // Kicking
  if (stats.kicking) {
    points += (stats.kicking.fieldGoalsMade || 0) * YAHOO_CFB_SCORING.fieldGoalsMade;
    points += (stats.kicking.fieldGoals50Plus || 0) * YAHOO_CFB_SCORING.fieldGoals50Plus;
    points += (stats.kicking.extraPointsMade || 0) * YAHOO_CFB_SCORING.extraPoints;
  }
  
  // Defense
  if (stats.defense) {
    points += (stats.defense.touchdowns || 0) * YAHOO_CFB_SCORING.defensiveTDs;
    points += (stats.defense.sacks || 0) * YAHOO_CFB_SCORING.sacks;
    points += (stats.defense.interceptions || 0) * YAHOO_CFB_SCORING.interceptionsDef;
    points += (stats.defense.fumblesRecovered || 0) * YAHOO_CFB_SCORING.fumblesRecovered;
  }
  
  return Math.round(points * 100) / 100;
}

/**
 * Get games that need stats
 */
async function getGamesNeedingStats(): Promise<any[]> {
  console.log('📊 Finding games without stats...');
  
  // Get all completed NCAA Football games
  const allGames: any[] = [];
  let from = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('games')
      .select('id, external_id, home_team_id, away_team_id, start_time, home_score, away_score, metadata')
      .eq('sport', CONFIG.SPORT_ID)
      .eq('status', 'STATUS_FINAL')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .range(from, from + CONFIG.DB_QUERY_BATCH - 1);
    
    if (error) {
      console.error('Error fetching games:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allGames.push(...data);
    from += CONFIG.DB_QUERY_BATCH;
    
    if (data.length < CONFIG.DB_QUERY_BATCH) break;
  }
  
  console.log(`Found ${allGames.length} completed NCAA Football games`);
  
  // Check which games already have stats
  const gameIds = allGames.map(g => g.id);
  const gamesWithStats = new Set<number>();
  
  for (let i = 0; i < gameIds.length; i += CONFIG.DB_QUERY_BATCH) {
    const batch = gameIds.slice(i, i + CONFIG.DB_QUERY_BATCH);
    
    const { data } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', batch);
    
    if (data) {
      data.forEach(log => gamesWithStats.add(log.game_id));
    }
  }
  
  // Filter out games that already have stats
  const gamesNeedingStats = allGames.filter(game => !gamesWithStats.has(game.id));
  console.log(`${gamesNeedingStats.length} games need stats collection`);
  
  return gamesNeedingStats;
}

/**
 * Get player mappings
 */
async function getPlayerMappings(): Promise<Map<string, any>> {
  console.log('📊 Loading player mappings...');
  
  const playerMap = new Map();
  let from = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select('id, name, team_id, external_id')
      .eq('sport_id', CONFIG.SPORT_ID)
      .range(from, from + CONFIG.DB_QUERY_BATCH - 1);
    
    if (error) {
      console.error('Error fetching players:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    data.forEach(player => {
      // Map by ESPN ID
      if (player.external_id) {
        const espnId = player.external_id.replace('espn_ncaaf_', '');
        playerMap.set(espnId, player);
      }
    });
    
    from += CONFIG.DB_QUERY_BATCH;
    if (data.length < CONFIG.DB_QUERY_BATCH) break;
  }
  
  console.log(`Loaded ${playerMap.size} player mappings`);
  return playerMap;
}

/**
 * Fetch game stats from ESPN
 */
async function fetchGameStats(game: any, playerMap: Map<string, any>): Promise<PlayerGameLog[]> {
  const stats: PlayerGameLog[] = [];
  
  try {
    const url = `${CONFIG.ESPN_API}/summary?event=${game.external_id}`;
    const response = await axios.get(url);
    
    if (!response.data?.boxscore?.players) {
      return stats;
    }
    
    // Process each team's players
    for (const teamData of response.data.boxscore.players) {
      const teamId = teamData.team.id;
      const isHome = teamId === game.metadata?.home_team_espn_id;
      const currentTeamId = isHome ? game.home_team_id : game.away_team_id;
      const opponentId = isHome ? game.away_team_id : game.home_team_id;
      
      // Process statistics by category
      if (teamData.statistics) {
        for (const category of teamData.statistics) {
          const categoryName = category.name?.toLowerCase();
          
          if (category.athletes) {
            for (const athlete of category.athletes) {
              const player = playerMap.get(athlete.athlete.id);
              
              if (!player) continue;
              
              // Parse stats based on category
              const statsObj: any = {};
              
              if (categoryName === 'passing') {
                statsObj.passing = {
                  completions: parseInt(athlete.stats[0]) || 0,
                  attempts: parseInt(athlete.stats[1]) || 0,
                  yards: parseInt(athlete.stats[2]) || 0,
                  touchdowns: parseInt(athlete.stats[3]) || 0,
                  interceptions: parseInt(athlete.stats[4]) || 0
                };
              } else if (categoryName === 'rushing') {
                statsObj.rushing = {
                  carries: parseInt(athlete.stats[0]) || 0,
                  yards: parseInt(athlete.stats[1]) || 0,
                  average: parseFloat(athlete.stats[2]) || 0,
                  touchdowns: parseInt(athlete.stats[3]) || 0,
                  long: parseInt(athlete.stats[4]) || 0
                };
              } else if (categoryName === 'receiving') {
                statsObj.receiving = {
                  receptions: parseInt(athlete.stats[0]) || 0,
                  yards: parseInt(athlete.stats[1]) || 0,
                  average: parseFloat(athlete.stats[2]) || 0,
                  touchdowns: parseInt(athlete.stats[3]) || 0,
                  long: parseInt(athlete.stats[4]) || 0
                };
              } else if (categoryName === 'kicking') {
                statsObj.kicking = {
                  fieldGoalsMade: parseInt(athlete.stats[0]?.split('/')[0]) || 0,
                  fieldGoalsAttempted: parseInt(athlete.stats[0]?.split('/')[1]) || 0,
                  fieldGoalPct: parseFloat(athlete.stats[1]) || 0,
                  extraPointsMade: parseInt(athlete.stats[3]?.split('/')[0]) || 0,
                  extraPointsAttempted: parseInt(athlete.stats[3]?.split('/')[1]) || 0
                };
              } else if (categoryName === 'defensive') {
                statsObj.defense = {
                  tackles: parseInt(athlete.stats[0]) || 0,
                  soloTackles: parseInt(athlete.stats[1]) || 0,
                  sacks: parseFloat(athlete.stats[2]) || 0,
                  tacklesForLoss: parseFloat(athlete.stats[3]) || 0,
                  interceptions: parseInt(athlete.stats[4]) || 0,
                  fumblesRecovered: parseInt(athlete.stats[6]) || 0
                };
              }
              
              // Find existing stat entry or create new one
              let existingStat = stats.find(s => s.player_id === player.id);
              
              if (!existingStat) {
                existingStat = {
                  player_id: player.id,
                  game_id: game.id,
                  team_id: currentTeamId,
                  game_date: new Date(game.start_time).toISOString().split('T')[0],
                  opponent_id: opponentId,
                  is_home: isHome,
                  stats: {},
                  fantasy_points: 0
                };
                stats.push(existingStat);
              }
              
              // Merge stats
              Object.assign(existingStat.stats, statsObj);
            }
          }
        }
      }
    }
    
    // Calculate fantasy points for all players
    stats.forEach(stat => {
      stat.fantasy_points = calculateYahooFantasyPoints(stat.stats);
    });
    
  } catch (error: any) {
    // Silently skip games with errors
  }
  
  return stats;
}

/**
 * Save stats to database
 */
async function saveStats(stats: PlayerGameLog[]): Promise<number> {
  if (stats.length === 0) return 0;
  
  let inserted = 0;
  
  // Insert in batches
  for (let i = 0; i < stats.length; i += CONFIG.INSERT_BATCH) {
    const batch = stats.slice(i, Math.min(i + CONFIG.INSERT_BATCH, stats.length));
    
    const { data, error } = await supabase
      .from('player_game_logs')
      .insert(batch.map(stat => ({
        ...stat,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })))
      .select();
    
    if (error) {
      console.error(`\n❌ Error inserting batch:`, error.message);
      errorCount += batch.length;
    } else {
      inserted += data?.length || 0;
    }
  }
  
  return inserted;
}

/**
 * Main collection function
 */
async function collectNCAAFootballStats() {
  console.log(chalk.cyan('Starting NCAA Football stats collection...\n'));
  
  // Get games needing stats
  const games = await getGamesNeedingStats();
  totalGames = games.length;
  
  if (totalGames === 0) {
    console.log(chalk.yellow('✅ All NCAA Football games already have stats!'));
    return;
  }
  
  // Get player mappings
  const playerMap = await getPlayerMappings();
  
  // Initialize progress bar
  progressBar.start(totalGames, 0, { stats: 0 });
  
  // Process games in batches
  const statsBuffer: PlayerGameLog[] = [];
  
  for (let i = 0; i < games.length; i += CONFIG.COLLECTION_BATCH) {
    const gameBatch = games.slice(i, Math.min(i + CONFIG.COLLECTION_BATCH, games.length));
    
    // Process batch in parallel
    const batchPromises = gameBatch.map(game =>
      limit(async () => {
        const gameStats = await fetchGameStats(game, playerMap);
        return { game, stats: gameStats };
      })
    );
    
    const results = await Promise.all(batchPromises);
    
    // Collect stats
    for (const result of results) {
      if (result.stats.length > 0) {
        statsBuffer.push(...result.stats);
        totalStats += result.stats.length;
      }
      
      processedGames++;
      progressBar.update(processedGames, { stats: totalStats });
    }
    
    // Save when buffer is full
    if (statsBuffer.length >= CONFIG.SAVE_INTERVAL) {
      await saveStats(statsBuffer);
      statsBuffer.length = 0; // Clear buffer
    }
  }
  
  // Save remaining stats
  if (statsBuffer.length > 0) {
    await saveStats(statsBuffer);
  }
  
  progressBar.stop();
  
  // Summary
  const duration = (Date.now() - startTime) / 1000;
  console.log('\n' + chalk.green('═'.repeat(60)));
  console.log(chalk.bold.green('✅ NCAA FOOTBALL STATS COLLECTION COMPLETE!'));
  console.log(chalk.green('═'.repeat(60)));
  console.log(`Total Games Processed: ${chalk.bold(processedGames)}`);
  console.log(`Total Stats Collected: ${chalk.bold.green(totalStats)}`);
  console.log(`Errors: ${chalk.bold.red(errorCount)}`);
  console.log(`Duration: ${chalk.bold(duration.toFixed(1))}s`);
  console.log(`Rate: ${chalk.bold((totalStats / duration).toFixed(1))} stats/second`);
  console.log(chalk.green('═'.repeat(60)));
}

// Run the collector
collectNCAAFootballStats()
  .then(() => {
    console.log('\n👋 NCAA Football stats collection finished!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });