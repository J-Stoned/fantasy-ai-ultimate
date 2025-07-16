#!/usr/bin/env tsx
/**
 * 🏀 NBA STATS COLLECTOR - FIXED VERSION
 * Uses correct boxscore.players structure
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

console.log(chalk.bold.yellow('🏀 NBA STATS COLLECTOR - FIXED VERSION\n'));

// Configuration
const CONFIG = {
  CONCURRENT_REQUESTS: 15,  // Optimized for Ryzen 5 7600X
  BATCH_SIZE: 250,
  API_DELAY: 200,
  TIMEOUT_MINUTES: 40
};

// Yahoo NBA Fantasy Scoring
const YAHOO_NBA_SCORING = {
  points: 1,
  rebounds: 1.2,
  assists: 1.5,
  steals: 3,
  blocks: 3,
  turnovers: -1,
  fgMade: 0.5,
  fgMissed: -0.5,
  ftMade: 0.5,
  ftMissed: -0.5,
  threeMade: 0.5
};

// Tracking
let totalGames = 0;
let processedGames = 0;
let totalStats = 0;
let errorCount = 0;
let unmatchedPlayers = new Set<string>();
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

function calculateYahooFantasyPoints(stats: any): number {
  let points = 0;
  
  // Basic stats
  points += (stats.points || 0) * YAHOO_NBA_SCORING.points;
  points += (stats.total_rebounds || 0) * YAHOO_NBA_SCORING.rebounds;
  points += (stats.assists || 0) * YAHOO_NBA_SCORING.assists;
  points += (stats.steals || 0) * YAHOO_NBA_SCORING.steals;
  points += (stats.blocks || 0) * YAHOO_NBA_SCORING.blocks;
  points += (stats.turnovers || 0) * YAHOO_NBA_SCORING.turnovers;
  
  // Field goals
  points += (stats.field_goals_made || 0) * YAHOO_NBA_SCORING.fgMade;
  const fgMissed = (stats.field_goals_attempted || 0) - (stats.field_goals_made || 0);
  points += fgMissed * YAHOO_NBA_SCORING.fgMissed;
  
  // Free throws
  points += (stats.free_throws_made || 0) * YAHOO_NBA_SCORING.ftMade;
  const ftMissed = (stats.free_throws_attempted || 0) - (stats.free_throws_made || 0);
  points += ftMissed * YAHOO_NBA_SCORING.ftMissed;
  
  // Three pointers (bonus on top of regular FG)
  points += (stats.three_pointers_made || 0) * YAHOO_NBA_SCORING.threeMade;
  
  return Math.round(points * 100) / 100;
}

function normalizePlayerName(name: string): string {
  return name.toLowerCase()
    .replace(/['']/g, '')  // Remove apostrophes
    .replace(/\./g, '')     // Remove periods
    .replace(/jr$/i, '')    // Remove Jr suffix
    .replace(/sr$/i, '')    // Remove Sr suffix
    .replace(/iii$/i, '')   // Remove III suffix
    .replace(/ii$/i, '')    // Remove II suffix
    .replace(/\s+/g, ' ')   // Normalize spaces
    .trim();
}

async function getUnprocessedGames() {
  console.log('📊 Finding games without stats...');
  
  // Get all NBA games
  let allGames: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: gamesBatch } = await supabase
      .from('games')
      .select('id, external_id, home_team_id, away_team_id, start_time, home_score, away_score')
      .or('sport_id.eq.nba,sport_id.eq.NBA')
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .order('start_time')
      .range(from, from + batchSize - 1);
    
    if (!gamesBatch || gamesBatch.length === 0) break;
    
    allGames.push(...gamesBatch);
    from += batchSize;
    
    if (gamesBatch.length < batchSize) break;
  }
  
  console.log(`Found ${allGames.length} total NBA games`);
  
  // Get games that already have stats
  const { data: gamesWithStats } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .in('game_id', allGames.map(g => g.id));
    
  const processedGameIds = new Set(gamesWithStats?.map(g => g.game_id) || []);
  
  // Filter to unprocessed games
  const unprocessedGames = allGames.filter(g => !processedGameIds.has(g.id));
  
  console.log(`Found ${processedGameIds.size} games with stats`);
  console.log(`Need to process ${unprocessedGames.length} games`);
  
  return unprocessedGames;
}

async function getNBAPlayers() {
  console.log('📊 Loading NBA players...');
  
  const { data: players } = await supabase
    .from('players')
    .select('id, name, team_id, external_id')
    .or('sport_id.eq.nba,sport_id.eq.NBA');
  
  if (!players) {
    throw new Error('Failed to load NBA players');
  }
  
  console.log(`✅ Loaded ${players.length} players`);
  
  // Create player lookup by normalized name
  const playerLookup = new Map();
  players.forEach(p => {
    if (p.name) {
      const normalized = normalizePlayerName(p.name);
      playerLookup.set(normalized, p);
      
      // Also try last name only
      const parts = p.name.split(' ');
      if (parts.length > 1) {
        const lastName = normalizePlayerName(parts[parts.length - 1]);
        if (!playerLookup.has(lastName)) {
          playerLookup.set(lastName, p);
        }
      }
    }
  });
  
  return playerLookup;
}

async function fetchGameBoxscore(game: any, playerLookup: Map<string, any>) {
  try {
    if (!game.external_id || !game.external_id.startsWith('espn_nba_')) {
      return [];
    }
    
    const gameId = game.external_id.replace('espn_nba_', '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`;
    
    const response = await axios.get(url, { timeout: 10000 });
    
    if (!response.data.boxscore || !response.data.boxscore.players) {
      return [];
    }
    
    const playerStats: PlayerGameLog[] = [];
    
    // Get team mapping from boxscore.teams for home/away info
    const teamMapping = new Map();
    if (response.data.boxscore.teams) {
      response.data.boxscore.teams.forEach((team: any) => {
        const isHome = team.homeAway === 'home';
        teamMapping.set(team.team.id, {
          isHome,
          dbTeamId: isHome ? game.home_team_id : game.away_team_id,
          opponentId: isHome ? game.away_team_id : game.home_team_id
        });
      });
    }
    
    // Process each team's players using boxscore.players structure
    for (const teamData of response.data.boxscore.players) {
      const espnTeamId = teamData.team?.id;
      const teamInfo = teamMapping.get(espnTeamId);
      
      if (!teamInfo) {
        console.warn(`Could not find team mapping for ESPN team ID: ${espnTeamId}`);
        continue;
      }
      
      // Look for statistics array with athletes
      if (teamData.statistics && Array.isArray(teamData.statistics)) {
        for (const statGroup of teamData.statistics) {
          if (statGroup.athletes && Array.isArray(statGroup.athletes)) {
            for (const athlete of statGroup.athletes) {
              // Try to match by name
              const displayName = athlete.athlete?.displayName;
              if (!displayName) continue;
              
              const normalized = normalizePlayerName(displayName);
              const ourPlayer = playerLookup.get(normalized);
              
              if (!ourPlayer) {
                unmatchedPlayers.add(displayName);
                continue;
              }
              
              // Skip DNP (Did Not Play)
              if (!athlete.stats || athlete.stats.length === 0) continue;
              
              // Parse stats array from ESPN (14 elements)
              const statsArray = athlete.stats;
              
              // Parse shooting stats (format: "made-attempted")
              const [fgMade, fgAttempted] = (statsArray[1] || "0-0").split('-').map(Number);
              const [fg3Made, fg3Attempted] = (statsArray[2] || "0-0").split('-').map(Number);
              const [ftMade, ftAttempted] = (statsArray[3] || "0-0").split('-').map(Number);
              
              const stats = {
                minutes_played: parseInt(statsArray[0]) || 0,
                field_goals_made: fgMade || 0,
                field_goals_attempted: fgAttempted || 0,
                three_pointers_made: fg3Made || 0,
                three_pointers_attempted: fg3Attempted || 0,
                free_throws_made: ftMade || 0,
                free_throws_attempted: ftAttempted || 0,
                offensive_rebounds: parseInt(statsArray[4]) || 0,
                defensive_rebounds: parseInt(statsArray[5]) || 0,
                total_rebounds: parseInt(statsArray[6]) || 0,
                assists: parseInt(statsArray[7]) || 0,
                steals: parseInt(statsArray[8]) || 0,
                blocks: parseInt(statsArray[9]) || 0,
                turnovers: parseInt(statsArray[10]) || 0,
                personal_fouls: parseInt(statsArray[11]) || 0,
                plus_minus: parseInt(statsArray[12]) || 0,
                points: parseInt(statsArray[13]) || 0
              };
              
              const fantasyPoints = calculateYahooFantasyPoints(stats);
              
              playerStats.push({
                player_id: ourPlayer.id,
                game_id: game.id,
                team_id: teamInfo.dbTeamId,
                game_date: game.start_time.split('T')[0],
                opponent_id: teamInfo.opponentId,
                is_home: teamInfo.isHome,
                minutes_played: stats.minutes_played,
                stats,
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

async function collectNBAStats() {
  console.log('🚀 STARTING NBA STATS COLLECTION (FIXED)');
  console.log(`⚡ Configuration: ${CONFIG.CONCURRENT_REQUESTS} concurrent, ${CONFIG.TIMEOUT_MINUTES}min timeout\n`);
  
  // Get unprocessed games
  const games = await getUnprocessedGames();
  totalGames = games.length;
  
  if (totalGames === 0) {
    console.log('✅ All NBA games already have stats!');
    return;
  }
  
  // Load players
  const playerLookup = await getNBAPlayers();
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: '🏀 Progress |{bar}| {percentage}% | {value}/{total} Games | {stats} Stats | {errors} Errors',
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
      const gameStats = await fetchGameBoxscore(game, playerLookup);
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
  
  // Insert stats in batches
  if (allStats.length > 0) {
    console.log('\n💾 Inserting stats in batches...');
    
    let inserted = 0;
    for (let i = 0; i < allStats.length; i += CONFIG.BATCH_SIZE) {
      const batch = allStats.slice(i, i + CONFIG.BATCH_SIZE);
      
      const { data, error } = await supabase
        .from('player_game_logs')
        .upsert(batch, { onConflict: 'player_id,game_id' })
        .select();
      
      if (error) {
        console.error('Batch insert error:', error.message);
      } else if (data) {
        inserted += data.length;
      }
      
      process.stdout.write(`\r💾 Inserted ${inserted} / ${allStats.length} stats`);
    }
    
    totalStats = inserted;
  }
  
  // Final summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\n\n🏆 NBA STATS COLLECTION COMPLETE!\n');
  console.log(`⏱️  Total Time: ${(elapsedTime / 60).toFixed(1)} minutes`);
  console.log(`🎮 Games Processed: ${processedGames} / ${totalGames}`);
  console.log(`📊 Stats Collected: ${totalStats.toLocaleString()}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`⚡ Processing Rate: ${(processedGames / (elapsedTime / 60)).toFixed(1)} games/min`);
  
  if (unmatchedPlayers.size > 0) {
    console.log(`\n⚠️  Found ${unmatchedPlayers.size} unmatched player names`);
    console.log('Sample unmatched players:');
    Array.from(unmatchedPlayers).slice(0, 10).forEach(name => {
      console.log(`  - ${name}`);
    });
  }
  
  // Check final total
  const { count: finalTotal } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📈 Total player_game_logs in database: ${finalTotal?.toLocaleString()}`);
  
  if ((finalTotal || 0) >= 15000) {
    console.log('\n🎯 SUCCESS! 15K+ NBA stats target achieved!');
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
  
  await collectNBAStats();
}

main().catch(console.error);