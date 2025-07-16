#!/usr/bin/env tsx
/**
 * 🏈 NFL STATS COLLECTOR - Yahoo Fantasy Scoring
 * Target: 25K+ player game stats from 570 games
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

console.log(chalk.bold.red('🏈 NFL STATS COLLECTOR - Yahoo Fantasy Scoring\n'));

// Configuration
const CONFIG = {
  CONCURRENT_REQUESTS: 15,  // Optimized for Ryzen 5 7600X
  BATCH_SIZE: 250,
  API_DELAY: 200,
  TIMEOUT_MINUTES: 10  // Shorter timeout based on NBA performance
};

// Yahoo NFL Fantasy Scoring (0.5 PPR)
const YAHOO_NFL_SCORING = {
  // Passing
  passingYards: 0.04,      // 1 point per 25 yards
  passingTD: 4,
  interceptions: -1,
  
  // Rushing
  rushingYards: 0.1,       // 1 point per 10 yards
  rushingTD: 6,
  
  // Receiving
  receptions: 0.5,         // 0.5 PPR
  receivingYards: 0.1,     // 1 point per 10 yards
  receivingTD: 6,
  
  // Special
  twoPointConversion: 2,
  fumbleLost: -2,
  
  // Kicking
  fg0_19: 3,
  fg20_29: 3,
  fg30_39: 3,
  fg40_49: 4,
  fg50Plus: 5,
  patMade: 1,
  fgMissed: -1,
  
  // Defense/ST
  sacks: 1,
  interceptionsDef: 2,
  fumbleRecovery: 2,
  defensiveTD: 6,
  safety: 2,
  blockedKick: 2
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

function calculateYahooFantasyPoints(stats: any, position: string): number {
  let points = 0;
  
  // Passing stats
  if (stats.passing) {
    points += (stats.passing.yards || 0) * YAHOO_NFL_SCORING.passingYards;
    points += (stats.passing.touchdowns || 0) * YAHOO_NFL_SCORING.passingTD;
    points += (stats.passing.interceptions || 0) * YAHOO_NFL_SCORING.interceptions;
  }
  
  // Rushing stats
  if (stats.rushing) {
    points += (stats.rushing.yards || 0) * YAHOO_NFL_SCORING.rushingYards;
    points += (stats.rushing.touchdowns || 0) * YAHOO_NFL_SCORING.rushingTD;
  }
  
  // Receiving stats
  if (stats.receiving) {
    points += (stats.receiving.receptions || 0) * YAHOO_NFL_SCORING.receptions;
    points += (stats.receiving.yards || 0) * YAHOO_NFL_SCORING.receivingYards;
    points += (stats.receiving.touchdowns || 0) * YAHOO_NFL_SCORING.receivingTD;
  }
  
  // Fumbles
  if (stats.fumbles) {
    points += (stats.fumbles.lost || 0) * YAHOO_NFL_SCORING.fumbleLost;
  }
  
  // Kicking stats
  if (stats.kicking && position === 'K') {
    const fg = stats.kicking.fieldGoals || {};
    points += (fg.made0_19 || 0) * YAHOO_NFL_SCORING.fg0_19;
    points += (fg.made20_29 || 0) * YAHOO_NFL_SCORING.fg20_29;
    points += (fg.made30_39 || 0) * YAHOO_NFL_SCORING.fg30_39;
    points += (fg.made40_49 || 0) * YAHOO_NFL_SCORING.fg40_49;
    points += (fg.made50Plus || 0) * YAHOO_NFL_SCORING.fg50Plus;
    points += (stats.kicking.extraPointsMade || 0) * YAHOO_NFL_SCORING.patMade;
    points += (stats.kicking.fieldGoalsMissed || 0) * YAHOO_NFL_SCORING.fgMissed;
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
  
  // Get all NFL games
  let allGames: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: gamesBatch } = await supabase
      .from('games')
      .select('id, external_id, home_team_id, away_team_id, start_time, home_score, away_score')
      .or('sport_id.eq.nfl,sport_id.eq.NFL')
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

async function getNFLPlayers() {
  console.log('📊 Loading NFL players...');
  
  // Get ALL NFL players with pagination
  let allPlayers: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: playersBatch } = await supabase
      .from('players')
      .select('id, name, team_id, external_id, position')
      .or('sport_id.eq.nfl,sport_id.eq.NFL')
      .range(from, from + batchSize - 1);
    
    if (!playersBatch || playersBatch.length === 0) break;
    
    allPlayers.push(...playersBatch);
    from += batchSize;
    
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
              
              // Parse NFL stats based on category
              const statType = statGroup.name?.toLowerCase() || '';
              const statsObj: any = {};
              
              if (statType.includes('passing') && athlete.stats?.length >= 9) {
                statsObj.passing = {
                  completions: parseInt(athlete.stats[0]?.split('/')[0]) || 0,
                  attempts: parseInt(athlete.stats[0]?.split('/')[1]) || 0,
                  yards: parseInt(athlete.stats[1]) || 0,
                  yardsPerAttempt: parseFloat(athlete.stats[2]) || 0,
                  touchdowns: parseInt(athlete.stats[3]) || 0,
                  interceptions: parseInt(athlete.stats[4]) || 0,
                  sacks: parseInt(athlete.stats[5]?.split('-')[0]) || 0,
                  qbRating: parseFloat(athlete.stats[8]) || 0
                };
              }
              
              if (statType.includes('rushing') && athlete.stats?.length >= 5) {
                statsObj.rushing = {
                  carries: parseInt(athlete.stats[0]) || 0,
                  yards: parseInt(athlete.stats[1]) || 0,
                  average: parseFloat(athlete.stats[2]) || 0,
                  touchdowns: parseInt(athlete.stats[3]) || 0,
                  long: parseInt(athlete.stats[4]) || 0
                };
              }
              
              if (statType.includes('receiving') && athlete.stats?.length >= 6) {
                statsObj.receiving = {
                  receptions: parseInt(athlete.stats[0]) || 0,
                  targets: parseInt(athlete.stats[1]) || 0,
                  yards: parseInt(athlete.stats[2]) || 0,
                  average: parseFloat(athlete.stats[3]) || 0,
                  touchdowns: parseInt(athlete.stats[4]) || 0,
                  long: parseInt(athlete.stats[5]) || 0
                };
              }
              
              if (statType.includes('fumbles') && athlete.stats?.length >= 2) {
                statsObj.fumbles = {
                  total: parseInt(athlete.stats[0]) || 0,
                  lost: parseInt(athlete.stats[1]) || 0
                };
              }
              
              // Only create a stat entry if we have actual stats
              if (Object.keys(statsObj).length > 0) {
                const fantasyPoints = calculateYahooFantasyPoints(statsObj, ourPlayer.position?.[0] || '');
                
                // Check if we already have this player's stats for this game
                const existingStatIndex = playerStats.findIndex(ps => 
                  ps.player_id === ourPlayer.id && ps.game_id === game.id
                );
                
                if (existingStatIndex >= 0) {
                  // Merge stats
                  playerStats[existingStatIndex].stats = {
                    ...playerStats[existingStatIndex].stats,
                    ...statsObj
                  };
                  playerStats[existingStatIndex].fantasy_points = calculateYahooFantasyPoints(
                    playerStats[existingStatIndex].stats, 
                    ourPlayer.position?.[0] || ''
                  );
                } else {
                  // Create new stat entry
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
  console.log('🚀 STARTING NFL STATS COLLECTION');
  console.log(`⚡ Configuration: ${CONFIG.CONCURRENT_REQUESTS} concurrent, ${CONFIG.TIMEOUT_MINUTES}min timeout\n`);
  
  // Get unprocessed games
  const games = await getUnprocessedGames();
  totalGames = games.length;
  
  if (totalGames === 0) {
    console.log('✅ All NFL games already have stats!');
    return;
  }
  
  // Load players
  const playerLookup = await getNFLPlayers();
  
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
  
  console.log('\n\n🏆 NFL STATS COLLECTION COMPLETE!\n');
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
  
  if ((finalTotal || 0) >= 100000) {
    console.log('\n🎯 SUCCESS! 100K+ stats milestone achieved!');
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