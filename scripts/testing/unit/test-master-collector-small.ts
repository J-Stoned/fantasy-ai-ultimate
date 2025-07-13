#!/usr/bin/env tsx
/**
 * Test master collector on 5 games only
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

async function testSmallBatch() {
  console.log(chalk.bold.cyan('\n🧪 TESTING MASTER COLLECTOR (5 GAMES)\n'));
  
  // Get 5 games without stats
  const { data: gamesWithStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(1000);
    
  const processedGameIds = new Set(gamesWithStats?.map(s => s.game_id) || []);
  
  const { data: allGames } = await supabase
    .from('games')
    .select('id, external_id, sport_id, home_team_id, away_team_id, start_time, home_score, away_score')
    .eq('sport_id', 'nfl')
    .not('home_score', 'is', null)
    .lt('start_time', new Date().toISOString()) // Only past games
    .order('start_time', { ascending: false })
    .limit(50);
    
  const gamesToProcess = (allGames || []).filter(game => 
    !processedGameIds.has(game.id) && game.external_id
  ).slice(0, 5);
  
  console.log(chalk.yellow(`Found ${gamesToProcess.length} games to process`));
  
  if (gamesToProcess.length === 0) {
    console.log(chalk.green('No games need processing!'));
    return;
  }
  
  // Initialize
  await parallelEngine.initialize();
  
  let totalStats = 0;
  let totalLogs = 0;
  
  try {
    // Step 1: GPU process games
    console.log(chalk.cyan('\n🎮 GPU Processing...'));
    const gpuProcessed = await parallelEngine.processGamesParallel(gamesToProcess);
    console.log(chalk.green(`✓ GPU processed ${gpuProcessed.length} games`));
    
    // Step 2: Fetch from ESPN
    console.log(chalk.cyan('\n🌐 Fetching from ESPN...'));
    const apiResults = await batchProcessor.processBatch(gpuProcessed);
    console.log(chalk.green(`✓ Fetched ${apiResults.length} game results`));
    
    // Step 3: Parse and save each game
    for (const gameData of apiResults) {
      console.log(chalk.yellow(`\nProcessing game ${gameData.gameId}...`));
      
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
      
      console.log(chalk.green(`  ✓ Parsed ${parsedPlayers.length} players`));
      
      if (parsedPlayers.length === 0) continue;
      
      // Process stats
      const allStats: any[] = [];
      const allGameLogs: any[] = [];
      
      for (const playerData of parsedPlayers.slice(0, 10)) { // First 10 players only
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
          console.error(chalk.red(`  ❌ Error with ${playerData.playerName}:`, error.message));
        }
      }
      
      // Insert to database
      if (allStats.length > 0) {
        console.log(chalk.cyan(`  💾 Inserting ${allStats.length} stats...`));
        await databaseWriter.bulkInsertPlayerStats(allStats);
        await databaseWriter.bulkInsertGameLogs(allGameLogs);
        
        totalStats += allStats.length;
        totalLogs += allGameLogs.length;
        
        console.log(chalk.green(`  ✓ Saved ${allStats.length} stats, ${allGameLogs.length} logs`));
      }
    }
    
  } finally {
    parallelEngine.dispose();
  }
  
  console.log(chalk.bold.green('\n✅ TEST COMPLETE!'));
  console.log(chalk.green(`📊 Total: ${totalStats} stats, ${totalLogs} game logs`));
  
  // Show database writer stats
  const dbStats = databaseWriter.getStats();
  console.log(chalk.cyan('\n💾 Database Stats:'));
  console.log(chalk.white(`   Stats inserted: ${dbStats.playerStatsInserted}`));
  console.log(chalk.white(`   Game logs: ${dbStats.gameLogsInserted}`));
  console.log(chalk.white(`   Errors: ${dbStats.errors}`));
}

testSmallBatch().catch(console.error);