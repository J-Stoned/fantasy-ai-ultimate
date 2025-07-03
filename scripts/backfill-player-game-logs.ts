#!/usr/bin/env tsx
/**
 * 🔄 BACKFILL PLAYER GAME LOGS
 * 
 * Populates historical player statistics for completed games
 * Focuses on last 2 seasons for most relevant data
 */

import chalk from 'chalk';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { schemaAdapter } from '../lib/db/schema-adapter';
import axios from 'axios';
import pLimit from 'p-limit';
import * as fs from 'fs/promises';
import * as path from 'path';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Rate limiting for API calls
const limit = pLimit(3); // 3 concurrent requests

// Progress tracking
interface BackfillProgress {
  totalGames: number;
  processedGames: number;
  successfulGames: number;
  failedGames: number;
  totalPlayers: number;
  totalStats: number;
  lastProcessedId?: number;
  errors: string[];
}

const PROGRESS_FILE = path.join(process.cwd(), 'backfill-progress.json');

async function loadProgress(): Promise<BackfillProgress> {
  try {
    const data = await fs.readFile(PROGRESS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      totalGames: 0,
      processedGames: 0,
      successfulGames: 0,
      failedGames: 0,
      totalPlayers: 0,
      totalStats: 0,
      errors: []
    };
  }
}

async function saveProgress(progress: BackfillProgress) {
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function getCompletedGames(limit: number = 1000, afterId?: number) {
  console.log(chalk.cyan('📊 Fetching completed games...'));
  
  let query = supabase
    .from('games')
    .select('*')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('id', { ascending: true })
    .limit(limit);
  
  if (afterId) {
    query = query.gt('id', afterId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error(chalk.red('Error fetching games:'), error);
    return [];
  }
  
  return data || [];
}

async function fetchESPNBoxScore(game: any): Promise<any> {
  // Skip if no external_id
  if (!game.external_id) return null;
  
  // Extract ESPN game ID from external_id (format: "nfl_401547652")
  const parts = game.external_id.split('_');
  if (parts.length < 2) return null;
  
  const sport = parts[0];
  const gameId = parts[1];
  
  // Map sport to ESPN API format
  const sportMap: Record<string, string> = {
    nfl: 'football/nfl',
    nba: 'basketball/nba',
    mlb: 'baseball/mlb',
    nhl: 'hockey/nhl'
  };
  
  const sportPath = sportMap[sport];
  if (!sportPath) return null;
  
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/summary?event=${gameId}`;
    const response = await axios.get(url, { timeout: 10000 });
    return response.data;
  } catch (error: any) {
    if (error.response?.status !== 404) {
      console.error(chalk.red(`Failed to fetch box score for game ${gameId}:`), error.message);
    }
    return null;
  }
}

async function extractPlayerStats(boxscore: any, game: any, sport: string) {
  const stats: any[] = [];
  
  if (!boxscore?.boxscore?.teams) return stats;
  
  for (const team of boxscore.boxscore.teams) {
    const teamName = team.team.displayName;
    
    // Process each stat category
    for (const category of team.statistics || []) {
      for (const player of category.athletes || []) {
        const playerData = {
          name: player.athlete.displayName,
          id: player.athlete.id,
          team: teamName,
          position: player.athlete.position?.abbreviation,
          jersey: player.athlete.jersey
        };
        
        // Parse stats based on sport
        const gameStats = parsePlayerStats(sport, category.name, player.stats);
        
        if (Object.keys(gameStats).length > 0) {
          stats.push({
            player: playerData,
            stats: gameStats,
            game_id: game.id,
            game_date: game.start_time
          });
        }
      }
    }
  }
  
  return stats;
}

function parsePlayerStats(sport: string, category: string, statArray: string[]): Record<string, number> {
  const stats: Record<string, number> = {};
  
  switch (sport) {
    case 'nfl':
      if (category === 'passing' && statArray.length >= 9) {
        stats.completions = parseInt(statArray[0]?.split('/')[0] || '0');
        stats.attempts = parseInt(statArray[0]?.split('/')[1] || '0');
        stats.passing_yards = parseInt(statArray[1] || '0');
        stats.passing_tds = parseInt(statArray[2] || '0');
        stats.interceptions = parseInt(statArray[3] || '0');
      } else if (category === 'rushing' && statArray.length >= 5) {
        stats.carries = parseInt(statArray[0] || '0');
        stats.rushing_yards = parseInt(statArray[1] || '0');
        stats.rushing_tds = parseInt(statArray[3] || '0');
      } else if (category === 'receiving' && statArray.length >= 5) {
        stats.receptions = parseInt(statArray[0] || '0');
        stats.receiving_yards = parseInt(statArray[1] || '0');
        stats.receiving_tds = parseInt(statArray[3] || '0');
        stats.targets = parseInt(statArray[4] || '0');
      }
      break;
      
    case 'nba':
      if (statArray.length >= 15) {
        stats.minutes = parseFloat(statArray[0] || '0');
        stats.points = parseInt(statArray[13] || '0');
        stats.rebounds = parseInt(statArray[5] || '0');
        stats.assists = parseInt(statArray[6] || '0');
        stats.steals = parseInt(statArray[7] || '0');
        stats.blocks = parseInt(statArray[8] || '0');
        stats.field_goals_made = parseInt(statArray[1]?.split('-')[0] || '0');
        stats.field_goals_attempted = parseInt(statArray[1]?.split('-')[1] || '0');
        stats.three_pointers_made = parseInt(statArray[2]?.split('-')[0] || '0');
        stats.three_pointers_attempted = parseInt(statArray[2]?.split('-')[1] || '0');
        stats.free_throws_made = parseInt(statArray[3]?.split('-')[0] || '0');
        stats.free_throws_attempted = parseInt(statArray[3]?.split('-')[1] || '0');
      }
      break;
      
    case 'mlb':
      if (category === 'batting' && statArray.length >= 8) {
        stats.at_bats = parseInt(statArray[0] || '0');
        stats.runs = parseInt(statArray[1] || '0');
        stats.hits = parseInt(statArray[2] || '0');
        stats.rbi = parseInt(statArray[3] || '0');
        stats.walks = parseInt(statArray[4] || '0');
        stats.strikeouts = parseInt(statArray[5] || '0');
        stats.batting_avg = parseFloat(statArray[6] || '0');
      } else if (category === 'pitching' && statArray.length >= 10) {
        stats.innings_pitched = parseFloat(statArray[0] || '0');
        stats.hits_allowed = parseInt(statArray[1] || '0');
        stats.runs_allowed = parseInt(statArray[2] || '0');
        stats.earned_runs = parseInt(statArray[3] || '0');
        stats.walks_allowed = parseInt(statArray[4] || '0');
        stats.strikeouts = parseInt(statArray[5] || '0');
        stats.pitches = parseInt(statArray[8] || '0');
        stats.era = parseFloat(statArray[9] || '0');
      }
      break;
  }
  
  return stats;
}

function calculateFantasyPoints(sport: string, stats: Record<string, number>): number {
  let points = 0;
  
  switch (sport) {
    case 'nfl':
      points += (stats.passing_yards || 0) * 0.04;
      points += (stats.passing_tds || 0) * 4;
      points -= (stats.interceptions || 0) * 2;
      points += (stats.rushing_yards || 0) * 0.1;
      points += (stats.rushing_tds || 0) * 6;
      points += (stats.receiving_yards || 0) * 0.1;
      points += (stats.receiving_tds || 0) * 6;
      points += (stats.receptions || 0) * 0.5; // PPR
      break;
      
    case 'nba':
      points += (stats.points || 0) * 1;
      points += (stats.rebounds || 0) * 1.2;
      points += (stats.assists || 0) * 1.5;
      points += (stats.steals || 0) * 3;
      points += (stats.blocks || 0) * 3;
      points -= (stats.turnovers || 0) * 1;
      break;
      
    case 'mlb':
      // Batting
      points += (stats.runs || 0) * 2;
      points += (stats.rbi || 0) * 2;
      points += (stats.hits || 0) * 1;
      points += (stats.walks || 0) * 1;
      points -= (stats.strikeouts || 0) * 0.5;
      // Pitching
      points += (stats.innings_pitched || 0) * 2.25;
      points += (stats.strikeouts || 0) * 2;
      points -= (stats.earned_runs || 0) * 2;
      points -= (stats.walks_allowed || 0) * 1;
      break;
  }
  
  return Math.round(points * 100) / 100;
}

async function processGame(game: any, progress: BackfillProgress) {
  try {
    // Check if game has external_id and is from a sport we support
    if (!game.external_id || !game.sport_id) {
      return false;
    }
    
    const sport = game.sport_id.toLowerCase();
    if (!['nfl', 'nba', 'mlb'].includes(sport)) {
      return false;
    }
    
    // Fetch box score from ESPN
    const boxscore = await fetchESPNBoxScore(game);
    if (!boxscore) {
      return false;
    }
    
    // Extract player stats
    const playerStats = await extractPlayerStats(boxscore, game, sport);
    
    // Store each player's stats
    let statsStored = 0;
    for (const stat of playerStats) {
      // First, ensure player exists
      const playerId = await schemaAdapter.upsertPlayer({
        name: stat.player.name,
        position: stat.player.position,
        team: stat.player.team,
        sport: sport === 'nfl' ? 'football' : sport === 'nba' ? 'basketball' : 'baseball',
        external_id: `espn_${sport}_player_${stat.player.id}`,
        jersey_number: stat.player.jersey
      }, 'espn');
      
      if (playerId) {
        // Calculate fantasy points
        const fantasyPoints = calculateFantasyPoints(sport, stat.stats);
        
        // Store stats
        const stored = await schemaAdapter.upsertPlayerStats({
          player_id: playerId,
          game_id: game.id,
          stats: stat.stats,
          fantasy_points: fantasyPoints,
          game_date: stat.game_date
        });
        
        if (stored) {
          statsStored++;
          progress.totalStats++;
        }
      }
    }
    
    if (statsStored > 0) {
      progress.totalPlayers += playerStats.length;
      return true;
    }
    
    return false;
  } catch (error: any) {
    console.error(chalk.red(`Error processing game ${game.id}:`), error.message);
    progress.errors.push(`Game ${game.id}: ${error.message}`);
    return false;
  }
}

async function backfillPlayerGameLogs() {
  console.log(chalk.bold.cyan('\n🔄 PLAYER GAME LOGS BACKFILL'));
  console.log(chalk.gray('='.repeat(50)));
  
  // Load progress
  const progress = await loadProgress();
  console.log(chalk.yellow('\n📈 Current Progress:'));
  console.log(`  Processed: ${progress.processedGames} games`);
  console.log(`  Successful: ${progress.successfulGames} games`);
  console.log(`  Total Stats: ${progress.totalStats} entries`);
  
  // Get date range (last 2 seasons)
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  
  // Process games in batches
  const BATCH_SIZE = 100;
  let hasMore = true;
  
  while (hasMore) {
    const games = await getCompletedGames(BATCH_SIZE, progress.lastProcessedId);
    
    if (games.length === 0) {
      hasMore = false;
      break;
    }
    
    console.log(chalk.cyan(`\n📦 Processing batch of ${games.length} games...`));
    
    // Process games with rate limiting
    const results = await Promise.all(
      games.map(game => 
        limit(async () => {
          const success = await processGame(game, progress);
          progress.processedGames++;
          
          if (success) {
            progress.successfulGames++;
            console.log(chalk.green(`✅ Game ${game.id}: Stats saved`));
          } else {
            progress.failedGames++;
          }
          
          progress.lastProcessedId = game.id;
          return success;
        })
      )
    );
    
    // Save progress after each batch
    await saveProgress(progress);
    
    // Show batch summary
    const successCount = results.filter(r => r).length;
    console.log(chalk.yellow(`\n📊 Batch Summary:`));
    console.log(`  Success: ${successCount}/${games.length} games`);
    console.log(`  Total Progress: ${progress.processedGames} games`);
    console.log(`  Total Stats: ${progress.totalStats} entries`);
    
    // Add delay between batches to avoid rate limits
    if (hasMore) {
      console.log(chalk.gray('\n⏳ Waiting 5 seconds before next batch...'));
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  // Final summary
  console.log(chalk.bold.green('\n✨ BACKFILL COMPLETE!'));
  console.log(chalk.gray('='.repeat(50)));
  console.log(chalk.cyan('📊 Final Statistics:'));
  console.log(`  Total Games: ${progress.processedGames}`);
  console.log(`  Successful: ${progress.successfulGames}`);
  console.log(`  Failed: ${progress.failedGames}`);
  console.log(`  Total Players: ${progress.totalPlayers}`);
  console.log(`  Total Stats: ${progress.totalStats}`);
  console.log(`  Success Rate: ${((progress.successfulGames / progress.processedGames) * 100).toFixed(1)}%`);
  
  if (progress.errors.length > 0) {
    console.log(chalk.red('\n❌ Errors:'));
    progress.errors.slice(-10).forEach(error => {
      console.log(`  - ${error}`);
    });
  }
}

// Run the backfill
backfillPlayerGameLogs().catch(console.error);