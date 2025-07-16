#!/usr/bin/env tsx
/**
 * 🏈 NFL STATS COLLECTOR - Yahoo Fantasy Scoring with DEDUPLICATION
 * Designed for daily runs without conflicts
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.green('🏈 NFL STATS COLLECTOR - Yahoo Fantasy Scoring (Daily-Ready)\n'));

// Configuration
const CONFIG = {
  CONCURRENT_REQUESTS: 20,
  BATCH_SIZE: 250,
  API_DELAY: 100,
  TIMEOUT_MINUTES: 30,
  // For daily runs, we might want to limit to recent games
  DAYS_BACK: process.env.NFL_DAYS_BACK ? parseInt(process.env.NFL_DAYS_BACK) : null
};

// Yahoo NFL Fantasy Scoring
const YAHOO_NFL_SCORING = {
  // Passing
  passingYards: 0.04,      // 1 point per 25 yards
  passingTD: 4,
  interceptions: -1,
  
  // Rushing
  rushingYards: 0.1,       // 1 point per 10 yards
  rushingTD: 6,
  
  // Receiving
  receptions: 0.5,         // PPR
  receivingYards: 0.1,     // 1 point per 10 yards
  receivingTD: 6,
  
  // Special
  fumblesLost: -2,
  twoPointConversions: 2,
  
  // Kicking
  fieldGoalMade: 3,        // Base, add distance bonus
  fieldGoalMissed: -1,
  extraPointMade: 1,
  extraPointMissed: -1,
  
  // Defense (Team)
  sacks: 1,
  interceptionsDef: 2,
  fumblesRecovered: 2,
  touchdownsDef: 6,
  safeties: 2,
  blockedKicks: 2,
  pointsAllowed0: 10,
  pointsAllowed1_6: 7,
  pointsAllowed7_13: 4,
  pointsAllowed14_20: 1,
  pointsAllowed21_27: 0,
  pointsAllowed28_34: -1,
  pointsAllowed35Plus: -4
};

// Tracking
let totalGames = 0;
let processedGames = 0;
let totalStats = 0;
let errorCount = 0;
const startTime = Date.now();

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

function calculateFieldGoalPoints(distance: number, made: boolean): number {
  if (!made) return YAHOO_NFL_SCORING.fieldGoalMissed;
  
  let points = YAHOO_NFL_SCORING.fieldGoalMade;
  if (distance >= 50) points += 2;
  else if (distance >= 40) points += 1;
  
  return points;
}

function calculateDefensePoints(stats: any): number {
  let points = 0;
  
  // Basic defensive stats
  points += (stats.sacks || 0) * YAHOO_NFL_SCORING.sacks;
  points += (stats.interceptions || 0) * YAHOO_NFL_SCORING.interceptionsDef;
  points += (stats.fumbles_recovered || 0) * YAHOO_NFL_SCORING.fumblesRecovered;
  points += (stats.touchdowns || 0) * YAHOO_NFL_SCORING.touchdownsDef;
  points += (stats.safeties || 0) * YAHOO_NFL_SCORING.safeties;
  points += (stats.blocked_kicks || 0) * YAHOO_NFL_SCORING.blockedKicks;
  
  // Points allowed
  const pointsAllowed = stats.points_allowed || 0;
  if (pointsAllowed === 0) points += YAHOO_NFL_SCORING.pointsAllowed0;
  else if (pointsAllowed <= 6) points += YAHOO_NFL_SCORING.pointsAllowed1_6;
  else if (pointsAllowed <= 13) points += YAHOO_NFL_SCORING.pointsAllowed7_13;
  else if (pointsAllowed <= 20) points += YAHOO_NFL_SCORING.pointsAllowed14_20;
  else if (pointsAllowed <= 27) points += YAHOO_NFL_SCORING.pointsAllowed21_27;
  else if (pointsAllowed <= 34) points += YAHOO_NFL_SCORING.pointsAllowed28_34;
  else points += YAHOO_NFL_SCORING.pointsAllowed35Plus;
  
  return points;
}

function calculateYahooFantasyPoints(stats: any, position?: string): number {
  let points = 0;
  
  // Passing
  points += (stats.passing_yards || 0) * YAHOO_NFL_SCORING.passingYards;
  points += (stats.passing_touchdowns || 0) * YAHOO_NFL_SCORING.passingTD;
  points += (stats.interceptions || 0) * YAHOO_NFL_SCORING.interceptions;
  
  // Rushing
  points += (stats.rushing_yards || 0) * YAHOO_NFL_SCORING.rushingYards;
  points += (stats.rushing_touchdowns || 0) * YAHOO_NFL_SCORING.rushingTD;
  
  // Receiving
  points += (stats.receptions || 0) * YAHOO_NFL_SCORING.receptions;
  points += (stats.receiving_yards || 0) * YAHOO_NFL_SCORING.receivingYards;
  points += (stats.receiving_touchdowns || 0) * YAHOO_NFL_SCORING.receivingTD;
  
  // Misc
  points += (stats.fumbles_lost || 0) * YAHOO_NFL_SCORING.fumblesLost;
  points += (stats.two_point_conversions || 0) * YAHOO_NFL_SCORING.twoPointConversions;
  
  // Kicking
  if (position === 'K' || stats.field_goals_made !== undefined) {
    points += (stats.field_goals_made || 0) * YAHOO_NFL_SCORING.fieldGoalMade;
    points += (stats.field_goals_missed || 0) * YAHOO_NFL_SCORING.fieldGoalMissed;
    points += (stats.extra_points_made || 0) * YAHOO_NFL_SCORING.extraPointMade;
    points += (stats.extra_points_missed || 0) * YAHOO_NFL_SCORING.extraPointMissed;
  }
  
  // Defense
  if (position === 'DST') {
    points = calculateDefensePoints(stats);
  }
  
  return Math.round(points * 100) / 100;
}

async function getGamesToProcess() {
  console.log('📊 Finding games to process...');
  
  // Build query for NFL games
  let query = supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id, start_time, home_score, away_score')
    .eq('sport_id', 'nfl')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false });
  
  // If DAYS_BACK is set, only get recent games (for daily runs)
  if (CONFIG.DAYS_BACK) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CONFIG.DAYS_BACK);
    query = query.gte('start_time', cutoffDate.toISOString());
    console.log(`  Limiting to games from last ${CONFIG.DAYS_BACK} days`);
  }
  
  const { data: games, error } = await query;
  
  if (error) {
    console.error('Error fetching games:', error);
    return [];
  }
  
  // Get games that already have stats
  const gameIds = games?.map(g => g.id) || [];
  const { data: existingStats } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .in('game_id', gameIds);
  
  const gamesWithStats = new Set(existingStats?.map(s => s.game_id) || []);
  const gamesToProcess = games?.filter(g => !gamesWithStats.has(g.id)) || [];
  
  console.log(`Found ${games?.length || 0} total games`);
  console.log(`Found ${gamesWithStats.size} games with stats`);
  console.log(`Need to process ${gamesToProcess.length} games`);
  
  return gamesToProcess;
}

async function fetchGameBoxscore(game: any) {
  try {
    if (!game.external_id || !game.external_id.startsWith('espn_nfl_')) {
      return [];
    }
    
    const gameId = game.external_id.replace('espn_nfl_', '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${gameId}`;
    
    const response = await axios.get(url, { timeout: 10000 });
    
    if (!response.data.boxscore || !response.data.boxscore.players) {
      return [];
    }
    
    const playerStats: PlayerGameLog[] = [];
    const seenPlayers = new Set<string>(); // Track player-game combinations
    
    // Process each team's players
    for (const teamData of response.data.boxscore.players) {
      const isHome = teamData.team.homeAway === 'home';
      const teamId = isHome ? game.home_team_id : game.away_team_id;
      const opponentId = isHome ? game.away_team_id : game.home_team_id;
      
      if (!teamData.statistics || teamData.statistics.length === 0) continue;
      
      // Process each stat category (passing, rushing, receiving, etc.)
      for (const statCategory of teamData.statistics) {
        const athletes = statCategory.athletes || [];
        
        for (const athlete of athletes) {
          if (!athlete.athlete || !athlete.stats || athlete.stats.length === 0) continue;
          
          const playerId = parseInt(athlete.athlete.id);
          
          // Check for duplicate
          const playerGameKey = `${playerId}-${game.id}`;
          if (seenPlayers.has(playerGameKey)) {
            continue; // Skip duplicate
          }
          seenPlayers.add(playerGameKey);
          
          const statsObj: any = {};
          const position = athlete.athlete.position?.abbreviation;
          
          // Parse stats based on category
          const categoryName = statCategory.name?.toLowerCase() || '';
          
          if (categoryName.includes('passing')) {
            statsObj.completions = parseInt(athlete.stats[0]?.split('/')[0]) || 0;
            statsObj.attempts = parseInt(athlete.stats[0]?.split('/')[1]) || 0;
            statsObj.passing_yards = parseInt(athlete.stats[1]) || 0;
            statsObj.passing_touchdowns = parseInt(athlete.stats[3]) || 0;
            statsObj.interceptions = parseInt(athlete.stats[4]) || 0;
          } else if (categoryName.includes('rushing')) {
            statsObj.carries = parseInt(athlete.stats[0]) || 0;
            statsObj.rushing_yards = parseInt(athlete.stats[1]) || 0;
            statsObj.rushing_touchdowns = parseInt(athlete.stats[3]) || 0;
          } else if (categoryName.includes('receiving')) {
            statsObj.receptions = parseInt(athlete.stats[0]) || 0;
            statsObj.receiving_yards = parseInt(athlete.stats[1]) || 0;
            statsObj.receiving_touchdowns = parseInt(athlete.stats[3]) || 0;
            statsObj.targets = parseInt(athlete.stats[4]) || 0;
          } else if (categoryName.includes('kicking')) {
            const fgText = athlete.stats[0] || '0/0';
            const [fgMade, fgAtt] = fgText.split('/').map(Number);
            statsObj.field_goals_made = fgMade || 0;
            statsObj.field_goals_attempted = fgAtt || 0;
            statsObj.field_goals_missed = (fgAtt - fgMade) || 0;
            
            const xpText = athlete.stats[2] || '0/0';
            const [xpMade, xpAtt] = xpText.split('/').map(Number);
            statsObj.extra_points_made = xpMade || 0;
            statsObj.extra_points_attempted = xpAtt || 0;
            statsObj.extra_points_missed = (xpAtt - xpMade) || 0;
          }
          
          // Only create a stat entry if we have actual stats
          if (Object.keys(statsObj).length > 0) {
            const fantasyPoints = calculateYahooFantasyPoints(statsObj, position);
            
            // Find existing player or merge stats
            const existingPlayerIndex = playerStats.findIndex(p => p.player_id === playerId && p.game_id === game.id);
            
            if (existingPlayerIndex >= 0) {
              // Merge stats
              Object.assign(playerStats[existingPlayerIndex].stats, statsObj);
              playerStats[existingPlayerIndex].fantasy_points = calculateYahooFantasyPoints(
                playerStats[existingPlayerIndex].stats, 
                position
              );
            } else {
              // Add new player stat
              playerStats.push({
                player_id: playerId,
                game_id: game.id,
                team_id: teamId,
                game_date: game.start_time.split('T')[0],
                opponent_id: opponentId,
                is_home: isHome,
                stats: statsObj,
                fantasy_points: fantasyPoints
              });
            }
          }
        }
      }
    }
    
    return playerStats;
    
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      console.log(`⏰ Timeout for game ${game.id}`);
    }
    errorCount++;
    return [];
  }
}

async function collectNFLStats() {
  console.log('🚀 STARTING NFL STATS COLLECTION (DAILY-READY VERSION)');
  console.log(`⚡ Configuration: ${CONFIG.CONCURRENT_REQUESTS} concurrent requests\n`);
  
  // Get games to process
  const games = await getGamesToProcess();
  totalGames = games.length;
  
  if (totalGames === 0) {
    console.log('✅ No new games to process!');
    return;
  }
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: '🏈 Progress |{bar}| {percentage}% | {value}/{total} Games | {stats} Stats | {errors} Errors',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  
  progressBar.start(totalGames, 0, { stats: 0, errors: 0 });
  
  // Process games with concurrency limit
  const limit = pLimit(CONFIG.CONCURRENT_REQUESTS);
  const allStats: PlayerGameLog[] = [];
  
  const promises = games.map((game) => 
    limit(async () => {
      const gameStats = await fetchGameBoxscore(game);
      allStats.push(...gameStats);
      
      processedGames++;
      progressBar.update(processedGames, { 
        stats: allStats.length, 
        errors: errorCount 
      });
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.API_DELAY));
    })
  );
  
  // Set timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Collection timeout')), CONFIG.TIMEOUT_MINUTES * 60 * 1000);
  });
  
  try {
    await Promise.race([Promise.all(promises), timeoutPromise]);
  } catch (error: any) {
    console.log(`\n⏰ Reached ${CONFIG.TIMEOUT_MINUTES}min timeout, saving collected stats...`);
  }
  
  progressBar.stop();
  
  console.log(`\n📊 Collected ${allStats.length} player stats from ${processedGames} games`);
  
  // DEDUPLICATE STATS BEFORE INSERTION
  const uniqueStats = new Map<string, PlayerGameLog>();
  let duplicatesRemoved = 0;
  
  for (const stat of allStats) {
    const key = `${stat.player_id}-${stat.game_id}`;
    if (!uniqueStats.has(key)) {
      uniqueStats.set(key, stat);
    } else {
      duplicatesRemoved++;
    }
  }
  
  if (duplicatesRemoved > 0) {
    console.log(`🔍 Removed ${duplicatesRemoved} duplicate entries`);
  }
  
  const deduplicatedStats = Array.from(uniqueStats.values());
  
  // Insert stats in batches
  if (deduplicatedStats.length > 0) {
    console.log(`\n💾 Inserting ${deduplicatedStats.length} unique stats in batches...`);
    
    let inserted = 0;
    let errorBatches = 0;
    
    for (let i = 0; i < deduplicatedStats.length; i += CONFIG.BATCH_SIZE) {
      const batch = deduplicatedStats.slice(i, i + CONFIG.BATCH_SIZE);
      
      const { data, error } = await supabase
        .from('player_game_logs')
        .upsert(batch, { onConflict: 'player_id,game_id' })
        .select();
      
      if (error) {
        console.error(`\nBatch ${Math.floor(i/CONFIG.BATCH_SIZE)+1} error:`, error.message);
        errorBatches++;
      } else if (data) {
        inserted += data.length;
      }
      
      process.stdout.write(`\r💾 Inserted ${inserted} / ${deduplicatedStats.length} stats (${errorBatches} batch errors)`);
    }
    
    totalStats = inserted;
  }
  
  // Final summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n🏆 NFL STATS COLLECTION COMPLETE!\n');
  console.log(`⏱️  Total Time: ${(elapsedTime / 60).toFixed(1)} minutes`);
  console.log(`🎮 Games Processed: ${processedGames} / ${totalGames}`);
  console.log(`📊 Stats Collected: ${allStats.length.toLocaleString()}`);
  console.log(`🔍 Duplicates Removed: ${duplicatesRemoved}`);
  console.log(`💾 Stats Inserted: ${totalStats.toLocaleString()}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`⚡ Processing Rate: ${(processedGames / (elapsedTime / 60)).toFixed(1)} games/min`);
  
  // Check final total
  const { count: finalTotal } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📈 Total player_game_logs in database: ${finalTotal?.toLocaleString()}`);
  
  if (CONFIG.DAYS_BACK) {
    console.log(`\n📅 Processed games from last ${CONFIG.DAYS_BACK} days`);
  }
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
  
  await collectNFLStats();
}

main().catch(console.error);