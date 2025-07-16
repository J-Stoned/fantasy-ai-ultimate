#!/usr/bin/env tsx
/**
 * 🏀 NBA PLAYER STATS COLLECTOR
 * 
 * Collects player game logs for all NBA games
 * Populates the player_game_logs table
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ESPN API base
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

// Rate limiting
const limit = pLimit(3); // 3 concurrent requests
const API_DELAY = 1500; // 1.5 seconds between requests

// Progress tracking
let totalGames = 0;
let processedGames = 0;
let statsInserted = 0;
let errors = 0;
let gamesWithoutStats = 0;

// Progress bar
const progressBar = new cliProgress.SingleBar({
  format: 'Progress |{bar}| {percentage}% | {value}/{total} games | Stats: {stats}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true
});

// Player cache
const playerCache = new Map<string, number>();

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadPlayers() {
  console.log(chalk.yellow('Loading NBA players...'));
  
  // Players might have 'nba', 'NBA', or 'basketball' as sport
  const { data: players, error } = await supabase
    .from('players')
    .select('id, name, external_id, firstname, lastname')
    .or('sport.eq.NBA,sport.eq.nba,sport.eq.basketball');
  
  if (error) {
    throw new Error(`Failed to load players: ${error.message}`);
  }
  
  players?.forEach(player => {
    // Cache by full name
    if (player.name) {
      playerCache.set(player.name.toLowerCase(), player.id);
    }
    
    // Cache by firstname + lastname
    if (player.firstname && player.lastname) {
      const fullName = `${player.firstname} ${player.lastname}`.toLowerCase();
      playerCache.set(fullName, player.id);
    }
    
    // Also cache by external_id if available
    if (player.external_id) {
      playerCache.set(player.external_id, player.id);
    }
  });
  
  console.log(chalk.green(`✅ Loaded ${players?.length || 0} NBA players\n`));
}

async function fetchGameBoxscore(gameExternalId: string) {
  try {
    await delay(API_DELAY);
    
    const gameId = gameExternalId.replace('espn_nba_', '');
    const url = `${ESPN_BASE}/summary?event=${gameId}`;
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null; // Game not found
    }
    throw error;
  }
}

function parsePlayerStats(player: any, teamId: number, gameId: number, gameDate: Date, opponentId: number, isHome: boolean) {
  // Skip if player didn't play
  if (!player.stats || player.didNotPlay) {
    return null;
  }
  
  const stats = player.stats[0]; // First stat line is the game stats
  if (!stats) return null;
  
  // Find player ID from cache
  const playerId = playerCache.get(player.athlete.displayName.toLowerCase()) ||
                   playerCache.get(`espn_nba_${player.athlete.id}`);
  
  if (!playerId) {
    console.warn(chalk.yellow(`  ⚠️  Unknown player: ${player.athlete.displayName}`));
    return null;
  }
  
  // Parse minutes from "MM:SS" format
  const minutesPlayed = stats.split(':').length === 2 ? 
    parseInt(stats.split(':')[0]) + Math.round(parseInt(stats.split(':')[1]) / 60) : 
    0;
  
  // Build stats object
  const gameStats: any = {
    player_id: playerId,
    game_id: gameId,
    team_id: teamId,
    game_date: gameDate,
    opponent_id: opponentId,
    is_home: isHome,
    minutes_played: minutesPlayed,
    stats: {},
    raw_stats: player.stats,
    metadata: {
      jersey: player.athlete.jersey,
      position: player.athlete.position?.abbreviation,
      starter: player.starter || false
    }
  };
  
  // Map ESPN stats to our schema
  const statMappings: Record<string, string> = {
    '0': 'minutes',
    '1': 'field_goals_made',
    '2': 'field_goals_attempted',
    '3': 'three_pointers_made',
    '4': 'three_pointers_attempted',
    '5': 'free_throws_made',
    '6': 'free_throws_attempted',
    '7': 'offensive_rebounds',
    '8': 'defensive_rebounds',
    '9': 'total_rebounds',
    '10': 'assists',
    '11': 'steals',
    '12': 'blocks',
    '13': 'turnovers',
    '14': 'personal_fouls',
    '15': 'points',
    '16': 'plus_minus'
  };
  
  // Parse each stat
  player.stats.forEach((value: string, index: number) => {
    const statName = statMappings[index.toString()];
    if (statName && statName !== 'minutes') {
      gameStats.stats[statName] = parseFloat(value) || 0;
    }
  });
  
  // Calculate fantasy points (DraftKings scoring)
  gameStats.fantasy_points = calculateFantasyPoints(gameStats.stats);
  
  // Add computed metrics
  gameStats.computed_metrics = {
    field_goal_percentage: gameStats.stats.field_goals_attempted > 0 ? 
      (gameStats.stats.field_goals_made / gameStats.stats.field_goals_attempted) : 0,
    three_point_percentage: gameStats.stats.three_pointers_attempted > 0 ?
      (gameStats.stats.three_pointers_made / gameStats.stats.three_pointers_attempted) : 0,
    free_throw_percentage: gameStats.stats.free_throws_attempted > 0 ?
      (gameStats.stats.free_throws_made / gameStats.stats.free_throws_attempted) : 0,
    true_shooting_percentage: calculateTrueShootingPercentage(gameStats.stats),
    usage_rate: calculateUsageRate(gameStats.stats, minutesPlayed),
    efficiency_rating: calculateEfficiencyRating(gameStats.stats)
  };
  
  return gameStats;
}

function calculateFantasyPoints(stats: any): number {
  // DraftKings NBA scoring
  return (
    stats.points * 1 +
    stats.three_pointers_made * 0.5 +
    stats.total_rebounds * 1.25 +
    stats.assists * 1.5 +
    stats.steals * 2 +
    stats.blocks * 2 +
    stats.turnovers * -0.5 +
    (stats.points >= 10 && stats.total_rebounds >= 10 ? 1.5 : 0) + // Double-double
    (stats.points >= 10 && stats.total_rebounds >= 10 && stats.assists >= 10 ? 3 : 0) // Triple-double
  );
}

function calculateTrueShootingPercentage(stats: any): number {
  const points = stats.points || 0;
  const fga = stats.field_goals_attempted || 0;
  const fta = stats.free_throws_attempted || 0;
  
  const tsa = fga + 0.44 * fta;
  return tsa > 0 ? points / (2 * tsa) : 0;
}

function calculateUsageRate(stats: any, minutes: number): number {
  if (minutes === 0) return 0;
  
  const fga = stats.field_goals_attempted || 0;
  const fta = stats.free_throws_attempted || 0;
  const tov = stats.turnovers || 0;
  
  // Simplified usage rate calculation
  return ((fga + 0.44 * fta + tov) * 48) / minutes;
}

function calculateEfficiencyRating(stats: any): number {
  // Simplified Player Efficiency Rating
  const pts = stats.points || 0;
  const reb = stats.total_rebounds || 0;
  const ast = stats.assists || 0;
  const stl = stats.steals || 0;
  const blk = stats.blocks || 0;
  const tov = stats.turnovers || 0;
  const fga = stats.field_goals_attempted || 0;
  const fgm = stats.field_goals_made || 0;
  const fta = stats.free_throws_attempted || 0;
  const ftm = stats.free_throws_made || 0;
  
  return pts + reb + ast + stl + blk - (fga - fgm) - (fta - ftm) - tov;
}

async function processGame(game: any) {
  try {
    const boxscore = await fetchGameBoxscore(game.external_id);
    
    if (!boxscore || !boxscore.boxscore) {
      gamesWithoutStats++;
      return;
    }
    
    const playerStats: any[] = [];
    
    // Process each team's players
    boxscore.boxscore.teams?.forEach((team: any) => {
      const isHome = team.homeAway === 'home';
      const teamId = isHome ? game.home_team_id : game.away_team_id;
      const opponentId = isHome ? game.away_team_id : game.home_team_id;
      
      team.statistics?.forEach((statGroup: any) => {
        if (statGroup.type === 'athletes' && statGroup.athletes) {
          statGroup.athletes.forEach((player: any) => {
            const stats = parsePlayerStats(
              player,
              teamId,
              game.id,
              new Date(game.start_time),
              opponentId,
              isHome
            );
            
            if (stats) {
              playerStats.push(stats);
            }
          });
        }
      });
    });
    
    // Insert player stats in batch
    if (playerStats.length > 0) {
      const { error } = await supabase
        .from('player_game_logs')
        .insert(playerStats);
      
      if (error) {
        console.error(chalk.red(`Error inserting stats for game ${game.id}:`), error.message);
        errors++;
      } else {
        statsInserted += playerStats.length;
      }
    }
    
  } catch (error: any) {
    console.error(chalk.red(`Error processing game ${game.id}:`), error.message);
    errors++;
  }
}

async function main() {
  console.log(chalk.bold.blue('\n🏀 NBA PLAYER STATS COLLECTOR\n'));
  console.log(chalk.white('Collecting player game logs for all NBA games...'));
  
  const startTime = Date.now();
  
  try {
    // Load players first
    await loadPlayers();
    
    // Get all completed NBA games with pagination
    let allGames: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    console.log(chalk.yellow('Loading NBA games (paginating due to 1k limit)...'));
    
    while (hasMore) {
      const { data: games, error, count } = await supabase
        .from('games')
        .select('*', { count: 'exact' })
        .eq('sport', 'NBA')
        .eq('status', 'completed')
        .not('home_score', 'is', null)
        .order('start_time', { ascending: true })
        .range(offset, offset + pageSize - 1);
      
      if (error) {
        throw new Error(`Failed to load games: ${error.message}`);
      }
      
      if (games && games.length > 0) {
        allGames = allGames.concat(games);
        console.log(chalk.gray(`  Loaded ${allGames.length} games so far...`));
      }
      
      hasMore = games && games.length === pageSize;
      offset += pageSize;
    }
    
    const games = allGames;
    
    totalGames = games?.length || 0;
    console.log(chalk.cyan(`Found ${totalGames} completed NBA games to process\n`));
    
    // Check for existing stats to avoid duplicates
    const { data: existingStats } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', games?.map(g => g.id) || []);
    
    const processedGameIds = new Set(existingStats?.map(s => s.game_id) || []);
    const gamesToProcess = games?.filter(g => !processedGameIds.has(g.id)) || [];
    
    console.log(chalk.yellow(`${processedGameIds.size} games already have stats`));
    console.log(chalk.yellow(`${gamesToProcess.length} games need stats collection\n`));
    
    if (gamesToProcess.length === 0) {
      console.log(chalk.green('✅ All games already have stats!'));
      return;
    }
    
    progressBar.start(gamesToProcess.length, 0, { stats: statsInserted });
    
    // Process games in batches
    const batchSize = 10;
    for (let i = 0; i < gamesToProcess.length; i += batchSize) {
      const batch = gamesToProcess.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(game => 
          limit(async () => {
            await processGame(game);
            processedGames++;
            progressBar.update(processedGames, { stats: statsInserted });
          })
        )
      );
    }
    
    progressBar.stop();
    
    // Final summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(chalk.green('\n✅ Collection Complete!\n'));
    console.log(chalk.white(`📊 Summary:`));
    console.log(chalk.white(`   Games processed: ${processedGames}`));
    console.log(chalk.white(`   Player stats inserted: ${statsInserted}`));
    console.log(chalk.white(`   Games without stats: ${gamesWithoutStats}`));
    console.log(chalk.white(`   Errors: ${errors}`));
    console.log(chalk.white(`   Duration: ${duration}s`));
    
    // Verify in database
    const { count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('game_id', 'is', null);
    
    console.log(chalk.cyan(`\n🗄️  Total player game logs in database: ${count}`));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
  }
}

// Run the collector
main().catch(console.error);