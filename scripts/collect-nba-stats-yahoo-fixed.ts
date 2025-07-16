#!/usr/bin/env tsx
/**
 * 🏀 NBA STATS COLLECTOR - Yahoo Fantasy Scoring with Player Name Matching
 * Fixed to match player names instead of using ESPN IDs directly
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

console.log(chalk.bold.cyan('🏀 NBA STATS COLLECTOR - Yahoo Fantasy Scoring (FIXED)\n'));

// Configuration
const CONFIG = {
  CONCURRENT_REQUESTS: 50,
  BATCH_SIZE: 500,
  API_DELAY: 50,
  TIMEOUT_MINUTES: 30,
  DAYS_BACK: process.env.NBA_DAYS_BACK ? parseInt(process.env.NBA_DAYS_BACK) : null
};

// Yahoo NBA Fantasy Scoring
const YAHOO_NBA_SCORING = {
  points: 1,
  rebounds: 1.2,
  assists: 1.5,
  steals: 3,
  blocks: 3,
  turnovers: -1,
  made3pt: 0.5
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
  
  points += (stats.points || 0) * YAHOO_NBA_SCORING.points;
  points += (stats.rebounds || 0) * YAHOO_NBA_SCORING.rebounds;
  points += (stats.assists || 0) * YAHOO_NBA_SCORING.assists;
  points += (stats.steals || 0) * YAHOO_NBA_SCORING.steals;
  points += (stats.blocks || 0) * YAHOO_NBA_SCORING.blocks;
  points += (stats.turnovers || 0) * YAHOO_NBA_SCORING.turnovers;
  points += (stats.made_3pt || 0) * YAHOO_NBA_SCORING.made3pt;
  
  return Math.round(points * 100) / 100;
}

function normalizePlayerName(name: string): string {
  return name.toLowerCase()
    .replace(/['']/g, '')
    .replace(/\./g, '')
    .replace(/jr$/i, '')
    .replace(/sr$/i, '')
    .replace(/iii$/i, '')
    .replace(/ii$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getNBAPlayers() {
  console.log('📊 Loading NBA players...');
  
  // Get ALL NBA players with PAGINATION
  let allPlayers: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: playersBatch } = await supabase
      .from('players')
      .select('id, name, team_id, external_id, position')
      .eq('sport_id', 'nba')
      .range(from, from + batchSize - 1);
    
    if (!playersBatch || playersBatch.length === 0) break;
    
    allPlayers.push(...playersBatch);
    from += batchSize;
    
    console.log(`  Loaded ${allPlayers.length} players so far...`);
    
    if (playersBatch.length < batchSize) break;
  }
  
  console.log(`✅ Loaded ${allPlayers.length} players`);
  
  // Create player lookup by normalized name
  const playerLookup = new Map();
  allPlayers.forEach(p => {
    if (p.name) {
      const normalized = normalizePlayerName(p.name);
      playerLookup.set(normalized, p);
      
      // Also try last name only (helps with some matches)
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

async function getGamesToProcess() {
  console.log('📊 Finding games to process...');
  
  // Build query for NBA games
  let query = supabase
    .from('games')
    .select('id, external_id, home_team_id, away_team_id, start_time, home_score, away_score')
    .eq('sport_id', 'nba')
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
  const gamesWithStats = new Set<number>();
  
  // Process in chunks to avoid query limits
  for (let i = 0; i < gameIds.length; i += 500) {
    const chunk = gameIds.slice(i, i + 500);
    const { data: existingStats } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', chunk);
    
    existingStats?.forEach(s => gamesWithStats.add(s.game_id));
  }
  
  const gamesToProcess = games?.filter(g => !gamesWithStats.has(g.id)) || [];
  
  console.log(`Found ${games?.length || 0} total games`);
  console.log(`Found ${gamesWithStats.size} games with stats`);
  console.log(`Need to process ${gamesToProcess.length} games`);
  
  return gamesToProcess;
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
    const seenPlayers = new Set<string>(); // Track player-game combinations
    
    // Process each team's players
    for (const teamData of response.data.boxscore.players) {
      const isHome = teamData.team.homeAway === 'home';
      const teamId = isHome ? game.home_team_id : game.away_team_id;
      const opponentId = isHome ? game.away_team_id : game.home_team_id;
      
      if (!teamData.statistics || teamData.statistics.length === 0) continue;
      
      const athletes = teamData.statistics[0].athletes || [];
      
      for (const athlete of athletes) {
        if (!athlete.athlete || !athlete.stats || athlete.stats.length === 0) continue;
        
        const displayName = athlete.athlete.displayName;
        if (!displayName) continue;
        
        // Match player by name
        const normalized = normalizePlayerName(displayName);
        const ourPlayer = playerLookup.get(normalized);
        
        if (!ourPlayer) {
          unmatchedPlayers.add(displayName);
          continue;
        }
        
        // Check for duplicate
        const playerGameKey = `${ourPlayer.id}-${game.id}`;
        if (seenPlayers.has(playerGameKey)) {
          continue; // Skip duplicate
        }
        seenPlayers.add(playerGameKey);
        
        // Parse stats array based on ESPN's format
        const stats = {
          minutes: athlete.stats[0] ? parseInt(athlete.stats[0]) : 0,
          field_goals_made: parseInt(athlete.stats[1]) || 0,
          field_goals_attempted: parseInt(athlete.stats[2]) || 0,
          made_3pt: parseInt(athlete.stats[3]) || 0,
          attempted_3pt: parseInt(athlete.stats[4]) || 0,
          free_throws_made: parseInt(athlete.stats[5]) || 0,
          free_throws_attempted: parseInt(athlete.stats[6]) || 0,
          offensive_rebounds: parseInt(athlete.stats[7]) || 0,
          defensive_rebounds: parseInt(athlete.stats[8]) || 0,
          rebounds: parseInt(athlete.stats[9]) || 0,
          assists: parseInt(athlete.stats[10]) || 0,
          steals: parseInt(athlete.stats[11]) || 0,
          blocks: parseInt(athlete.stats[12]) || 0,
          turnovers: parseInt(athlete.stats[13]) || 0,
          personal_fouls: parseInt(athlete.stats[14]) || 0,
          points: parseInt(athlete.stats[15]) || 0
        };
        
        const fantasyPoints = calculateYahooFantasyPoints(stats);
        
        playerStats.push({
          player_id: ourPlayer.id, // Use our internal ID!
          game_id: game.id,
          team_id: teamId,
          game_date: game.start_time.split('T')[0],
          opponent_id: opponentId,
          is_home: isHome,
          minutes_played: stats.minutes,
          stats: stats,
          fantasy_points: fantasyPoints
        });
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
  console.log('🚀 STARTING NBA STATS COLLECTION (FIXED VERSION)');
  console.log(`⚡ Configuration: ${CONFIG.CONCURRENT_REQUESTS} concurrent requests\n`);
  
  // Load player lookup first
  const playerLookup = await getNBAPlayers();
  
  // Get games to process
  const games = await getGamesToProcess();
  totalGames = games.length;
  
  if (totalGames === 0) {
    console.log('✅ No new games to process!');
    return;
  }
  
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
  
  console.log('\n\n🏆 NBA STATS COLLECTION COMPLETE!\n');
  console.log(`⏱️  Total Time: ${(elapsedTime / 60).toFixed(1)} minutes`);
  console.log(`🎮 Games Processed: ${processedGames} / ${totalGames}`);
  console.log(`📊 Stats Collected: ${allStats.length.toLocaleString()}`);
  console.log(`🔍 Duplicates Removed: ${duplicatesRemoved}`);
  console.log(`💾 Stats Inserted: ${totalStats.toLocaleString()}`);
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
  
  await collectNBAStats();
}

main().catch(console.error).finally(() => {
  console.log('\n👋 Exiting - NBA collection complete!');
  process.exit(0);
});