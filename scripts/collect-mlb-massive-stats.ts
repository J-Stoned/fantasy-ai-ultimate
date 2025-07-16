#!/usr/bin/env tsx
/**
 * ⚾ MASSIVE MLB STATS COLLECTOR
 * Phase 3: Collect 300K+ player stats from 5,541 games
 * 🚀 Ryzen 5 7600X Optimized with 30-minute timeout
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

console.log(chalk.bold.red('⚾ MASSIVE MLB STATS COLLECTOR - 300K+ TARGET\n'));

// Configuration for Ryzen 5 7600X optimization
const CONFIG = {
  CONCURRENT_REQUESTS: 15,  // 🚀 MAXIMUM CPU UTILIZATION (12 threads + extra)
  BATCH_SIZE: 250,          // Larger batches for efficiency
  API_DELAY: 200,           // Faster requests for more CPU load
  TIMEOUT_MINUTES: 40       // 40 minutes for complete collection
};

// Tracking
let totalGames = 0;
let processedGames = 0;
let totalStats = 0;
let errorCount = 0;
let startTime = Date.now();

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

// MLB fantasy scoring
function calculateMLBFantasyPoints(stats: any): number {
  let points = 0;
  
  // Hitting
  points += (stats.singles || 0) * 3;
  points += (stats.doubles || 0) * 5;
  points += (stats.triples || 0) * 8;
  points += (stats.home_runs || 0) * 10;
  points += (stats.runs || 0) * 2;
  points += (stats.rbis || 0) * 2;
  points += (stats.walks || 0) * 2;
  points += (stats.stolen_bases || 0) * 5;
  
  // Pitching
  if (stats.innings_pitched) {
    points += (stats.innings_pitched || 0) * 2.25;
    points += (stats.wins || 0) * 4;
    points += (stats.saves || 0) * 2;
    points += (stats.strikeouts || 0) * 2;
    points -= (stats.earned_runs || 0) * 2;
    points -= (stats.hits_allowed || 0) * 0.6;
    points -= (stats.walks_allowed || 0) * 0.6;
  }
  
  return Math.round(points * 100) / 100;
}

async function getMLBData() {
  console.log('📊 Loading MLB data...');
  
  // Get ALL MLB games with pagination
  let allGames: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: gamesBatch } = await supabase
      .from('games')
      .select('id, external_id, home_team_id, away_team_id, start_time, home_score, away_score')
      .eq('sport_id', 'mlb')
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .order('start_time')
      .range(from, from + batchSize - 1);
      
    if (!gamesBatch || gamesBatch.length === 0) break;
    
    allGames.push(...gamesBatch);
    from += batchSize;
    
    if (gamesBatch.length < batchSize) break;
  }
  
  const games = allGames;
  
  // Get all MLB players (both uppercase and lowercase)
  const { data: players } = await supabase
    .from('players')
    .select('id, name, team_id, external_id')
    .or('sport_id.eq.mlb,sport_id.eq.MLB');
  
  // Get teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .or('sport_id.eq.mlb,sport_id.eq.MLB');
  
  if (!games || !players || !teams) {
    throw new Error('Failed to load MLB data');
  }
  
  console.log(`✅ Loaded ${games.length} games, ${players.length} players, ${teams.length} teams`);
  
  // Create lookup maps
  const playerLookup = new Map();
  players.forEach(p => {
    if (p.external_id) {
      playerLookup.set(p.external_id, p);
    }
  });
  
  const teamLookup = new Map();
  teams.forEach(t => teamLookup.set(t.id, t));
  
  return { games, playerLookup, teamLookup };
}

async function fetchGameBoxscore(game: any, playerLookup: Map<string, any>) {
  try {
    if (!game.external_id || !game.external_id.startsWith('espn_mlb_')) {
      return [];
    }
    
    const gameId = game.external_id.replace('espn_mlb_', '');
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${gameId}`;
    
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
      
      // Process batters
      if (team.statistics && team.statistics[0] && team.statistics[0].athletes) {
        for (const athlete of team.statistics[0].athletes) {
          const playerId = athlete.athlete.id;
          const playerKey = `mlb_${playerId}`;
          
          const ourPlayer = playerLookup.get(playerKey);
          if (!ourPlayer) continue;
          
          // Parse batting stats
          const stats = athlete.stats || [];
          const battingStats = {
            at_bats: parseInt(stats[0]) || 0,
            runs: parseInt(stats[1]) || 0,
            hits: parseInt(stats[2]) || 0,
            rbis: parseInt(stats[3]) || 0,
            walks: parseInt(stats[4]) || 0,
            strikeouts: parseInt(stats[5]) || 0,
            avg: parseFloat(stats[6]) || 0,
            obp: parseFloat(stats[7]) || 0,
            slg: parseFloat(stats[8]) || 0,
            ops: parseFloat(stats[9]) || 0
          };
          
          // Calculate singles, doubles, triples, home runs from hits if available
          const extraStats = athlete.athlete.statistics || {};
          battingStats.home_runs = extraStats.homeRuns || 0;
          battingStats.doubles = extraStats.doubles || 0;
          battingStats.triples = extraStats.triples || 0;
          battingStats.singles = battingStats.hits - battingStats.doubles - battingStats.triples - battingStats.home_runs;
          
          const fantasyPoints = calculateMLBFantasyPoints(battingStats);
          
          playerStats.push({
            player_id: ourPlayer.id,
            game_id: game.id,
            team_id: ourPlayer.team_id,
            game_date: game.start_time.split('T')[0],
            opponent_id: opponentId,
            is_home: isHome,
            stats: battingStats,
            fantasy_points: fantasyPoints
          });
        }
      }
      
      // Process pitchers
      if (team.statistics && team.statistics[1] && team.statistics[1].athletes) {
        for (const athlete of team.statistics[1].athletes) {
          const playerId = athlete.athlete.id;
          const playerKey = `mlb_${playerId}`;
          
          const ourPlayer = playerLookup.get(playerKey);
          if (!ourPlayer) continue;
          
          // Parse pitching stats
          const stats = athlete.stats || [];
          const pitchingStats = {
            innings_pitched: parseFloat(stats[0]) || 0,
            hits_allowed: parseInt(stats[1]) || 0,
            runs_allowed: parseInt(stats[2]) || 0,
            earned_runs: parseInt(stats[3]) || 0,
            walks_allowed: parseInt(stats[4]) || 0,
            strikeouts: parseInt(stats[5]) || 0,
            home_runs_allowed: parseInt(stats[6]) || 0,
            era: parseFloat(stats[7]) || 0,
            wins: athlete.athlete.statistics?.wins || 0,
            losses: athlete.athlete.statistics?.losses || 0,
            saves: athlete.athlete.statistics?.saves || 0
          };
          
          const fantasyPoints = calculateMLBFantasyPoints(pitchingStats);
          
          playerStats.push({
            player_id: ourPlayer.id,
            game_id: game.id,
            team_id: ourPlayer.team_id,
            game_date: game.start_time.split('T')[0],
            opponent_id: opponentId,
            is_home: isHome,
            stats: pitchingStats,
            fantasy_points: fantasyPoints
          });
        }
      }
    }
    
    return playerStats;
    
  } catch (error: any) {
    if (error.code === 'ECONNABORTED') {
      console.log(`⏰ Timeout for game ${game.id}`);
    } else {
      console.log(`❌ Error processing game ${game.id}:`, error.message);
    }
    errorCount++;
    return [];
  }
}

async function collectMassiveMLBStats() {
  startTime = Date.now();
  
  console.log('🚀 STARTING MASSIVE MLB STATS COLLECTION');
  console.log(`⚡ Configuration: ${CONFIG.CONCURRENT_REQUESTS} concurrent, ${CONFIG.TIMEOUT_MINUTES}min timeout\n`);
  
  // Load data
  const { games, playerLookup, teamLookup } = await getMLBData();
  totalGames = games.length;
  
  // Check existing stats
  const { count: existingStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', games.map(g => g.id));
  
  console.log(`📊 Found ${existingStats || 0} existing stats, collecting remaining...\n`);
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: '⚾ Progress |{bar}| {percentage}% | {value}/{total} Games | {stats} Stats | {errors} Errors',
    barCompleteChar: '\\u2588',
    barIncompleteChar: '\\u2591',
    hideCursor: true
  });
  
  progressBar.start(totalGames, 0, { stats: 0, errors: 0 });
  
  // Process games with concurrency limit
  const limit = pLimit(CONFIG.CONCURRENT_REQUESTS);
  const allStats: PlayerGameLog[] = [];
  
  const promises = games.map((game, index) => 
    limit(async () => {
      const gameStats = await fetchGameBoxscore(game, playerLookup);
      allStats.push(...gameStats);
      
      processedGames++;
      progressBar.update(processedGames, { 
        stats: allStats.length, 
        errors: errorCount 
      });
      
      // Delay between requests
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
    console.log(`\\n⏰ Reached ${CONFIG.TIMEOUT_MINUTES}min timeout, saving collected stats...`);
  }
  
  progressBar.stop();
  
  console.log(`\\n📊 Collected ${allStats.length} player stats from ${processedGames} games`);
  
  // Insert stats in batches
  if (allStats.length > 0) {
    console.log('\\n💾 Inserting stats in batches...');
    
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
      
      process.stdout.write(`\\r💾 Inserted ${inserted} / ${allStats.length} stats`);
    }
    
    totalStats = inserted;
  }
  
  // Final summary
  const elapsedTime = (Date.now() - startTime) / 1000;
  
  console.log('\\n\\n🏆 MASSIVE MLB STATS COLLECTION COMPLETE!\\n');
  console.log(`⏱️  Total Time: ${(elapsedTime / 60).toFixed(1)} minutes`);
  console.log(`🎮 Games Processed: ${processedGames} / ${totalGames}`);
  console.log(`📊 Stats Collected: ${totalStats.toLocaleString()}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`⚡ Processing Rate: ${(processedGames / (elapsedTime / 60)).toFixed(1)} games/min`);
  
  // Check final total
  const { count: finalTotal } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  console.log(`\\n📈 Total player_game_logs in database: ${finalTotal?.toLocaleString()}`);
  
  if ((finalTotal || 0) >= 100000) {
    console.log('\\n🎯 🚀 100K+ STATS MILESTONE ACHIEVED! 🚀');
  }
  
  if ((finalTotal || 0) >= 300000) {
    console.log('\\n🏆 🎉 300K+ TARGET CRUSHED! VICTORY! 🎉 🏆');
  }
  
  console.log('\\n✅ Ready for Phase 4: Verification & Commit!');
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
  
  await collectMassiveMLBStats();
}

main().catch(console.error);