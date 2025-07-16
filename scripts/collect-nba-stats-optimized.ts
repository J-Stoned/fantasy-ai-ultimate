#!/usr/bin/env tsx
/**
 * 🏀 NBA PLAYER STATS COLLECTOR - OPTIMIZED
 * 
 * Optimized version that handles large datasets efficiently
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

// Rate limiting - optimized for Ryzen 5 7600X (6 cores/12 threads)
const limit = pLimit(10); // 10 concurrent requests to maximize CPU usage
const API_DELAY = 500; // 500ms between requests - ESPN can handle this

// Progress tracking
let totalGames = 0;
let processedGames = 0;
let statsInserted = 0;
let errors = 0;
let gamesWithoutStats = 0;
let lastProcessedGameId = 0;

// Progress bar
const progressBar = new cliProgress.SingleBar({
  format: 'Progress |{bar}| {percentage}% | {value}/{total} games | Stats: {stats} | Errors: {errors}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true
});

// Player cache
const playerCache = new Map<string, number>();
const missingPlayers = new Set<string>();

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadAllPlayers() {
  console.log(chalk.yellow('Loading ALL NBA players (with pagination)...'));
  
  let allPlayers: any[] = [];
  let offset = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: players, error } = await supabase
      .from('players')
      .select('id, name, external_id, firstname, lastname, sport')
      .or('sport.eq.NBA,sport.eq.nba,sport.eq.basketball,team.ilike.%NBA%')
      .range(offset, offset + pageSize - 1);
    
    if (error) {
      throw new Error(`Failed to load players: ${error.message}`);
    }
    
    if (players && players.length > 0) {
      allPlayers = allPlayers.concat(players);
      console.log(chalk.gray(`  Loaded ${allPlayers.length} players so far...`));
    }
    
    hasMore = players && players.length === pageSize;
    offset += pageSize;
  }
  
  // Build comprehensive cache
  allPlayers.forEach(player => {
    // Cache by full name
    if (player.name) {
      playerCache.set(player.name.toLowerCase(), player.id);
      // Also try last name only (for cases like "James" -> "LeBron James")
      const lastName = player.name.split(' ').pop()?.toLowerCase();
      if (lastName && !playerCache.has(lastName)) {
        playerCache.set(lastName, player.id);
      }
    }
    
    // Cache by firstname + lastname
    if (player.firstname && player.lastname) {
      const fullName = `${player.firstname} ${player.lastname}`.toLowerCase();
      playerCache.set(fullName, player.id);
    }
    
    // Cache by external_id
    if (player.external_id) {
      playerCache.set(player.external_id, player.id);
    }
  });
  
  console.log(chalk.green(`✅ Loaded ${allPlayers.length} players total\n`));
}

async function getLastProcessedGame() {
  // Check if we have any stats already
  const { data, error } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .order('game_id', { ascending: false })
    .limit(1)
    .single();
  
  if (data) {
    lastProcessedGameId = data.game_id;
    console.log(chalk.yellow(`📌 Resuming from game ID: ${lastProcessedGameId}\n`));
  }
}

async function fetchGameBoxscore(gameExternalId: string, retries = 3): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await delay(API_DELAY);
      
      const gameId = gameExternalId.replace('espn_nba_', '');
      const url = `${ESPN_BASE}/summary?event=${gameId}`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000 // 10 second timeout
      });
      
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null; // Game not found
      }
      
      if (attempt === retries) {
        console.error(chalk.red(`  Failed after ${retries} attempts: ${error.message}`));
        throw error;
      }
      
      // Wait longer before retry
      console.log(chalk.yellow(`  Retry ${attempt}/${retries} after error: ${error.message}`));
      await delay(5000 * attempt); // Exponential backoff
    }
  }
}

async function createMissingPlayer(displayName: string, espnId: string) {
  // Parse name
  const nameParts = displayName.split(' ');
  const firstname = nameParts[0];
  const lastname = nameParts.slice(1).join(' ');
  
  const playerData = {
    name: displayName,
    firstname,
    lastname,
    sport: 'NBA',
    external_id: `espn_nba_${espnId}`,
    status: 'active'
  };
  
  const { data, error } = await supabase
    .from('players')
    .insert(playerData)
    .select('id')
    .single();
  
  if (data) {
    // Add to cache
    playerCache.set(displayName.toLowerCase(), data.id);
    playerCache.set(`espn_nba_${espnId}`, data.id);
    console.log(chalk.green(`    ✅ Created player: ${displayName}`));
    return data.id;
  }
  
  return null;
}

function parsePlayerStats(player: any, teamId: number, gameId: number, gameDate: Date, opponentId: number, isHome: boolean) {
  // Skip if player didn't play
  if (!player.stats || player.didNotPlay) {
    return null;
  }
  
  const stats = player.stats;
  if (!stats || stats.length === 0) return null;
  
  // Find or create player
  let playerId = playerCache.get(player.athlete.displayName.toLowerCase()) ||
                 playerCache.get(`espn_nba_${player.athlete.id}`);
  
  if (!playerId && !missingPlayers.has(player.athlete.displayName)) {
    missingPlayers.add(player.athlete.displayName);
    console.warn(chalk.yellow(`  ⚠️  Unknown player: ${player.athlete.displayName} (ESPN ID: ${player.athlete.id})`));
    return null; // Skip for now, we'll create missing players in a batch later
  }
  
  if (!playerId) return null;
  
  // Parse minutes from first stat (just a number in this API)
  const minutesPlayed = parseInt(stats[0]) || 0;
  
  // Parse shooting stats (format: "made-attempted")
  const [fgMade, fgAttempted] = (stats[1] || "0-0").split('-').map(Number);
  const [fg3Made, fg3Attempted] = (stats[2] || "0-0").split('-').map(Number);
  const [ftMade, ftAttempted] = (stats[3] || "0-0").split('-').map(Number);
  
  // Build stats object
  const gameStats: any = {
    player_id: playerId,
    game_id: gameId,
    team_id: teamId,
    game_date: gameDate,
    opponent_id: opponentId,
    is_home: isHome,
    minutes_played: minutesPlayed,
    stats: {
      // Map ESPN stats array positions (corrected order)
      field_goals_made: fgMade || 0,
      field_goals_attempted: fgAttempted || 0,
      three_pointers_made: fg3Made || 0,
      three_pointers_attempted: fg3Attempted || 0,
      free_throws_made: ftMade || 0,
      free_throws_attempted: ftAttempted || 0,
      offensive_rebounds: parseInt(stats[4]) || 0,
      defensive_rebounds: parseInt(stats[5]) || 0,
      total_rebounds: parseInt(stats[6]) || 0,
      assists: parseInt(stats[7]) || 0,
      steals: parseInt(stats[8]) || 0,
      blocks: parseInt(stats[9]) || 0,
      turnovers: parseInt(stats[10]) || 0,
      personal_fouls: parseInt(stats[11]) || 0,
      plus_minus: parseInt(stats[12]) || 0,
      points: parseInt(stats[13]) || 0
    },
    raw_stats: stats,
    metadata: {
      jersey: player.athlete.jersey,
      position: player.athlete.position?.abbreviation,
      starter: player.starter || false
    }
  };
  
  // Calculate fantasy points (DraftKings scoring)
  const s = gameStats.stats;
  gameStats.fantasy_points = (
    s.points * 1 +
    s.three_pointers_made * 0.5 +
    s.total_rebounds * 1.25 +
    s.assists * 1.5 +
    s.steals * 2 +
    s.blocks * 2 +
    s.turnovers * -0.5 +
    (s.points >= 10 && s.total_rebounds >= 10 ? 1.5 : 0) + // Double-double
    (s.points >= 10 && s.total_rebounds >= 10 && s.assists >= 10 ? 3 : 0) // Triple-double
  );
  
  return gameStats;
}

async function processGame(game: any) {
  try {
    const boxscore = await fetchGameBoxscore(game.external_id);
    
    if (!boxscore || !boxscore.boxscore) {
      gamesWithoutStats++;
      return;
    }
    
    const playerStats: any[] = [];
    
    // Get team mapping from boxscore.teams which has homeAway info
    const teamMapping = new Map();
    boxscore.boxscore.teams?.forEach((team: any) => {
      const isHome = team.homeAway === 'home';
      teamMapping.set(team.team.id, {
        isHome,
        dbTeamId: isHome ? game.home_team_id : game.away_team_id,
        opponentId: isHome ? game.away_team_id : game.home_team_id
      });
    });
    
    // Process each team's players (using boxscore.players structure)
    boxscore.boxscore.players?.forEach((teamData: any) => {
      const espnTeamId = teamData.team?.id;
      const teamInfo = teamMapping.get(espnTeamId);
      
      if (!teamInfo) {
        console.warn(`Could not find team mapping for ESPN team ID: ${espnTeamId}`);
        return;
      }
      
      teamData.statistics?.forEach((statGroup: any) => {
        if (statGroup.athletes) {
          statGroup.athletes.forEach((player: any) => {
            const stats = parsePlayerStats(
              player,
              teamInfo.dbTeamId,
              game.id,
              new Date(game.start_time),
              teamInfo.opponentId,
              teamInfo.isHome
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
    errors++;
    // Don't log every error to avoid spam
    if (errors % 10 === 0) {
      console.error(chalk.red(`\n${errors} errors so far. Latest: ${error.message}\n`));
    }
  }
}

async function main() {
  console.log(chalk.bold.blue('\n🏀 NBA PLAYER STATS COLLECTOR - OPTIMIZED\n'));
  console.log(chalk.yellow('🖥️  CPU: Ryzen 5 7600X (6 cores/12 threads)'));
  console.log(chalk.yellow('⚡ Optimization: 10 concurrent requests, 20 game batches'));
  console.log(chalk.yellow('🚀 Maximum throughput mode enabled\n'));
  
  const startTime = Date.now();
  
  try {
    // Load all players
    await loadAllPlayers();
    
    // Check for resume point
    await getLastProcessedGame();
    
    // Get all completed NBA games
    console.log(chalk.yellow('Loading NBA games...'));
    let allGames: any[] = [];
    let offset = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: games, error } = await supabase
        .from('games')
        .select('*')
        .eq('sport', 'NBA')
        .eq('status', 'completed')
        .not('home_score', 'is', null)
        .gt('id', lastProcessedGameId) // Resume from last processed
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);
      
      if (error) throw error;
      
      if (games && games.length > 0) {
        allGames = allGames.concat(games);
      }
      
      hasMore = games && games.length === pageSize;
      offset += pageSize;
    }
    
    totalGames = allGames.length;
    console.log(chalk.cyan(`Found ${totalGames} games to process\n`));
    
    if (totalGames === 0) {
      console.log(chalk.green('✅ All games already processed!'));
      return;
    }
    
    progressBar.start(totalGames, 0, { stats: statsInserted, errors: errors });
    
    // Process in larger batches to maximize CPU usage
    const batchSize = 20; // Larger batches for 12 threads
    for (let i = 0; i < allGames.length; i += batchSize) {
      const batch = allGames.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(game => 
          limit(async () => {
            await processGame(game);
            processedGames++;
            progressBar.update(processedGames, { stats: statsInserted, errors: errors });
          })
        )
      );
      
      // Save progress every 100 games
      if (processedGames % 100 === 0) {
        lastProcessedGameId = batch[batch.length - 1].id;
      }
    }
    
    progressBar.stop();
    
    // Summary
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log(chalk.green('\n✅ Collection Complete!\n'));
    console.log(chalk.white(`📊 Summary:`));
    console.log(chalk.white(`   Games processed: ${processedGames}`));
    console.log(chalk.white(`   Player stats inserted: ${statsInserted}`));
    console.log(chalk.white(`   Games without stats: ${gamesWithoutStats}`));
    console.log(chalk.white(`   Errors: ${errors}`));
    console.log(chalk.white(`   Duration: ${duration} minutes`));
    
    if (missingPlayers.size > 0) {
      console.log(chalk.yellow(`\n⚠️  Found ${missingPlayers.size} unknown players`));
      console.log(chalk.yellow('   Run player collection to add missing players'));
    }
    
    // Final count
    const { count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.cyan(`\n🗄️  Total player game logs in database: ${count}`));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Fatal error:'), error);
    process.exit(1);
  }
}

// Run the collector
main().catch(console.error);