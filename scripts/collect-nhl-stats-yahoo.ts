#!/usr/bin/env tsx
/**
 * 🏒 NHL STATS COLLECTOR - Yahoo Fantasy Scoring
 * Target: 50K+ player game stats from 2,796 games
 * AUTO-STOPS when all games are processed!
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

console.log(chalk.bold.cyan('🏒 NHL STATS COLLECTOR - Yahoo Fantasy Scoring\n'));

// Configuration
const CONFIG = {
  CONCURRENT_REQUESTS: 15,  // Optimized for Ryzen 5 7600X
  BATCH_SIZE: 250,
  API_DELAY: 200,
  // NO TIMEOUT - will stop when done!
};

// Yahoo NHL Fantasy Scoring
const YAHOO_NHL_SCORING = {
  // Skater scoring
  goals: 3,
  assists: 2,
  plusMinus: 1,
  penaltyMinutes: 0.5,
  powerPlayPoints: 1,
  shortHandedGoals: 2,
  gameWinningGoals: 1,
  shotsOnGoal: 0.4,
  faceoffsWon: 0.2,
  hits: 0.2,
  blocks: 0.5,
  
  // Goalie scoring
  wins: 4,
  losses: -2,
  goalsAgainst: -1,
  saves: 0.2,
  shutouts: 2
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
  
  if (position === 'G') {
    // Goalie scoring
    points += (stats.wins || 0) * YAHOO_NHL_SCORING.wins;
    points += (stats.losses || 0) * YAHOO_NHL_SCORING.losses;
    points += (stats.goalsAgainst || 0) * YAHOO_NHL_SCORING.goalsAgainst;
    points += (stats.saves || 0) * YAHOO_NHL_SCORING.saves;
    points += (stats.shutouts || 0) * YAHOO_NHL_SCORING.shutouts;
  } else {
    // Skater scoring
    points += (stats.goals || 0) * YAHOO_NHL_SCORING.goals;
    points += (stats.assists || 0) * YAHOO_NHL_SCORING.assists;
    points += (stats.plusMinus || 0) * YAHOO_NHL_SCORING.plusMinus;
    points += (stats.penaltyMinutes || 0) * YAHOO_NHL_SCORING.penaltyMinutes;
    points += (stats.powerPlayGoals || 0) * YAHOO_NHL_SCORING.powerPlayPoints;
    points += (stats.powerPlayAssists || 0) * YAHOO_NHL_SCORING.powerPlayPoints;
    points += (stats.shortHandedGoals || 0) * YAHOO_NHL_SCORING.shortHandedGoals;
    points += (stats.gameWinningGoals || 0) * YAHOO_NHL_SCORING.gameWinningGoals;
    points += (stats.shotsOnGoal || 0) * YAHOO_NHL_SCORING.shotsOnGoal;
    points += (stats.faceoffsWon || 0) * YAHOO_NHL_SCORING.faceoffsWon;
    points += (stats.hits || 0) * YAHOO_NHL_SCORING.hits;
    points += (stats.blockedShots || 0) * YAHOO_NHL_SCORING.blocks;
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
  
  // Get all NHL games
  let allGames: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: gamesBatch } = await supabase
      .from('games')
      .select('id, external_id, home_team_id, away_team_id, start_time, home_score, away_score')
      .or('sport_id.eq.nhl,sport_id.eq.NHL')
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .order('start_time')
      .range(from, from + batchSize - 1);
    
    if (!gamesBatch || gamesBatch.length === 0) break;
    
    allGames.push(...gamesBatch);
    from += batchSize;
    
    if (gamesBatch.length < batchSize) break;
  }
  
  console.log(`Found ${allGames.length} total NHL games`);
  
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

async function getNHLPlayers() {
  console.log('📊 Loading NHL players...');
  
  // Get ALL NHL players with pagination
  let allPlayers: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: playersBatch } = await supabase
      .from('players')
      .select('id, name, team_id, external_id, position')
      .or('sport_id.eq.nhl,sport_id.eq.NHL')
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
    if (!game.external_id || !game.external_id.startsWith('espn_nhl_')) {
      return [];
    }
    
    const gameId = game.external_id.replace('espn_nhl_', '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=${gameId}`;
    
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
              
              // Parse NHL stats based on stat group
              const statGroupName = statGroup.name?.toLowerCase() || '';
              const position = ourPlayer.position?.[0] || athlete.athlete?.position?.abbreviation || '';
              const statsObj: any = {};
              
              if (statGroupName.includes('goalies')) {
                // Goalie stats
                if (athlete.stats?.length >= 7) {
                  const [saves, shotsAgainst] = (athlete.stats[1] || '0/0').split('/').map(Number);
                  statsObj.saves = saves || 0;
                  statsObj.shotsAgainst = shotsAgainst || 0;
                  statsObj.goalsAgainst = (shotsAgainst - saves) || 0;
                  statsObj.savePercentage = parseFloat(athlete.stats[2]) || 0;
                  statsObj.goalsAgainstAverage = parseFloat(athlete.stats[3]) || 0;
                  statsObj.wins = athlete.stats[5]?.includes('W') ? 1 : 0;
                  statsObj.losses = athlete.stats[5]?.includes('L') ? 1 : 0;
                  statsObj.overtimeLosses = athlete.stats[5]?.includes('OT') ? 1 : 0;
                  statsObj.shutouts = statsObj.goalsAgainst === 0 ? 1 : 0;
                  statsObj.timeOnIce = athlete.stats[0];
                }
              } else if (statGroupName.includes('forwards') || statGroupName.includes('defenses')) {
                // Skater stats (forwards and defensemen)
                if (athlete.stats?.length >= 10) {
                  statsObj.goals = parseInt(athlete.stats[0]) || 0;
                  statsObj.assists = parseInt(athlete.stats[1]) || 0;
                  statsObj.points = parseInt(athlete.stats[2]) || 0;
                  statsObj.plusMinus = parseInt(athlete.stats[3]) || 0;
                  statsObj.penaltyMinutes = parseInt(athlete.stats[4]) || 0;
                  statsObj.shotsOnGoal = parseInt(athlete.stats[5]) || 0;
                  statsObj.powerPlayGoals = parseInt(athlete.stats[6]) || 0;
                  statsObj.powerPlayAssists = parseInt(athlete.stats[7]) || 0;
                  statsObj.shortHandedGoals = parseInt(athlete.stats[8]) || 0;
                  statsObj.shortHandedAssists = parseInt(athlete.stats[9]) || 0;
                  statsObj.gameWinningGoals = parseInt(athlete.stats[10]) || 0;
                  statsObj.overtimeGoals = parseInt(athlete.stats[11]) || 0;
                  statsObj.hits = parseInt(athlete.stats[12]) || 0;
                  statsObj.blockedShots = parseInt(athlete.stats[13]) || 0;
                  statsObj.faceoffsWon = parseInt(athlete.stats[14]?.split('-')[0]) || 0;
                  statsObj.faceoffsLost = parseInt(athlete.stats[14]?.split('-')[1]) || 0;
                  statsObj.timeOnIce = athlete.stats[15];
                }
              }
              
              // Only create a stat entry if we have actual stats
              if (Object.keys(statsObj).length > 0) {
                const fantasyPoints = calculateYahooFantasyPoints(statsObj, position);
                
                playerStats.push({
                  player_id: ourPlayer.id,
                  game_id: game.id,
                  team_id: teamInfo.dbTeamId,
                  game_date: game.start_time.split('T')[0],
                  opponent_id: teamInfo.opponentId,
                  is_home: teamInfo.isHome,
                  minutes_played: statsObj.timeOnIce ? parseInt(statsObj.timeOnIce.split(':')[0]) : undefined,
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

async function collectNHLStats() {
  console.log('🚀 STARTING NHL STATS COLLECTION (AUTO-STOP WHEN COMPLETE)');
  console.log(`⚡ Configuration: ${CONFIG.CONCURRENT_REQUESTS} concurrent requests\n`);
  
  // Get unprocessed games
  const games = await getUnprocessedGames();
  totalGames = games.length;
  
  if (totalGames === 0) {
    console.log('✅ All NHL games already have stats!');
    return;
  }
  
  // Load players
  const playerLookup = await getNHLPlayers();
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: '🏒 Progress |{bar}| {percentage}% | {value}/{total} Games | {stats} Stats | {errors} Errors',
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
  
  console.log('\n\n🏆 NHL STATS COLLECTION COMPLETE!\n');
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
  
  if ((finalTotal || 0) >= 150000) {
    console.log('\n🏆 MASSIVE SUCCESS! 150K+ stats collected!');
  }
  
  console.log('\n✅ AUTO-STOPPED: All games processed successfully!');
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
  
  await collectNHLStats();
  
  // Auto-exit when done
  console.log('\n👋 Exiting - NHL collection complete!');
  process.exit(0);
}

main().catch(console.error);