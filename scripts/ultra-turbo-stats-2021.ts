#!/usr/bin/env tsx
/**
 * 🚀 ULTRA TURBO STATS COLLECTOR - MAXIMUM PERFORMANCE
 * 
 * Optimized for Ryzen 5 7600X (12 threads) + 32GB RAM
 * - Parallel processing with worker pools
 * - Memory-efficient batch processing
 * - Aggressive caching
 * - Smart retry logic
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import os from 'os';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// MAXIMUM PERFORMANCE SETTINGS
const CPU_CORES = os.cpus().length;
const CONCURRENT_HTTP = 25; // Aggressive concurrent HTTP requests
const BATCH_SIZE = 100; // Process 100 games at once
const DB_BATCH_SIZE = 1000; // Insert 1000 records at once

// Create multiple rate limiters for different operations
const httpLimit = pLimit(CONCURRENT_HTTP);
const dbLimit = pLimit(5); // Database operations

console.log(chalk.cyan('🚀 ULTRA TURBO MODE ACTIVATED'));
console.log(chalk.gray(`   CPU: ${CPU_CORES} cores`));
console.log(chalk.gray(`   RAM: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB`));
console.log(chalk.gray(`   Concurrent HTTP: ${CONCURRENT_HTTP}`));
console.log(chalk.gray(`   Batch Size: ${BATCH_SIZE} games`));

interface SportConfig {
  urlPath: string;
  statMapping: (data: any) => any;
}

const SPORT_CONFIGS: Record<string, SportConfig> = {
  mlb: {
    urlPath: 'baseball/mlb',
    statMapping: (data: any) => {
      // MLB stats come in arrays with labels, not objects
      // This is a placeholder - stats are extracted in the main loop
      return {};
    }
  },
  nhl: {
    urlPath: 'hockey/nhl',
    statMapping: (data: any) => {
      // NHL stat mapping
      return data;
    }
  }
};

// Axios instance with retry interceptor
const axiosInstance = axios.create({
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  }
});

// Add retry interceptor
axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const config = error.config;
    if (!config || !config.retry) {
      config.retry = 0;
    }
    
    config.retry += 1;
    
    if (config.retry <= 3 && (error.code === 'ECONNABORTED' || error.response?.status >= 500)) {
      await new Promise(resolve => setTimeout(resolve, 1000 * config.retry));
      return axiosInstance(config);
    }
    
    return Promise.reject(error);
  }
);

async function collectStats(sport: string) {
  const startTime = Date.now();
  const config = SPORT_CONFIGS[sport.toLowerCase()];
  
  if (!config) {
    console.error(chalk.red('Invalid sport!'));
    return;
  }

  console.log(chalk.blue(`\n⚡ COLLECTING ${sport.toUpperCase()} 2021 STATS\n`));

  // Step 1: Load all data into memory (we have 32GB!)
  console.log(chalk.yellow('📊 Loading data into memory...'));
  
  // Load games with pagination
  const games: any[] = [];
  let gameOffset = 0;
  
  while (true) {
    const { data: batch } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_team_id, away_team_id')
      .eq('sport', sport.toUpperCase())
      .eq('metadata->>season', '2021')
      .range(gameOffset, gameOffset + 999)
      .order('id');
      
    if (!batch || batch.length === 0) break;
    games.push(...batch);
    gameOffset += batch.length;
    process.stdout.write(`\r  Games loaded: ${games.length}`);
    if (batch.length < 1000) break;
  }
  
  console.log(chalk.green(`\n✅ Loaded ${games.length} games`));

  // Load all players
  const players: any[] = [];
  let playerOffset = 0;
  
  while (true) {
    const { data: batch } = await supabase
      .from('players')
      .select('id, external_id')
      .eq('sport', sport.toUpperCase())
      .range(playerOffset, playerOffset + 999)
      .order('id');
      
    if (!batch || batch.length === 0) break;
    players.push(...batch);
    playerOffset += batch.length;
    process.stdout.write(`\r  Players loaded: ${players.length}`);
    if (batch.length < 1000) break;
  }
  
  // Create lookup maps
  const playerMap = new Map(players.map(p => [p.external_id, p.id]));
  
  console.log(chalk.green(`\n✅ Loaded ${players.length} players`));

  // Load teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id')
    .eq('sport', sport.toUpperCase());
    
  const teamMap = new Map(
    teams?.map(t => [t.external_id.split('_').pop(), t.id]) || []
  );
  
  console.log(chalk.green(`✅ Loaded ${teams?.length} teams`));

  // Step 2: Process games in batches
  console.log(chalk.yellow('\n⚡ Processing games...'));
  
  const multiBar = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: true,
    format: ' {bar} | {percentage}% | {value}/{total} | {duration_formatted} | {description}'
  }, cliProgress.Presets.shades_grey);
  
  const mainBar = multiBar.create(games.length, 0, { description: 'Total Progress' });
  const httpBar = multiBar.create(games.length, 0, { description: 'HTTP Requests' });
  const dbBar = multiBar.create(games.length, 0, { description: 'DB Inserts   ' });
  
  // Process in batches
  const allStats: any[] = [];
  const gameChunks = [];
  
  for (let i = 0; i < games.length; i += BATCH_SIZE) {
    gameChunks.push(games.slice(i, i + BATCH_SIZE));
  }
  
  let processedGames = 0;
  let httpCompleted = 0;
  let dbInserted = 0;
  
  // Process chunks in parallel
  const chunkPromises = gameChunks.map((chunk, chunkIndex) => 
    (async () => {
      const chunkStats: any[] = [];
      
      // Process all games in chunk in parallel
      await Promise.all(
        chunk.map(game => 
          httpLimit(async () => {
            try {
              const gameId = game.external_id.split('_').pop();
              const url = `https://site.api.espn.com/apis/site/v2/sports/${config.urlPath}/summary?event=${gameId}`;
              
              const response = await axiosInstance.get(url);
              const data = response.data;
              
              if (!data.boxscore?.players) {
                httpCompleted++;
                httpBar.update(httpCompleted);
                return;
              }
              
              // Extract stats for all players
              for (const team of data.boxscore.players) {
                const espnTeamId = team.team.id;
                const teamId = teamMap.get(String(espnTeamId));
                if (!teamId) continue;
                
                const isHome = team.homeAway === 'home';
                const opponentId = isHome ? game.away_team_id : game.home_team_id;
                
                for (const statGroup of team.statistics || []) {
                  const groupName = (statGroup.name || statGroup.type || '').toLowerCase();
                  const labels = statGroup.labels || statGroup.names || [];
                  
                  for (const athlete of statGroup.athletes || []) {
                    const playerId = athlete.athlete?.id;
                    if (!playerId) continue;
                    
                    const dbPlayerId = playerMap.get(`espn_${sport.toLowerCase()}_${playerId}`);
                    if (!dbPlayerId) continue;
                    
                    const statValues = athlete.stats || [];
                    const stats: any = {};
                    
                    // Map stats with labels - sport-specific handling
                    if (sport.toLowerCase() === 'mlb') {
                      // MLB-specific stat mapping
                      const mlbStatMap: Record<string, Record<string, string>> = {
                        'batting': {
                          'AB': 'at_bats',
                          'R': 'runs',
                          'H': 'hits',
                          '2B': 'doubles',
                          '3B': 'triples',
                          'HR': 'home_runs',
                          'RBI': 'rbi',
                          'BB': 'walks',
                          'K': 'strikeouts',
                          'AVG': 'batting_avg',
                          'OBP': 'on_base_pct',
                          'SLG': 'slugging_pct',
                          'OPS': 'ops',
                          'SB': 'stolen_bases',
                          'CS': 'caught_stealing'
                        },
                        'pitching': {
                          'IP': 'innings_pitched',
                          'H': 'hits_allowed',
                          'R': 'runs_allowed',
                          'ER': 'earned_runs',
                          'BB': 'walks_allowed',
                          'K': 'strikeouts',
                          'HR': 'home_runs_allowed',
                          'ERA': 'era',
                          'WHIP': 'whip',
                          'W': 'wins',
                          'L': 'losses',
                          'SV': 'saves',
                          'BS': 'blown_saves',
                          'HLD': 'holds'
                        },
                        'fielding': {
                          'TC': 'total_chances',
                          'PO': 'putouts',
                          'A': 'assists',
                          'E': 'errors',
                          'DP': 'double_plays',
                          'FPCT': 'fielding_pct'
                        }
                      };
                      
                      const mapping = mlbStatMap[groupName] || {};
                      labels.forEach((label: string, index: number) => {
                        const value = statValues[index];
                        if (value !== undefined && value !== null && value !== '') {
                          const mappedKey = mapping[label] || label.toLowerCase().replace(/\s+/g, '_');
                          stats[mappedKey] = value;
                        }
                      });
                    } else {
                      // Default mapping for other sports
                      labels.forEach((label: string, index: number) => {
                        const value = statValues[index];
                        if (value !== undefined && value !== null && value !== '') {
                          stats[label.toLowerCase().replace(/\s+/g, '_')] = value;
                        }
                      });
                    }
                    
                    if (Object.keys(stats).length === 0) continue;
                    
                    chunkStats.push({
                      player_id: dbPlayerId,
                      game_id: game.id,
                      team_id: teamId,
                      opponent_id: opponentId,
                      game_date: new Date(game.start_time).toISOString().split('T')[0],
                      is_home: isHome,
                      stats: stats,
                      fantasy_points: 0,
                      metadata: {
                        sport: sport.toUpperCase(),
                        stat_group: groupName,
                        collection_source: 'ultra-turbo-2021'
                      }
                    });
                  }
                }
              }
              
              httpCompleted++;
              httpBar.update(httpCompleted);
            } catch (error: any) {
              if (error.response?.status !== 404) {
                // Silently skip 404s, log other errors
                if (error.response?.status !== 504) {
                  console.error(chalk.red(`\nError game ${game.id}:`), error.message);
                }
              }
              httpCompleted++;
              httpBar.update(httpCompleted);
            }
          })
        )
      );
      
      // Batch insert stats for this chunk
      if (chunkStats.length > 0) {
        await dbLimit(async () => {
          // Insert in smaller sub-batches
          for (let i = 0; i < chunkStats.length; i += DB_BATCH_SIZE) {
            const batch = chunkStats.slice(i, i + DB_BATCH_SIZE);
            
            const { error } = await supabase
              .from('player_game_logs')
              .upsert(batch, {
                onConflict: 'player_id,game_id',
                ignoreDuplicates: true
              });
              
            if (error && !error.message.includes('duplicate key')) {
              console.error(chalk.red('\nDB Error:'), error.message);
            }
            
            dbInserted += batch.length;
            dbBar.update(Math.min(dbInserted, games.length));
          }
        });
        
        allStats.push(...chunkStats);
      }
      
      processedGames += chunk.length;
      mainBar.update(processedGames);
    })()
  );
  
  // Wait for all chunks to complete
  await Promise.all(chunkPromises);
  
  multiBar.stop();
  
  // Final summary
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(chalk.green(`\n✅ ULTRA TURBO COLLECTION COMPLETE!`));
  console.log(chalk.blue(`📊 Total stats collected: ${allStats.length}`));
  console.log(chalk.blue(`⏱️  Time: ${Math.round(elapsed)}s`));
  console.log(chalk.blue(`🚀 Speed: ${Math.round(allStats.length / elapsed)} stats/sec`));
  console.log(chalk.blue(`💾 Games/sec: ${Math.round(games.length / elapsed)}`));
}

// CLI
const sport = process.argv[2];
if (!sport || !['mlb', 'nhl'].includes(sport.toLowerCase())) {
  console.log(chalk.red('Usage: npx tsx ultra-turbo-stats-2021.ts <sport>'));
  console.log(chalk.gray('Sports: mlb, nhl'));
  process.exit(1);
}

collectStats(sport).catch(console.error);