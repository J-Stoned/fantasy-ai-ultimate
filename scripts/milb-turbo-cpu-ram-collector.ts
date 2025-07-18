import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🚀 MAXIMIZE RYZEN 5 7600X (12 threads) + 32GB RAM
const HTTP_CONCURRENCY = 200;  // Max HTTP threads
const DB_QUERY_LIMIT = 1000;   // Respect DB limit
const STATS_BUFFER_SIZE = 10000; // Use more RAM for buffering
const PLAYER_BATCH_SIZE = 1000; // Load players in batches

const httpLimit = pLimit(HTTP_CONCURRENCY);

// Global caches in RAM
const playerCache = new Map<string, number>();
const gameCache = new Map<number, any>();
const statsBuffer: any[] = [];

async function turboCollectWithCPURAM() {
  console.log(chalk.cyan('⚡⚡⚡ TURBO MiLB COLLECTOR - CPU/RAM OPTIMIZED ⚡⚡⚡\n'));
  console.log(chalk.yellow(`💻 CPU: Ryzen 5 7600X (12 threads) | RAM: 32GB`));
  console.log(chalk.yellow(`🚀 Settings: ${HTTP_CONCURRENCY} HTTP threads | ${STATS_BUFFER_SIZE} stats buffer\n`));
  
  const startTime = Date.now();
  
  try {
    // 1️⃣ LOAD ALL PLAYERS INTO RAM (with pagination)
    console.log(chalk.blue('1️⃣ Loading all MiLB players into RAM...'));
    let playerOffset = 0;
    let totalPlayers = 0;
    
    while (true) {
      const { data: playerBatch, count } = await supabase
        .from('players')
        .select('id, external_id', { count: 'exact' })
        .eq('sport', 'MILB')
        .range(playerOffset, playerOffset + DB_QUERY_LIMIT - 1);
        
      if (!playerBatch || playerBatch.length === 0) break;
      
      playerBatch.forEach(p => {
        playerCache.set(p.external_id, p.id);
      });
      
      totalPlayers = count || 0;
      playerOffset += DB_QUERY_LIMIT;
      
      console.log(chalk.green(`   Loaded ${playerCache.size}/${totalPlayers} players...`));
    }
    
    console.log(chalk.green(`✅ Loaded ${playerCache.size} players into RAM\n`));
    
    // 2️⃣ GET TOTAL GAME COUNT
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'MILB');
      
    console.log(chalk.blue(`2️⃣ Processing ${totalGames} MiLB games...\n`));
    
    // 3️⃣ PROCESS GAMES WITH PROPER PAGINATION
    let gameOffset = 0;
    let totalStats = 0;
    let gamesWithStats = 0;
    let emptyStatsSkipped = 0;
    let gamesProcessed = 0;
    
    while (gameOffset < totalGames!) {
      // Load batch of games
      const { data: gameBatch } = await supabase
        .from('games')
        .select('*')
        .eq('sport', 'MILB')
        .order('id')
        .range(gameOffset, Math.min(gameOffset + DB_QUERY_LIMIT - 1, totalGames! - 1));
        
      if (!gameBatch || gameBatch.length === 0) break;
      
      // Cache games in RAM
      gameBatch.forEach(g => gameCache.set(g.id, g));
      
      // Process games in parallel chunks
      const chunkSize = 50;
      for (let i = 0; i < gameBatch.length; i += chunkSize) {
        const chunk = gameBatch.slice(i, i + chunkSize);
        
        const promises = chunk.map(game =>
          httpLimit(async () => {
            try {
              const gameId = parseInt(game.external_id.replace('mlb_milb_', ''));
              
              const response = await axios.get(
                `https://statsapi.mlb.com/api/v1/game/${gameId}/boxscore`,
                { timeout: 5000 }
              );
              
              const boxscore = response.data;
              if (!boxscore.teams) return;
              
              let gameHasValidStats = false;
              
              for (const side of ['away', 'home'] as const) {
                const teamData = boxscore.teams[side];
                if (!teamData?.players) continue;
                
                for (const playerId in teamData.players) {
                  const player = teamData.players[playerId];
                  if (!player?.stats) continue;
                  
                  // Extract numeric ID
                  const numericPlayerId = playerId.replace(/^\D+/, '');
                  const playerExtId = `mlb_milb_${numericPlayerId}`;
                  const dbPlayerId = playerCache.get(playerExtId);
                  
                  if (!dbPlayerId) continue;
                  
                  // Process batting stats
                  if (player.stats.batting) {
                    const batting = player.stats.batting;
                    
                    // Check for valid data
                    const hasData = Object.values(batting).some(v => 
                      v !== null && v !== undefined && v !== '' && v !== 0
                    );
                    
                    if (hasData) {
                      statsBuffer.push({
                        player_id: dbPlayerId,
                        game_id: game.id,
                        team_id: side === 'home' ? game.home_team_id : game.away_team_id,
                        opponent_id: side === 'home' ? game.away_team_id : game.home_team_id,
                        game_date: game.start_time,
                        is_home: side === 'home',
                        stats: { ...batting, statType: 'batting' }
                      });
                      
                      totalStats++;
                      gameHasValidStats = true;
                    } else {
                      emptyStatsSkipped++;
                    }
                  }
                  
                  // Process pitching stats
                  if (player.stats.pitching) {
                    const pitching = player.stats.pitching;
                    
                    const hasData = pitching.inningsPitched || pitching.outs ||
                      Object.values(pitching).some(v => 
                        v !== null && v !== undefined && v !== '' && v !== 0
                      );
                    
                    if (hasData) {
                      statsBuffer.push({
                        player_id: dbPlayerId,
                        game_id: game.id,
                        team_id: side === 'home' ? game.home_team_id : game.away_team_id,
                        opponent_id: side === 'home' ? game.away_team_id : game.home_team_id,
                        game_date: game.start_time,
                        is_home: side === 'home',
                        stats: { ...pitching, statType: 'pitching' }
                      });
                      
                      totalStats++;
                      gameHasValidStats = true;
                    } else {
                      emptyStatsSkipped++;
                    }
                  }
                  
                  // Process fielding stats
                  if (player.stats.fielding) {
                    for (const position in player.stats.fielding) {
                      const fielding = player.stats.fielding[position];
                      
                      if (fielding && Object.values(fielding).some(v => 
                        v !== null && v !== undefined && v !== '' && v !== 0
                      )) {
                        statsBuffer.push({
                          player_id: dbPlayerId,
                          game_id: game.id,
                          team_id: side === 'home' ? game.home_team_id : game.away_team_id,
                          opponent_id: side === 'home' ? game.away_team_id : game.home_team_id,
                          game_date: game.start_time,
                          is_home: side === 'home',
                          stats: { ...fielding, position, statType: 'fielding' }
                        });
                        
                        totalStats++;
                        gameHasValidStats = true;
                      }
                    }
                  }
                }
              }
              
              if (gameHasValidStats) {
                gamesWithStats++;
              }
              
              gamesProcessed++;
              
            } catch (error) {
              // Skip errors
              gamesProcessed++;
            }
          })
        );
        
        await Promise.all(promises);
        
        // Flush buffer if needed
        if (statsBuffer.length >= STATS_BUFFER_SIZE) {
          await flushStatsWithPagination();
        }
      }
      
      // Progress update
      const progress = Math.round(gamesProcessed / totalGames! * 100);
      const elapsed = (Date.now() - startTime) / 1000;
      const statsPerSec = Math.round(totalStats / elapsed);
      const gamesPerSec = Math.round(gamesProcessed / elapsed);
      
      console.log(chalk.green(
        `Progress: ${progress}% | ${gamesProcessed}/${totalGames} games (${gamesPerSec}/sec) | ` +
        `${gamesWithStats} with stats | ${totalStats} stats (${statsPerSec}/sec) | ` +
        `${emptyStatsSkipped} empty`
      ));
      
      // Clear game cache to free RAM
      gameCache.clear();
      
      // Move to next batch
      gameOffset += DB_QUERY_LIMIT;
    }
    
    // Final flush
    if (statsBuffer.length > 0) {
      await flushStatsWithPagination();
    }
    
    // Summary
    const totalTime = (Date.now() - startTime) / 1000;
    const finalStatsPerSec = Math.round(totalStats / totalTime);
    
    console.log(chalk.cyan('\n\n🏆 TURBO COLLECTION COMPLETE!'));
    console.log(chalk.green(`✅ Games processed: ${gamesProcessed}`));
    console.log(chalk.green(`✅ Games with valid stats: ${gamesWithStats} (${Math.round(gamesWithStats/totalGames!*100)}%)`));
    console.log(chalk.green(`✅ Valid stats collected: ${totalStats}`));
    console.log(chalk.yellow(`⚠️  Empty stats skipped: ${emptyStatsSkipped}`));
    console.log(chalk.yellow(`⚡ Performance: ${finalStatsPerSec} stats/second`));
    console.log(chalk.yellow(`⏱️  Total time: ${(totalTime / 60).toFixed(1)} minutes`));
    
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
  }
}

async function flushStatsWithPagination() {
  const batch = [...statsBuffer];
  statsBuffer.length = 0;
  
  // Deduplicate
  const uniqueStats = new Map();
  batch.forEach(stat => {
    const key = `${stat.player_id}-${stat.game_id}-${stat.stats.statType || 'unknown'}`;
    uniqueStats.set(key, stat);
  });
  
  const dedupedBatch = Array.from(uniqueStats.values());
  console.log(chalk.blue(`💾 Flushing ${dedupedBatch.length} unique stats...`));
  
  // Insert in chunks respecting DB limit
  for (let i = 0; i < dedupedBatch.length; i += DB_QUERY_LIMIT) {
    const chunk = dedupedBatch.slice(i, i + DB_QUERY_LIMIT);
    
    const { error } = await supabase
      .from('player_game_logs')
      .upsert(chunk, {
        onConflict: 'player_id,game_id',
        ignoreDuplicates: true
      });
      
    if (error && !error.message.includes('duplicate')) {
      console.error(chalk.red('Insert error:', error.message));
    }
  }
}

// LAUNCH THE TURBO COLLECTOR!
turboCollectWithCPURAM()
  .then(() => {
    console.log(chalk.cyan('\n✅ Turbo collection complete!'));
    process.exit(0);
  })
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });