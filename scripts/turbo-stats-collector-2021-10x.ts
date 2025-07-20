#!/usr/bin/env tsx
/**
 * 🚀 TURBO STATS COLLECTOR FOR 2021 SEASON - 10X OPTIMIZED
 * 
 * FULLY OPTIMIZED for Ryzen 5 7600X + 32GB RAM with:
 * - Deduplication: Skip existing stats
 * - Pagination: Handle 1K DB query limits
 * - Hardware optimization: 200 concurrent requests
 * - Smart batching: 1K inserts at once
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🔥 10X PERFORMANCE SETTINGS
const HTTP_LIMIT = pLimit(200); // 200 concurrent HTTP requests!
const DB_LIMIT = pLimit(50); // 50 concurrent DB operations
const GAME_BATCH = 200; // Process 200 games at once
const INSERT_BATCH = 1000; // Insert 1K records at once (Supabase limit)

// Deduplication cache
const existingStatsCache = new Set<string>();

// Sport configurations (add NFL)
const SPORT_CONFIGS = {
  nfl: {
    urlPath: 'football/nfl',
    statGroups: ['passing', 'rushing', 'receiving', 'defensive'],
    season: {
      regular: { start: '2021-09-09', end: '2022-01-09' },
      playoffs: { start: '2022-01-15', end: '2022-02-13' }
    }
  },
  nba: {
    urlPath: 'basketball/nba',
    statGroups: ['statistics', 'advanced'],
    season: {
      regular: { start: '2021-10-19', end: '2022-04-10' },
      playoffs: { start: '2022-04-16', end: '2022-06-16' }
    }
  },
  mlb: {
    urlPath: 'baseball/mlb',
    statGroups: ['batting', 'pitching', 'fielding'],
    season: {
      regular: { start: '2021-04-01', end: '2021-10-03' },
      playoffs: { start: '2021-10-05', end: '2021-11-02' }
    }
  },
  nhl: {
    urlPath: 'hockey/nhl',
    statGroups: ['statistics', 'advanced'],
    season: {
      regular: { start: '2021-10-12', end: '2022-04-29' },
      playoffs: { start: '2022-05-02', end: '2022-06-26' }
    }
  }
};

// Load existing stats to avoid duplicates
async function loadExistingStats(sport: string) {
  console.log(chalk.gray('  Loading existing stats for deduplication...'));
  
  let offset = 0;
  let count = 0;
  
  while (true) {
    const { data: stats } = await supabase
      .from('player_game_logs')
      .select('player_id, game_id')
      .eq('metadata->>sport', sport.toUpperCase())
      .range(offset, offset + 999); // 1K limit
    
    if (!stats || stats.length === 0) break;
    
    stats.forEach(s => {
      existingStatsCache.add(`${s.player_id}_${s.game_id}`);
      count++;
    });
    
    offset += stats.length;
    if (stats.length < 1000) break;
  }
  
  console.log(chalk.gray(`    Found ${count.toLocaleString()} existing stats`));
}

async function collectStats(sport: string) {
  console.log(chalk.bold.cyan(`\n🚀 TURBO STATS COLLECTION: ${sport.toUpperCase()} 2021 SEASON - 10X MODE\n`));
  
  const config = SPORT_CONFIGS[sport.toLowerCase()];
  if (!config) {
    console.error(chalk.red('Invalid sport!'));
    return;
  }

  // Load existing stats first
  await loadExistingStats(sport);

  // Get all games for the season with proper pagination
  let allGames: any[] = [];
  let offset = 0;
  
  console.log(chalk.yellow('📊 Loading games...'));
  
  while (true) {
    const { data: games } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_team_id, away_team_id')
      .eq('sport', sport.toUpperCase())
      .eq('status', 'Final')
      .gte('start_time', config.season.regular.start)
      .lte('start_time', config.season.playoffs.end)
      .range(offset, offset + 999) // 1K limit
      .order('id');
      
    if (!games || games.length === 0) break;
    
    allGames = allGames.concat(games);
    offset += games.length;
    
    if (games.length < 1000) break;
  }
  
  console.log(chalk.green(`✅ Found ${allGames.length} games`));
  
  // Load ALL players with proper pagination
  console.log(chalk.yellow('📊 Loading players and teams...'));
  
  let allPlayers: any[] = [];
  let playerOffset = 0;
  
  while (true) {
    const { data: players } = await supabase
      .from('players')
      .select('id, external_id')
      .eq('sport', sport.toUpperCase())
      .range(playerOffset, playerOffset + 999) // 1K limit
      .order('id');
      
    if (!players || players.length === 0) break;
    
    allPlayers = allPlayers.concat(players);
    playerOffset += players.length;
    
    if (players.length < 1000) break;
  }
  
  const playerMap = new Map(
    allPlayers.map(p => [p.external_id, p.id])
  );
  
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', sport.toUpperCase());
    
  const teamMap = new Map(
    teams?.map(t => [t.external_id.split('_').pop(), t.id]) || []
  );
  
  console.log(chalk.green(`✅ Loaded ${playerMap.size} players, ${teamMap.size} teams`));
  
  // Filter out games that already have complete stats
  console.log(chalk.yellow('🔍 Checking for games needing stats...'));
  
  const gamesNeedingStats = [];
  for (const game of allGames) {
    // Quick check if we have any stats for this game
    let hasStats = false;
    for (const [playerId] of playerMap) {
      const dbPlayerId = playerMap.get(playerId);
      if (dbPlayerId && existingStatsCache.has(`${dbPlayerId}_${game.id}`)) {
        hasStats = true;
        break;
      }
    }
    
    if (!hasStats) {
      gamesNeedingStats.push(game);
    }
  }
  
  console.log(chalk.yellow(`📊 ${gamesNeedingStats.length} games need stats (${allGames.length - gamesNeedingStats.length} already have stats)`));
  
  if (gamesNeedingStats.length === 0) {
    console.log(chalk.green('✅ All games already have stats!'));
    return;
  }
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} games | Stats: {stats} | Speed: {speed}/sec | ETA: {eta}s',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  });
  
  progressBar.start(gamesNeedingStats.length, 0, { stats: 0, speed: 0 });
  
  let totalStats = 0;
  let processedGames = 0;
  const startTime = Date.now();
  
  // Process in larger chunks with 10X concurrency
  const gameChunks = [];
  for (let i = 0; i < gamesNeedingStats.length; i += GAME_BATCH) {
    gameChunks.push(gamesNeedingStats.slice(i, i + GAME_BATCH));
  }
  
  for (const chunk of gameChunks) {
    const chunkStats: any[] = [];
    
    await Promise.all(
      chunk.map(game => 
        HTTP_LIMIT(async () => {
          try {
            const gameId = game.external_id.split('_').pop();
            const url = `https://site.api.espn.com/apis/site/v2/sports/${config.urlPath}/summary?event=${gameId}`;
            
            const response = await axios.get(url, { 
              timeout: 10000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });
            
            const data = response.data;
            
            if (!data.boxscore?.players) return;
            
            for (const team of data.boxscore.players) {
              const espnTeamId = team.team.id;
              const teamId = teamMap.get(String(espnTeamId));
              if (!teamId) continue;
              
              const isHome = team.homeAway === 'home';
              const opponentId = isHome ? game.away_team_id : game.home_team_id;
              
              // Process all stat groups
              for (const statGroup of team.statistics || []) {
                const groupName = statGroup.name?.toLowerCase() || '';
                const labels = statGroup.labels || statGroup.names || [];
                
                for (const athlete of statGroup.athletes || []) {
                  const playerId = athlete.athlete?.id;
                  if (!playerId) continue;
                  
                  const dbPlayerId = playerMap.get(`espn_${sport.toLowerCase()}_${playerId}`);
                  if (!dbPlayerId) continue;
                  
                  // Skip if we already have this stat
                  const statKey = `${dbPlayerId}_${game.id}`;
                  if (existingStatsCache.has(statKey)) continue;
                  
                  const statValues = athlete.stats || [];
                  const stats: any = {};
                  
                  // Sport-specific stat parsing
                  if (sport === 'nba' && statValues.length >= 15) {
                    stats.minutes_played = parseFloat(statValues[0]) || 0;
                    stats.field_goals_made = parseInt(statValues[1]) || 0;
                    stats.field_goals_attempted = parseInt(statValues[2]) || 0;
                    stats.three_pointers_made = parseInt(statValues[4]) || 0;
                    stats.three_pointers_attempted = parseInt(statValues[5]) || 0;
                    stats.free_throws_made = parseInt(statValues[7]) || 0;
                    stats.free_throws_attempted = parseInt(statValues[8]) || 0;
                    stats.offensive_rebounds = parseInt(statValues[10]) || 0;
                    stats.defensive_rebounds = parseInt(statValues[11]) || 0;
                    stats.rebounds = parseInt(statValues[12]) || 0;
                    stats.assists = parseInt(statValues[13]) || 0;
                    stats.steals = parseInt(statValues[14]) || 0;
                    stats.blocks = parseInt(statValues[15]) || 0;
                    stats.turnovers = parseInt(statValues[16]) || 0;
                    stats.fouls = parseInt(statValues[17]) || 0;
                    stats.points = parseInt(statValues[19]) || 0;
                  } else if (sport === 'nhl' && (groupName.includes('forward') || groupName.includes('defense'))) {
                    // NHL stats based on the labels shown in diagnostic
                    // Note: ESPN uses both 'forward'/'forwards' and 'defense'/'defenses'
                    // Labels: BS,HT,TK,+/-,TOI,PPTOI,SHTOI,ESTOI,SHFT,G,YTDG,A,S,SM,SOG,FW,FL,FO%,GV,PN,PIM
                    stats.goals = parseInt(statValues[9]) || 0;          // G
                    stats.assists = parseInt(statValues[11]) || 0;       // A
                    stats.shots = parseInt(statValues[12]) || 0;         // S
                    stats.shots_on_goal = parseInt(statValues[14]) || 0; // SOG
                    stats.plus_minus = parseInt(statValues[3]) || 0;     // +/-
                    stats.penalty_minutes = parseInt(statValues[20]) || 0; // PIM
                    stats.blocked_shots = parseInt(statValues[0]) || 0;  // BS
                    stats.hits = parseInt(statValues[1]) || 0;           // HT
                    stats.takeaways = parseInt(statValues[2]) || 0;      // TK
                    stats.time_on_ice = statValues[4] || '0:00';         // TOI
                    stats.faceoff_wins = parseInt(statValues[15]) || 0;  // FW
                    stats.faceoff_losses = parseInt(statValues[16]) || 0; // FL
                    stats.points = stats.goals + stats.assists;          // Calculate points
                  } else if (sport === 'nhl' && groupName.includes('goalie')) {
                    // Goalie stats have different structure
                    stats.saves = parseInt(statValues[3]) || 0;
                    stats.goals_against = parseInt(statValues[1]) || 0;
                    stats.shots_against = parseInt(statValues[2]) || 0;
                    stats.save_percentage = statValues[4] || 0;
                    stats.time_on_ice = statValues[0] || '0:00';
                  } else if (sport === 'mlb' && groupName.includes('batting')) {
                    stats.at_bats = parseInt(statValues[0]) || 0;
                    stats.runs = parseInt(statValues[1]) || 0;
                    stats.hits = parseInt(statValues[2]) || 0;
                    stats.runs_batted_in = parseInt(statValues[3]) || 0;
                    stats.home_runs = parseInt(statValues[4]) || 0;
                    stats.walks = parseInt(statValues[5]) || 0;
                    stats.strikeouts = parseInt(statValues[6]) || 0;
                  } else if (sport === 'nfl') {
                    // Generic label mapping for NFL
                    labels.forEach((label: string, index: number) => {
                      const value = statValues[index];
                      if (value !== undefined && value !== null && value !== '' && value !== '-') {
                        const cleanLabel = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                        stats[cleanLabel] = isNaN(value) ? value : parseFloat(value);
                      }
                    });
                  } else {
                    // Generic mapping for other cases
                    labels.forEach((label: string, index: number) => {
                      const value = statValues[index];
                      if (value !== undefined && value !== null && value !== '') {
                        stats[label.toLowerCase().replace(/\s+/g, '_')] = value;
                      }
                    });
                  }
                  
                  if (Object.keys(stats).length === 0) continue;
                  
                  // Calculate fantasy points
                  let fantasyPoints = 0;
                  if (sport === 'nba') {
                    fantasyPoints = (stats.points || 0) + 
                                   (stats.rebounds || 0) * 1.2 + 
                                   (stats.assists || 0) * 1.5 + 
                                   (stats.steals || 0) * 3 + 
                                   (stats.blocks || 0) * 3 - 
                                   (stats.turnovers || 0);
                  } else if (sport === 'nhl') {
                    fantasyPoints = (stats.goals || 0) * 3 + 
                                   (stats.assists || 0) * 2 + 
                                   (stats.shots_on_goal || 0) * 0.5;
                  } else if (sport === 'mlb') {
                    fantasyPoints = (stats.hits || 0) * 3 + 
                                   (stats.runs || 0) * 2 + 
                                   (stats.runs_batted_in || 0) * 2 + 
                                   (stats.home_runs || 0) * 4 + 
                                   (stats.walks || 0) - 
                                   (stats.strikeouts || 0) * 0.5;
                  }
                  
                  chunkStats.push({
                    player_id: dbPlayerId,
                    game_id: game.id,
                    team_id: teamId,
                    opponent_id: opponentId,
                    game_date: new Date(game.start_time).toISOString().split('T')[0],
                    is_home: isHome,
                    stats: stats,
                    fantasy_points: fantasyPoints,
                    metadata: {
                      sport: sport.toUpperCase(),
                      stat_group: groupName,
                      collection_source: 'turbo-2021-stats-10x'
                    }
                  });
                  
                  // Add to cache to prevent duplicates within this run
                  existingStatsCache.add(statKey);
                }
              }
            }
          } catch (error: any) {
            // Silently skip 404s and other errors
          }
        })
      )
    );
    
    // Batch insert stats with proper size limit
    if (chunkStats.length > 0) {
      // Insert in batches of 1000 (Supabase limit)
      for (let i = 0; i < chunkStats.length; i += INSERT_BATCH) {
        const insertBatch = chunkStats.slice(i, i + INSERT_BATCH);
        
        const { error } = await DB_LIMIT(async () => 
          supabase
            .from('player_game_logs')
            .insert(insertBatch)
        );
        
        if (!error) {
          totalStats += insertBatch.length;
        }
      }
    }
    
    processedGames += chunk.length;
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = Math.round(processedGames / elapsed);
    const eta = Math.round((gamesNeedingStats.length - processedGames) / speed);
    
    progressBar.update(processedGames, { 
      stats: totalStats, 
      speed: speed,
      eta: eta
    });
  }
  
  progressBar.stop();
  
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  const finalSpeed = Math.round(totalStats / totalTime);
  
  console.log(chalk.green(`\n✅ Collection complete!`));
  console.log(chalk.blue(`📊 Total stats collected: ${totalStats.toLocaleString()}`));
  console.log(chalk.blue(`⏱️  Time: ${totalTime}s (${(totalTime / 60).toFixed(1)} minutes)`));
  console.log(chalk.blue(`🚀 Speed: ${finalSpeed} stats/sec`));
  console.log(chalk.yellow(`⚡ Performance: ${Math.round(processedGames / totalTime)} games/sec`));
}

// CLI
const sport = process.argv[2];
if (!sport || !['nfl', 'nba', 'mlb', 'nhl'].includes(sport.toLowerCase())) {
  console.log(chalk.red('Usage: npx tsx turbo-stats-collector-2021-10x.ts <sport>'));
  console.log(chalk.gray('Sports: nfl, nba, mlb, nhl'));
  process.exit(1);
}

collectStats(sport)
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });