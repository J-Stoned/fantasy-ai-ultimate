#!/usr/bin/env tsx
/**
 * 🏈 NFL 2023 SEASON STATS COLLECTOR
 * Collects all 2023 NFL season games to expand our pattern detection dataset
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

async function nfl2023StatsCollector() {
  console.log(chalk.bold.magenta('\n🏈 NFL 2023 SEASON STATS COLLECTOR v1.0\n'));
  console.log(chalk.cyan('Expanding our dataset with 2023 season games for enhanced pattern discovery!\n'));
  
  const startTime = Date.now();
  
  // Get NFL games without stats from 2023 season
  const { data: gamesWithStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(10000);
    
  const processedGameIds = new Set(gamesWithStats?.map(s => s.game_id) || []);
  
  // First, let's check how many 2023 games we have
  const { count: totalCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .gte('start_time', '2023-09-01T00:00:00+00:00') // 2023 NFL season start
    .lt('start_time', '2024-02-15T00:00:00+00:00');  // 2023 season end (after Super Bowl)
    
  console.log(chalk.yellow(`📊 Total 2023 NFL games in database: ${totalCount || 0}`));
  
  const { data: allGames } = await supabase
    .from('games')
    .select('id, external_id, sport_id, home_team_id, away_team_id, start_time, home_score, away_score')
    .eq('sport_id', 'nfl')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .gte('start_time', '2023-09-01T00:00:00+00:00') // 2023 NFL season
    .lt('start_time', '2024-02-15T00:00:00+00:00')  // End of 2023 season
    .order('start_time', { ascending: false })
    .limit(500); // Get up to 500 games
    
  const gamesToProcess = (allGames || []).filter(game => 
    !processedGameIds.has(game.id) && 
    game.external_id && 
    game.external_id.includes('nfl_')
  );
  
  console.log(chalk.yellow(`📊 Found ${gamesToProcess.length} unprocessed 2023 NFL games\n`));
  
  if (gamesToProcess.length === 0) {
    console.log(chalk.green('✅ No 2023 NFL games need processing!'));
    return;
  }
  
  // Show sample of games we'll process
  console.log(chalk.cyan('Sample games to process:'));
  gamesToProcess.slice(0, 3).forEach(game => {
    console.log(chalk.gray(`  - ${new Date(game.start_time).toLocaleDateString()}: Game ${game.external_id}`));
  });
  console.log();
  
  await parallelEngine.initialize();
  
  let totalStats = 0;
  let totalLogs = 0;
  let processedGames = 0;
  let errors = 0;
  
  try {
    // Process in batches of 10 games
    const BATCH_SIZE = 10;
    const totalBatches = Math.ceil(gamesToProcess.length / BATCH_SIZE);
    
    for (let i = 0; i < gamesToProcess.length; i += BATCH_SIZE) {
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const batch = gamesToProcess.slice(i, i + BATCH_SIZE);
      
      console.log(chalk.bold.yellow(`\n━━━ Batch ${batchNumber}/${totalBatches} (${batch.length} games) ━━━`));
      
      try {
        // GPU process
        const gpuProcessed = await parallelEngine.processGamesParallel(batch);
        
        // Fetch from ESPN
        const apiResults = await batchProcessor.processBatch(gpuProcessed);
        console.log(chalk.green(`✓ Fetched ${apiResults.length}/${batch.length} game results`));
        
        if (apiResults.length === 0) {
          console.log(chalk.yellow('⚠️  No data for this batch, skipping...'));
          continue;
        }
        
        // Parse and save each game
        for (const gameData of apiResults) {
          try {
            // Only process NFL games
            if (gameData.sport !== 'nfl') {
              console.log(chalk.yellow(`Skipping non-NFL game: ${gameData.sport}`));
              continue;
            }
            
            // Parse NFL stats
            const parsedPlayers = SportParsers.parseNFLGame(gameData.data);
            
            if (parsedPlayers.length === 0) {
              console.log(chalk.yellow(`Game ${gameData.gameId}: No players found`));
              continue;
            }
            
            console.log(chalk.cyan(`Game ${gameData.gameId}: Processing ${parsedPlayers.length} players`));
            
            const allStats: any[] = [];
            const allGameLogs: any[] = [];
            let playerCount = 0;
            
            // Process all players
            for (const playerData of parsedPlayers) {
              try {
                const playerId = await playerMatcher.ensurePlayer({
                  name: playerData.playerName,
                  sport: 'nfl',
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
                
                playerCount++;
                
              } catch (error: any) {
                console.error(chalk.red(`  ❌ Error with ${playerData.playerName}:`, error.message));
                errors++;
              }
            }
            
            // Insert to database
            if (allStats.length > 0) {
              console.log(chalk.cyan(`  💾 Saving ${allStats.length} stats for ${playerCount} players...`));
              
              await databaseWriter.bulkInsertPlayerStats(allStats);
              await databaseWriter.bulkInsertGameLogs(allGameLogs);
              
              totalStats += allStats.length;
              totalLogs += allGameLogs.length;
              processedGames++;
              
              console.log(chalk.green(`  ✅ Game ${gameData.gameId} complete: ${allStats.length} stats`));
            } else {
              console.log(chalk.yellow(`  ⚠️  Game ${gameData.gameId}: No stats to save`));
            }
            
          } catch (error: any) {
            console.error(chalk.red(`❌ Error processing game ${gameData.gameId}:`, error.message));
            errors++;
          }
        }
        
      } catch (error: any) {
        console.error(chalk.red(`❌ Batch ${batchNumber} failed:`, error.message));
        errors++;
      }
      
      // Progress update
      const progress = ((i + batch.length) / gamesToProcess.length * 100).toFixed(1);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processedGames / elapsed;
      const eta = processedGames > 0 ? (gamesToProcess.length - processedGames) / rate : 0;
      
      console.log(chalk.cyan(`\n📊 Progress: ${progress}% | Games: ${processedGames}/${gamesToProcess.length} | Rate: ${rate.toFixed(1)}/s | ETA: ${Math.round(eta/60)}m`));
    }
    
  } finally {
    parallelEngine.dispose();
  }
  
  const totalTime = (Date.now() - startTime) / 1000;
  
  console.log(chalk.bold.green('\n\n🏈 2023 NFL COLLECTION COMPLETE!\n'));
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
  console.log(chalk.white(`   Database Errors: ${dbStats.errors}`));
  
  console.log(chalk.bold.cyan('\n🎯 More data = More patterns = HIGHER ACCURACY! 🚀'));
  console.log(chalk.bold.yellow('\n💰 With 2023+2024 data, we can discover year-over-year patterns! 💰\n'));
}

nfl2023StatsCollector().catch(console.error);