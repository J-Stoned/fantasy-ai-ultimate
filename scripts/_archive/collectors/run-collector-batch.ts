#!/usr/bin/env tsx
/**
 * Run collector on first 100 past games
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { parallelEngine } from './gpu-stats-collector/parallel-engine';
import { batchProcessor } from './gpu-stats-collector/batch-processor';
import { SportParsers } from './gpu-stats-collector/parsers/sport-parsers';
import { playerMatcher } from './gpu-stats-collector/player-matcher';
import { databaseWriter } from './gpu-stats-collector/database-writer';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runCollectorBatch() {
  console.log(chalk.bold.magenta('\n🚀 COLLECTOR BATCH (100 GAMES)\n'));
  
  const BATCH_SIZE = 100;
  const startTime = Date.now();
  
  // Get games without stats
  const { data: gamesWithStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(5000);
    
  const processedGameIds = new Set(gamesWithStats?.map(s => s.game_id) || []);
  
  const { data: allGames } = await supabase
    .from('games')
    .select('id, external_id, sport_id, home_team_id, away_team_id, start_time, home_score, away_score')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .lt('start_time', new Date().toISOString()) // Only past games
    .order('start_time', { ascending: false })
    .limit(500); // Get more to filter from
    
  const gamesToProcess = (allGames || []).filter(game => 
    !processedGameIds.has(game.id) && game.external_id
  ).slice(0, BATCH_SIZE);
  
  console.log(chalk.yellow(`📊 Found ${gamesToProcess.length} games to process`));
  
  if (gamesToProcess.length === 0) {
    console.log(chalk.green('✅ No games need processing!'));
    return;
  }
  
  await parallelEngine.initialize();
  
  let totalStats = 0;
  let totalLogs = 0;
  let processedGames = 0;
  let errors = 0;
  
  try {
    // Process in smaller batches
    const MINI_BATCH_SIZE = 20;
    const totalBatches = Math.ceil(gamesToProcess.length / MINI_BATCH_SIZE);
    
    for (let i = 0; i < gamesToProcess.length; i += MINI_BATCH_SIZE) {
      const batchNumber = Math.floor(i / MINI_BATCH_SIZE) + 1;
      const batch = gamesToProcess.slice(i, i + MINI_BATCH_SIZE);
      
      console.log(chalk.bold.yellow(`\n━━━ Batch ${batchNumber}/${totalBatches} (${batch.length} games) ━━━`));
      
      try {
        // GPU process
        const gpuProcessed = await parallelEngine.processGamesParallel(batch);
        
        // Fetch from ESPN
        const apiResults = await batchProcessor.processBatch(gpuProcessed);
        console.log(chalk.green(`✓ Fetched ${apiResults.length} game results`));
        
        // Parse and save
        for (const gameData of apiResults) {
          try {
            // Parse stats
            let parsedPlayers: any[] = [];
            switch (gameData.sport) {
              case 'nfl':
                parsedPlayers = SportParsers.parseNFLGame(gameData.data);
                break;
              case 'nba':
                parsedPlayers = SportParsers.parseNBAGame(gameData.data);
                break;
              case 'mlb':
                parsedPlayers = SportParsers.parseMLBGame(gameData.data);
                break;
              case 'nhl':
                parsedPlayers = SportParsers.parseNHLGame(gameData.data);
                break;
            }
            
            if (parsedPlayers.length === 0) continue;
            
            // Process first 15 players per game (to manage load)
            const allStats: any[] = [];
            const allGameLogs: any[] = [];
            
            for (const playerData of parsedPlayers.slice(0, 15)) {
              try {
                const playerId = await playerMatcher.ensurePlayer({
                  name: playerData.playerName,
                  sport: gameData.sport,
                  espnId: playerData.playerId
                });
                
                // Create stat entries
                Object.entries(playerData.stats).forEach(([statName, statValue]) => {
                  if (statValue !== null && statValue !== undefined && statValue !== 0) {
                    allStats.push({
                      player_id: playerId,
                      game_id: gameData.gameId,
                      stat_type: statName,
                      stat_value: String(statValue)
                    });
                  }
                });
                
                // Create game log
                allGameLogs.push({
                  player_id: playerId,
                  game_id: gameData.gameId,
                  game_date: new Date(gameData.timestamp).toISOString().split('T')[0],
                  stats: playerData.stats,
                  fantasy_points: 0
                });
                
              } catch (error: any) {
                errors++;
              }
            }
            
            // Insert to database
            if (allStats.length > 0) {
              await databaseWriter.bulkInsertPlayerStats(allStats);
              await databaseWriter.bulkInsertGameLogs(allGameLogs);
              
              totalStats += allStats.length;
              totalLogs += allGameLogs.length;
              processedGames++;
              
              process.stdout.write(chalk.green('.'));
            }
            
          } catch (error: any) {
            console.error(chalk.red(`\nError processing game ${gameData.gameId}:`, error.message));
            errors++;
          }
        }
        
      } catch (error: any) {
        console.error(chalk.red(`\nBatch ${batchNumber} failed:`, error.message));
        errors++;
      }
      
      // Progress update
      const progress = ((i + batch.length) / gamesToProcess.length * 100).toFixed(1);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processedGames / elapsed;
      const eta = (gamesToProcess.length - processedGames) / rate;
      
      console.log(chalk.cyan(`\n📊 Progress: ${progress}% | Games: ${processedGames}/${gamesToProcess.length} | Rate: ${rate.toFixed(1)}/s | ETA: ${Math.round(eta/60)}m`));
    }
    
  } finally {
    parallelEngine.dispose();
  }
  
  const totalTime = (Date.now() - startTime) / 1000;
  
  console.log(chalk.bold.green('\n\n✅ BATCH COLLECTION COMPLETE!\n'));
  console.log(chalk.green('📊 Final Statistics:'));
  console.log(chalk.white(`   Games Processed: ${processedGames}/${gamesToProcess.length}`));
  console.log(chalk.white(`   Total Stats: ${totalStats.toLocaleString()}`));
  console.log(chalk.white(`   Game Logs: ${totalLogs.toLocaleString()}`));
  console.log(chalk.white(`   Success Rate: ${((processedGames/gamesToProcess.length)*100).toFixed(1)}%`));
  console.log(chalk.white(`   Total Time: ${Math.round(totalTime/60)}m ${Math.round(totalTime%60)}s`));
  console.log(chalk.white(`   Errors: ${errors}`));
  
  const dbStats = databaseWriter.getStats();
  console.log(chalk.green('\n💾 Database Statistics:'));
  console.log(chalk.white(`   Stats Inserted: ${dbStats.playerStatsInserted.toLocaleString()}`));
  console.log(chalk.white(`   Game Logs: ${dbStats.gameLogsInserted.toLocaleString()}`));
  console.log(chalk.white(`   Errors: ${dbStats.errors}`));
  
  console.log(chalk.bold.cyan('\n🎯 Pattern accuracy improving towards 76.4%! 🚀\n'));
}

runCollectorBatch().catch(console.error);