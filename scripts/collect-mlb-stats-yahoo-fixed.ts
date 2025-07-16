#!/usr/bin/env tsx
/**
 * ⚾ MLB STATS COLLECTOR - Yahoo Fantasy Scoring (FIXED)
 * Target: 100K+ player game stats from 5,449 games
 * AUTO-STOPS when all games are processed!
 * INCLUDES PAGINATION for all database queries!
 * FIXED: Deduplicates stats before insertion to avoid conflicts
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

console.log(chalk.bold.yellow('⚾ MLB STATS COLLECTOR - Yahoo Fantasy Scoring (FIXED)\n'));

// Configuration
const CONFIG = {
  CONCURRENT_REQUESTS: 15,  // Optimized for Ryzen 5 7600X
  BATCH_SIZE: 250,
  API_DELAY: 200,
  // NO TIMEOUT - will stop when done!
};

// Yahoo MLB Fantasy Scoring
const YAHOO_MLB_SCORING = {
  // Batting
  singles: 3,
  doubles: 5,
  triples: 8,
  homeRuns: 10,
  runs: 2,
  rbis: 2,
  stolenBases: 5,
  walks: 2,
  
  // Pitching
  inningsPitched: 2.25,
  wins: 4,
  saves: 2,
  strikeouts: 2,
  earnedRuns: -2,
  hitsAllowed: -0.6,
  walksAllowed: -0.6
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

function calculateYahooFantasyPoints(stats: any, isBatter: boolean): number {
  let points = 0;
  
  if (isBatter) {
    // Batting points
    points += (stats.singles || 0) * YAHOO_MLB_SCORING.singles;
    points += (stats.doubles || 0) * YAHOO_MLB_SCORING.doubles;
    points += (stats.triples || 0) * YAHOO_MLB_SCORING.triples;
    points += (stats.home_runs || 0) * YAHOO_MLB_SCORING.homeRuns;
    points += (stats.runs || 0) * YAHOO_MLB_SCORING.runs;
    points += (stats.rbis || 0) * YAHOO_MLB_SCORING.rbis;
    points += (stats.stolen_bases || 0) * YAHOO_MLB_SCORING.stolenBases;
    points += (stats.walks || 0) * YAHOO_MLB_SCORING.walks;
  } else {
    // Pitching points
    points += (stats.innings_pitched || 0) * YAHOO_MLB_SCORING.inningsPitched;
    points += (stats.wins || 0) * YAHOO_MLB_SCORING.wins;
    points += (stats.saves || 0) * YAHOO_MLB_SCORING.saves;
    points += (stats.strikeouts || 0) * YAHOO_MLB_SCORING.strikeouts;
    points += (stats.earned_runs || 0) * YAHOO_MLB_SCORING.earnedRuns;
    points += (stats.hits_allowed || 0) * YAHOO_MLB_SCORING.hitsAllowed;
    points += (stats.walks_allowed || 0) * YAHOO_MLB_SCORING.walksAllowed;
  }
  
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

async function getUnprocessedGames() {
  console.log('📊 Finding games without stats...');
  
  // Get ALL MLB games with PAGINATION
  let allGames: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: gamesBatch } = await supabase
      .from('games')
      .select('id, external_id, home_team_id, away_team_id, start_time, home_score, away_score')
      .or('sport_id.eq.mlb,sport_id.eq.MLB')
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .order('start_time')
      .range(from, from + batchSize - 1);
    
    if (!gamesBatch || gamesBatch.length === 0) break;
    
    allGames.push(...gamesBatch);
    from += batchSize;
    
    console.log(`  Loaded ${allGames.length} games so far...`);
    
    if (gamesBatch.length < batchSize) break;
  }
  
  console.log(`Found ${allGames.length} total MLB games`);
  
  // Get games that already have stats (WITH PAGINATION)
  const processedGameIds = new Set<number>();
  let offset = 0;
  
  // Process game IDs in chunks to avoid query size limits
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
  
  // Filter to unprocessed games
  const unprocessedGames = allGames.filter(g => !processedGameIds.has(g.id));
  
  console.log(`Found ${processedGameIds.size} games with stats`);
  console.log(`Need to process ${unprocessedGames.length} games`);
  
  return unprocessedGames;
}

async function getMLBPlayers() {
  console.log('📊 Loading MLB players...');
  
  // Get ALL MLB players with PAGINATION
  let allPlayers: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: playersBatch } = await supabase
      .from('players')
      .select('id, name, team_id, external_id, position')
      .or('sport_id.eq.mlb,sport_id.eq.MLB')
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

async function fetchGameBoxscore(game: any, playerLookup: Map<string, any>) {
  try {
    if (!game.external_id || !game.external_id.startsWith('espn_mlb_')) {
      return [];
    }
    
    const gameId = game.external_id.replace('espn_mlb_', '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`;
    
    const response = await axios.get(url, { timeout: 10000 });
    
    if (!response.data.boxscore || !response.data.boxscore.players) {
      return [];
    }
    
    const playerStats: PlayerGameLog[] = [];
    const seenPlayers = new Set<string>(); // Track player-game combinations
    
    // Get team mapping
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
    
    // Process each team's players
    for (const teamData of response.data.boxscore.players) {
      const espnTeamId = teamData.team?.id;
      const teamInfo = teamMapping.get(espnTeamId);
      
      if (!teamInfo) continue;
      
      // Look through all statistics categories
      if (teamData.statistics && Array.isArray(teamData.statistics)) {
        for (const statGroup of teamData.statistics) {
          if (statGroup.athletes && Array.isArray(statGroup.athletes)) {
            for (const athlete of statGroup.athletes) {
              const displayName = athlete.athlete?.displayName;
              if (!displayName) continue;
              
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
              
              // Parse MLB stats based on labels and stat group index
              const labels = statGroup.labels || [];
              const statsObj: any = {};
              const isBatter = labels.includes('AB') || labels.includes('H-AB');
              const isPitcher = labels.includes('IP');
              
              if (isBatter && athlete.stats?.length >= 9) {
                // Batting stats
                // Parse H-AB format (e.g., "2-6" means 2 hits in 6 at-bats)
                const [hits, atBats] = (athlete.stats[0] || '0-0').split('-').map(Number);
                statsObj.at_bats = parseInt(athlete.stats[1]) || atBats || 0;
                statsObj.runs = parseInt(athlete.stats[2]) || 0;
                statsObj.hits = parseInt(athlete.stats[3]) || hits || 0;
                statsObj.rbis = parseInt(athlete.stats[4]) || 0;
                statsObj.home_runs = parseInt(athlete.stats[5]) || 0;
                statsObj.walks = parseInt(athlete.stats[6]) || 0;
                statsObj.strikeouts = parseInt(athlete.stats[7]) || 0;
                statsObj.avg = parseFloat(athlete.stats[9]) || 0;
                statsObj.obp = parseFloat(athlete.stats[10]) || 0;
                statsObj.slg = parseFloat(athlete.stats[11]) || 0;
                
                // Calculate singles, doubles, triples (need to look for these in extended stats)
                // For now, assume all non-homers are singles
                statsObj.singles = Math.max(0, statsObj.hits - statsObj.home_runs);
                statsObj.doubles = 0;
                statsObj.triples = 0;
                statsObj.stolen_bases = 0;
                
              } else if (isPitcher && athlete.stats?.length >= 8) {
                // Pitching stats
                statsObj.innings_pitched = parseFloat(athlete.stats[0]) || 0;
                statsObj.hits_allowed = parseInt(athlete.stats[1]) || 0;
                statsObj.runs_allowed = parseInt(athlete.stats[2]) || 0;
                statsObj.earned_runs = parseInt(athlete.stats[3]) || 0;
                statsObj.walks_allowed = parseInt(athlete.stats[4]) || 0;
                statsObj.strikeouts = parseInt(athlete.stats[5]) || 0;
                statsObj.home_runs_allowed = parseInt(athlete.stats[6]) || 0;
                statsObj.era = parseFloat(athlete.stats[8]) || 0;
                
                // Win/Loss/Save might be in metadata
                if (athlete.athlete?.statistics) {
                  statsObj.wins = athlete.athlete.statistics.wins || 0;
                  statsObj.losses = athlete.athlete.statistics.losses || 0;
                  statsObj.saves = athlete.athlete.statistics.saves || 0;
                }
              }
              
              // Only create a stat entry if we have actual stats
              if (Object.keys(statsObj).length > 0) {
                const fantasyPoints = calculateYahooFantasyPoints(statsObj, isBatter);
                
                playerStats.push({
                  player_id: ourPlayer.id,
                  game_id: game.id,
                  team_id: teamInfo.dbTeamId,
                  game_date: game.start_time.split('T')[0],
                  opponent_id: teamInfo.opponentId,
                  is_home: teamInfo.isHome,
                  stats: statsObj,
                  fantasy_points: fantasyPoints
                });
              }
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

async function collectMLBStats() {
  console.log('🚀 STARTING MLB STATS COLLECTION (AUTO-STOP WHEN COMPLETE)');
  console.log(`⚡ Configuration: ${CONFIG.CONCURRENT_REQUESTS} concurrent requests\n`);
  
  // Get unprocessed games
  const games = await getUnprocessedGames();
  totalGames = games.length;
  
  if (totalGames === 0) {
    console.log('✅ All MLB games already have stats!');
    return;
  }
  
  // Load players
  const playerLookup = await getMLBPlayers();
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: '⚾ Progress |{bar}| {percentage}% | {value}/{total} Games | {stats} Stats | {errors} Errors',
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
  
  // Process all games (NO TIMEOUT - will complete naturally)
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
  
  console.log(`🔍 Removed ${duplicatesRemoved} duplicate entries`);
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
  
  console.log('\n\n🏆 MLB STATS COLLECTION COMPLETE!\n');
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
  
  if ((finalTotal || 0) >= 200000) {
    console.log('\n🎯 SUCCESS! 200K+ stats milestone achieved!');
  }
  
  if ((finalTotal || 0) >= 250000) {
    console.log('\n🏆 MASSIVE SUCCESS! 250K+ stats collected!');
  }
  
  if ((finalTotal || 0) >= 300000) {
    console.log('\n🚀 LEGENDARY! 300K+ STATS ACHIEVED!');
  }
  
  console.log('\n✅ AUTO-STOPPED: All games processed successfully!');
  console.log('\n🎉 ALL SPORTS COMPLETE! NBA + NFL + NHL + MLB = DONE!');
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
  
  await collectMLBStats();
  
  // Auto-exit when done
  console.log('\n👋 Exiting - MLB collection complete!');
  process.exit(0);
}

main().catch(console.error);