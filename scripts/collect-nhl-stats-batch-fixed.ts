#!/usr/bin/env tsx
/**
 * 🏒 NHL STATS COLLECTOR - Yahoo Fantasy Scoring with Player Name Matching
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

console.log(chalk.bold.blue('🏒 NHL STATS COLLECTOR - Yahoo Fantasy Scoring (FIXED)\n'));

// Configuration
const CONFIG = {
  CONCURRENT_REQUESTS: 100,
  BATCH_SIZE: 1000,
  API_DELAY: 20,
  TIMEOUT_MINUTES: 30
};

// Yahoo NHL Fantasy Scoring
const YAHOO_NHL_SCORING = {
  // Skater scoring
  goals: 3,
  assists: 2,
  plusMinus: 1,
  penaltyMinutes: 0.5,
  powerplayPoints: 1,
  shorthandedPoints: 2,
  gameWinningGoals: 1,
  shotsOnGoal: 0.4,
  faceoffsWon: 0.1,
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

function calculateYahooFantasyPoints(stats: any, isGoalie: boolean): number {
  let points = 0;
  
  if (isGoalie) {
    // Goalie scoring
    points += (stats.wins || 0) * YAHOO_NHL_SCORING.wins;
    points += (stats.losses || 0) * YAHOO_NHL_SCORING.losses;
    points += (stats.goals_against || 0) * YAHOO_NHL_SCORING.goalsAgainst;
    points += (stats.saves || 0) * YAHOO_NHL_SCORING.saves;
    points += (stats.shutouts || 0) * YAHOO_NHL_SCORING.shutouts;
  } else {
    // Skater scoring
    points += (stats.goals || 0) * YAHOO_NHL_SCORING.goals;
    points += (stats.assists || 0) * YAHOO_NHL_SCORING.assists;
    points += (stats.plus_minus || 0) * YAHOO_NHL_SCORING.plusMinus;
    points += (stats.penalty_minutes || 0) * YAHOO_NHL_SCORING.penaltyMinutes;
    points += (stats.powerplay_points || 0) * YAHOO_NHL_SCORING.powerplayPoints;
    points += (stats.shorthanded_points || 0) * YAHOO_NHL_SCORING.shorthandedPoints;
    points += (stats.game_winning_goals || 0) * YAHOO_NHL_SCORING.gameWinningGoals;
    points += (stats.shots || 0) * YAHOO_NHL_SCORING.shotsOnGoal;
    points += (stats.faceoffs_won || 0) * YAHOO_NHL_SCORING.faceoffsWon;
    points += (stats.hits || 0) * YAHOO_NHL_SCORING.hits;
    points += (stats.blocks || 0) * YAHOO_NHL_SCORING.blocks;
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

async function getNHLPlayers() {
  console.log('📊 Loading NHL players...');
  
  let allPlayers: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: playersBatch } = await supabase
      .from('players')
      .select('id, name, team_id, external_id, position')
      .eq('sport_id', 'NHL')
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
      .eq('sport_id', 'nhl')
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
    const seenPlayers = new Set<string>();
    
    // Process each team's players
    for (const teamData of response.data.boxscore.players) {
      const isHome = teamData.team.homeAway === 'home';
      const teamId = isHome ? game.home_team_id : game.away_team_id;
      const opponentId = isHome ? game.away_team_id : game.home_team_id;
      
      if (!teamData.statistics || teamData.statistics.length === 0) continue;
      
      // Process skaters and goalies separately
      for (const statCategory of teamData.statistics) {
        const athletes = statCategory.athletes || [];
        const isGoalie = statCategory.name?.toLowerCase().includes('goalie');
        
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
            continue;
          }
          seenPlayers.add(playerGameKey);
          
          let stats: any = {};
          
          if (isGoalie) {
            // Goalie stats
            const decision = athlete.stats[0] || '';
            stats = {
              saves: parseInt(athlete.stats[1]) || 0,
              shots_against: parseInt(athlete.stats[2]) || 0,
              goals_against: parseInt(athlete.stats[3]) || 0,
              save_percentage: parseFloat(athlete.stats[4]) || 0,
              minutes_played: parseInt(athlete.stats[5]) || 0,
              wins: decision === 'W' ? 1 : 0,
              losses: decision === 'L' ? 1 : 0,
              overtime_losses: decision === 'OT' ? 1 : 0,
              shutouts: stats.goals_against === 0 && stats.minutes_played >= 60 ? 1 : 0
            };
          } else {
            // Skater stats
            stats = {
              goals: parseInt(athlete.stats[0]) || 0,
              assists: parseInt(athlete.stats[1]) || 0,
              points: parseInt(athlete.stats[2]) || 0,
              plus_minus: parseInt(athlete.stats[3]) || 0,
              penalty_minutes: parseInt(athlete.stats[4]) || 0,
              powerplay_goals: parseInt(athlete.stats[5]) || 0,
              powerplay_assists: parseInt(athlete.stats[6]) || 0,
              powerplay_points: (parseInt(athlete.stats[5]) || 0) + (parseInt(athlete.stats[6]) || 0),
              shorthanded_goals: parseInt(athlete.stats[7]) || 0,
              shorthanded_assists: parseInt(athlete.stats[8]) || 0,
              shorthanded_points: (parseInt(athlete.stats[7]) || 0) + (parseInt(athlete.stats[8]) || 0),
              game_winning_goals: parseInt(athlete.stats[9]) || 0,
              overtime_goals: parseInt(athlete.stats[10]) || 0,
              shots: parseInt(athlete.stats[11]) || 0,
              shot_percentage: parseFloat(athlete.stats[12]) || 0,
              shifts: parseInt(athlete.stats[13]) || 0,
              time_on_ice: athlete.stats[14] || '00:00',
              faceoffs_won: parseInt(athlete.stats[15]) || 0,
              faceoffs_lost: parseInt(athlete.stats[16]) || 0,
              faceoff_percentage: parseFloat(athlete.stats[17]) || 0,
              hits: parseInt(athlete.stats[18]) || 0,
              blocks: parseInt(athlete.stats[19]) || 0,
              takeaways: parseInt(athlete.stats[20]) || 0,
              giveaways: parseInt(athlete.stats[21]) || 0
            };
          }
          
          const fantasyPoints = calculateYahooFantasyPoints(stats, isGoalie);
          
          playerStats.push({
            player_id: ourPlayer.id,
            game_id: game.id,
            team_id: teamId,
            game_date: game.start_time.split('T')[0],
            opponent_id: opponentId,
            is_home: isHome,
            minutes_played: isGoalie ? stats.minutes_played : undefined,
            stats: stats,
            fantasy_points: fantasyPoints
          });
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
  console.log('🚀 STARTING NHL STATS COLLECTION (FIXED VERSION)');
  console.log(`⚡ Configuration: ${CONFIG.CONCURRENT_REQUESTS} concurrent requests\n`);
  
  // Load player lookup first
  const playerLookup = await getNHLPlayers();
  
  // Get games to process
  const games = await getGamesToProcess();
  totalGames = games.length;
  
  if (totalGames === 0) {
    console.log('✅ No new games to process!');
    process.exit(0);
  }
  
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
  
  console.log('\n\n🏆 NHL STATS COLLECTION COMPLETE!\n');
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
  
  console.log('\n👋 Exiting - NHL collection complete!');
  process.exit(0);
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
}

main().catch(console.error);