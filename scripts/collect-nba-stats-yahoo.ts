#!/usr/bin/env tsx
/**
 * 🏀 NBA STATS COLLECTOR - Yahoo Fantasy Scoring
 * Target: 15K+ player game stats from 3,967 games
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

console.log(chalk.bold.yellow('🏀 NBA STATS COLLECTOR - Yahoo Fantasy Scoring\n'));

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

async function getNBAData() {
  console.log('📊 Loading NBA data...');
  
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
  
  // Get all NBA players
  const { data: players } = await supabase
    .from('players')
    .select('id, name, team_id, external_id')
    .or('sport_id.eq.nba,sport_id.eq.NBA');
  
  if (!allGames || !players) {
    throw new Error('Failed to load NBA data');
  }
  
  console.log(`✅ Loaded ${allGames.length} games, ${players.length} players`);
  
  // Create player lookup by external_id
  const playerLookup = new Map();
  players.forEach(p => {
    if (p.external_id) {
      playerLookup.set(p.external_id, p);
    }
  });
  
  return { games: allGames, playerLookup };
}

async function fetchGameBoxscore(game: any, playerLookup: Map<string, any>) {
  try {
    if (!game.external_id || !game.external_id.startsWith('espn_nba_')) {
      return [];
    }
    
    const gameId = game.external_id.replace('espn_nba_', '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${gameId}`;
    
    const response = await axios.get(url, { timeout: 10000 });
    
    if (!response.data.boxscore || !response.data.boxscore.teams) {
      return [];
    }
    
    const playerStats: PlayerGameLog[] = [];
    
    // Process both teams
    for (const team of response.data.boxscore.teams) {
      const teamId = team.team.id;
      const isHome = teamId.toString() === game.home_team_id?.toString();
      const opponentId = isHome ? game.away_team_id : game.home_team_id;
      
      // Process players
      if (team.statistics && team.statistics[0] && team.statistics[0].athletes) {
        for (const athlete of team.statistics[0].athletes) {
          const playerId = athlete.athlete.id;
          const playerKey = `espn_nba_${playerId}`;
          
          const ourPlayer = playerLookup.get(playerKey);
          if (!ourPlayer) continue;
          
          // Skip DNP (Did Not Play)
          if (!athlete.stats || athlete.stats.length === 0) continue;
          
          // Parse stats array from ESPN
          const statsArray = athlete.stats;
          const stats = {
            minutes_played: parseInt(statsArray[0]) || 0,
            field_goals_made: parseInt(statsArray[1]) || 0,
            field_goals_attempted: parseInt(statsArray[2]) || 0,
            three_pointers_made: parseInt(statsArray[3]) || 0,
            three_pointers_attempted: parseInt(statsArray[4]) || 0,
            free_throws_made: parseInt(statsArray[5]) || 0,
            free_throws_attempted: parseInt(statsArray[6]) || 0,
            offensive_rebounds: parseInt(statsArray[7]) || 0,
            defensive_rebounds: parseInt(statsArray[8]) || 0,
            total_rebounds: parseInt(statsArray[9]) || 0,
            assists: parseInt(statsArray[10]) || 0,
            steals: parseInt(statsArray[11]) || 0,
            blocks: parseInt(statsArray[12]) || 0,
            turnovers: parseInt(statsArray[13]) || 0,
            personal_fouls: parseInt(statsArray[14]) || 0,
            points: parseInt(statsArray[15]) || 0,
            plus_minus: parseInt(statsArray[16]) || 0
          };
          
          const fantasyPoints = calculateYahooFantasyPoints(stats);
          
          playerStats.push({
            player_id: ourPlayer.id,
            game_id: game.id,
            team_id: ourPlayer.team_id,
            game_date: game.start_time.split('T')[0],
            opponent_id: opponentId,
            is_home: isHome,
            minutes_played: stats.minutes_played,
            stats,
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

async function collectNBAStats() {
  console.log('🚀 STARTING NBA STATS COLLECTION');
  console.log(`⚡ Configuration: ${CONFIG.CONCURRENT_REQUESTS} concurrent, ${CONFIG.TIMEOUT_MINUTES}min timeout\n`);
  
  // Load data
  const { games, playerLookup } = await getNBAData();
  totalGames = games.length;
  
  // Check existing stats
  const { count: existingStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', games.map(g => g.id));
  
  console.log(`📊 Found ${existingStats || 0} existing stats\n`);
  
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
  
  // Check final total
  const { count: finalTotal } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n📈 Total player_game_logs in database: ${finalTotal?.toLocaleString()}`);
  
  if (totalStats >= 15000) {
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