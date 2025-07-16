#!/usr/bin/env tsx
/**
 * 🏈 NFL STATS COLLECTOR - Yahoo Fantasy Scoring with Player Name Matching
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

console.log(chalk.bold.green('🏈 NFL STATS COLLECTOR - Yahoo Fantasy Scoring (FIXED)\n'));

// Configuration
const CONFIG = {
  CONCURRENT_REQUESTS: 20,
  BATCH_SIZE: 250,
  API_DELAY: 100,
  TIMEOUT_MINUTES: 30
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
  twoPointConversions: 2
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

async function getNFLPlayers() {
  console.log('📊 Loading NFL players...');
  
  let allPlayers: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: playersBatch } = await supabase
      .from('players')
      .select('id, name, team_id, external_id, position')
      .eq('sport_id', 'NFL')
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

async function getGamesToProcess() {
  console.log('📊 Finding games to process...');
  
  let allGames: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: gamesBatch } = await supabase
      .from('games')
      .select('id, external_id, home_team_id, away_team_id, start_time, home_score, away_score')
      .eq('sport_id', 'nfl')
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .order('start_time')
      .range(from, from + batchSize - 1);
    
    if (!gamesBatch || gamesBatch.length === 0) break;
    
    allGames.push(...gamesBatch);
    from += batchSize;
    
    if (gamesBatch.length < batchSize) break;
  }
  
  console.log(`Found ${allGames.length} total NFL games`);
  
  // Get games with stats
  const processedGameIds = new Set<number>();
  const gameIdChunks = [];
  for (let i = 0; i < allGames.length; i += 500) {
    gameIdChunks.push(allGames.slice(i, i + 500).map(g => g.id));
  }
  
  for (const chunk of gameIdChunks) {
    const { data: gamesWithStats } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', chunk);
    
    if (gamesWithStats) {
      gamesWithStats.forEach(g => processedGameIds.add(g.game_id));
    }
  }
  
  const unprocessedGames = allGames.filter(g => !processedGameIds.has(g.id));
  
  console.log(`Found ${processedGameIds.size} games with stats`);
  console.log(`Need to process ${unprocessedGames.length} games`);
  
  return unprocessedGames;
}

async function fetchGameBoxscore(game: any, playerLookup: Map<string, any>) {
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
    const seenPlayers = new Set<string>();
    const playerStatsMap = new Map<number, any>();
    
    // Process each team's players
    for (const teamData of response.data.boxscore.players) {
      const isHome = teamData.team.homeAway === 'home';
      const teamId = isHome ? game.home_team_id : game.away_team_id;
      const opponentId = isHome ? game.away_team_id : game.home_team_id;
      
      if (!teamData.statistics || teamData.statistics.length === 0) continue;
      
      // Process each stat category (passing, rushing, receiving, etc.)
      for (const statCategory of teamData.statistics) {
        const athletes = statCategory.athletes || [];
        const categoryName = statCategory.name?.toLowerCase() || '';
        
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
          
          // Get or create stats object for this player
          if (!playerStatsMap.has(ourPlayer.id)) {
            playerStatsMap.set(ourPlayer.id, {
              player_id: ourPlayer.id,
              game_id: game.id,
              team_id: teamId,
              game_date: game.start_time.split('T')[0],
              opponent_id: opponentId,
              is_home: isHome,
              stats: {},
              fantasy_points: 0
            });
          }
          
          const playerStat = playerStatsMap.get(ourPlayer.id);
          
          // Parse stats based on category
          if (categoryName.includes('passing')) {
            const [completions, attempts] = (athlete.stats[0] || '0/0').split('/').map(Number);
            playerStat.stats.completions = completions || 0;
            playerStat.stats.attempts = attempts || 0;
            playerStat.stats.passing_yards = parseInt(athlete.stats[1]) || 0;
            playerStat.stats.passing_touchdowns = parseInt(athlete.stats[3]) || 0;
            playerStat.stats.interceptions = parseInt(athlete.stats[4]) || 0;
          } else if (categoryName.includes('rushing')) {
            playerStat.stats.carries = parseInt(athlete.stats[0]) || 0;
            playerStat.stats.rushing_yards = parseInt(athlete.stats[1]) || 0;
            playerStat.stats.rushing_touchdowns = parseInt(athlete.stats[3]) || 0;
          } else if (categoryName.includes('receiving')) {
            playerStat.stats.receptions = parseInt(athlete.stats[0]) || 0;
            playerStat.stats.receiving_yards = parseInt(athlete.stats[1]) || 0;
            playerStat.stats.receiving_touchdowns = parseInt(athlete.stats[3]) || 0;
            playerStat.stats.targets = parseInt(athlete.stats[4]) || 0;
          }
        }
      }
    }
    
    // Calculate fantasy points and add to results
    for (const [playerId, stat] of playerStatsMap) {
      stat.fantasy_points = calculateYahooFantasyPoints(stat.stats);
      playerStats.push(stat);
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
  console.log('🚀 STARTING NFL STATS COLLECTION (FIXED VERSION)');
  console.log(`⚡ Configuration: ${CONFIG.CONCURRENT_REQUESTS} concurrent requests\n`);
  
  // Load player lookup first
  const playerLookup = await getNFLPlayers();
  
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
  
  await Promise.all(promises);
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

main().catch(console.error).finally(() => {
  console.log('\n👋 Exiting - NFL collection complete!');
  process.exit(0);
});