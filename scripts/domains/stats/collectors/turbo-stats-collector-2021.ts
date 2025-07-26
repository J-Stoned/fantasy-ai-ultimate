#!/usr/bin/env tsx
/**
 * 🚀 TURBO STATS COLLECTOR FOR 2021 SEASON - 10X MODE
 * 
 * Optimized for Ryzen 5 7600X + 32GB RAM
 * Processes stats in parallel with maximum efficiency
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

// Maximum concurrent operations for Ryzen 5 7600X
// Reduced for MLB to avoid 504 errors
const limit = pLimit(10);

// Sport configurations
const SPORT_CONFIGS = {
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

async function collectStats(sport: string) {
  console.log(chalk.blue(`\n🚀 TURBO STATS COLLECTION: ${sport.toUpperCase()} 2021 SEASON\n`));
  
  const config = SPORT_CONFIGS[sport.toLowerCase()];
  if (!config) {
    console.error(chalk.red('Invalid sport!'));
    return;
  }

  // Get all games for the season with pagination
  let allGames: any[] = [];
  let offset = 0;
  const pageSize = 1000;
  
  console.log(chalk.yellow('📊 Loading games...'));
  
  while (true) {
    const { data: games } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_team_id, away_team_id')
      .eq('sport', sport.toUpperCase())
      .eq('metadata->>season', '2021')
      .range(offset, offset + pageSize - 1)
      .order('id');
      
    if (!games || games.length === 0) break;
    
    allGames = allGames.concat(games);
    offset += games.length;
    
    if (games.length < pageSize) break;
  }
  
  console.log(chalk.green(`✅ Found ${allGames.length} games`));
  
  // Create player and team maps for fast lookups
  console.log(chalk.yellow('📊 Loading players and teams...'));
  
  // Load ALL players with pagination
  let allPlayers: any[] = [];
  let playerOffset = 0;
  const playerPageSize = 1000;
  
  while (true) {
    const { data: players } = await supabase
      .from('players')
      .select('id, external_id')
      .eq('sport', sport.toUpperCase())
      .range(playerOffset, playerOffset + playerPageSize - 1)
      .order('id');
      
    if (!players || players.length === 0) break;
    
    allPlayers = allPlayers.concat(players);
    playerOffset += players.length;
    
    if (players.length < playerPageSize) break;
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
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} games | Stats: {stats} | Speed: {speed}/sec | ETA: {eta}s',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  });
  
  progressBar.start(allGames.length, 0, { stats: 0, speed: 0 });
  
  let totalStats = 0;
  let processedGames = 0;
  const startTime = Date.now();
  
  // Process in chunks for better memory management
  const chunkSize = 50;
  const gameChunks = [];
  for (let i = 0; i < allGames.length; i += chunkSize) {
    gameChunks.push(allGames.slice(i, i + chunkSize));
  }
  
  for (const chunk of gameChunks) {
    const chunkStats: any[] = [];
    
    await Promise.all(
      chunk.map(game => 
        limit(async () => {
          try {
            const gameId = game.external_id.split('_').pop();
            const url = `https://site.api.espn.com/apis/site/v2/sports/${config.urlPath}/summary?event=${gameId}`;
            
            // Retry logic for 504 errors
            let attempts = 0;
            let response;
            
            while (attempts < 3) {
              try {
                response = await axios.get(url, { 
                  timeout: 15000,
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                  }
                });
                break;
              } catch (err: any) {
                attempts++;
                if (err.response?.status === 504 && attempts < 3) {
                  await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
                  continue;
                }
                throw err;
              }
            }
            
            if (!response) throw new Error('Failed after 3 attempts');
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
                  
                  const statValues = athlete.stats || [];
                  const stats: any = {};
                  
                  // Map stats based on labels
                  labels.forEach((label: string, index: number) => {
                    const value = statValues[index];
                    if (value !== undefined && value !== null && value !== '') {
                      stats[label.toLowerCase().replace(/\s+/g, '_')] = value;
                    }
                  });
                  
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
                      collection_source: 'turbo-2021-stats'
                    }
                  });
                }
              }
            }
          } catch (error: any) {
            if (error.response?.status !== 404) {
              console.error(chalk.red(`\nError processing game ${game.id}:`), error.message);
            }
          }
        })
      )
    );
    
    // Batch insert stats
    if (chunkStats.length > 0) {
      const { error } = await supabase
        .from('player_game_logs')
        .upsert(chunkStats, {
          onConflict: 'player_id,game_id',
          ignoreDuplicates: true
        });
        
      if (error && !error.message.includes('duplicate key')) {
        console.error(chalk.red('Error inserting stats:'), error.message);
      } else {
        totalStats += chunkStats.length;
      }
    }
    
    processedGames += chunk.length;
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = Math.round(processedGames / elapsed);
    const eta = Math.round((allGames.length - processedGames) / speed);
    
    progressBar.update(processedGames, { 
      stats: totalStats, 
      speed: speed,
      eta: eta
    });
  }
  
  progressBar.stop();
  
  console.log(chalk.green(`\n✅ Collection complete!`));
  console.log(chalk.blue(`📊 Total stats collected: ${totalStats}`));
  console.log(chalk.blue(`⏱️  Time: ${Math.round((Date.now() - startTime) / 1000)}s`));
  console.log(chalk.blue(`🚀 Speed: ${Math.round(totalStats / ((Date.now() - startTime) / 1000))} stats/sec`));
}

// CLI
const sport = process.argv[2];
if (!sport || !['nba', 'mlb', 'nhl'].includes(sport.toLowerCase())) {
  console.log(chalk.red('Usage: npx tsx turbo-stats-collector-2021.ts <sport>'));
  console.log(chalk.gray('Sports: nba, mlb, nhl'));
  process.exit(1);
}

collectStats(sport).catch(console.error);