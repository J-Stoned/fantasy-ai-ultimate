#!/usr/bin/env tsx
/**
 * Test the exact master collector flow step by step
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { parallelEngine } from './gpu-stats-collector/parallel-engine';
import { batchProcessor } from './gpu-stats-collector/batch-processor';
import { SportParsers } from './gpu-stats-collector/parsers/sport-parsers';
import { playerMatcher } from './gpu-stats-collector/player-matcher';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testMasterFlow() {
  console.log(chalk.bold.cyan('\n🔍 TESTING MASTER COLLECTOR FLOW\n'));
  
  // Step 1: Get game (like master collector)
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, sport_id, home_team_id, away_team_id, start_time, home_score, away_score')
    .eq('sport_id', 'nfl')
    .not('home_score', 'is', null)
    .limit(1);
    
  if (!games || games.length === 0) {
    console.error('No games found');
    return;
  }
  
  const game = games[0];
  console.log(chalk.yellow('Step 1: Got game'), game.id);
  
  // Step 2: GPU Processing (like line 162 in master collector)
  console.log(chalk.cyan('\nStep 2: GPU Processing...'));
  await parallelEngine.initialize();
  const gpuProcessed = await parallelEngine.processGamesParallel([game]);
  console.log(chalk.green('✓ GPU processed'), gpuProcessed.length, 'games');
  
  // Step 3: Batch processing (like line 166 in master collector)
  console.log(chalk.cyan('\nStep 3: Batch processing...'));
  const apiResults = await batchProcessor.processBatch(gpuProcessed);
  console.log(chalk.green('✓ API results received'), apiResults.length, 'results');
  
  if (apiResults.length === 0) {
    console.error(chalk.red('❌ No API results - this is the problem!'));
    return;
  }
  
  const gameData = apiResults[0];
  console.log('Game data keys:', Object.keys(gameData));
  console.log('Has data.boxscore?', !!gameData.data?.boxscore);
  console.log('Players array length:', gameData.data?.boxscore?.players?.length || 0);
  
  // Step 4: Parse stats (like line 174-198 in master collector)
  console.log(chalk.cyan('\nStep 4: Parsing stats...'));
  let parsedPlayers: any[] = [];
  
  switch (gameData.sport) {
    case 'nfl':
      parsedPlayers = SportParsers.parseNFLGame(gameData.data);
      break;
  }
  
  console.log(chalk.green('✓ Parsed'), parsedPlayers.length, 'players');
  
  if (parsedPlayers.length === 0) {
    console.error(chalk.red('❌ No players parsed - this could be the problem!'));
    console.log('Boxscore structure:', JSON.stringify(gameData.data?.boxscore?.players?.[0]?.statistics?.[0], null, 2));
    return;
  }
  
  // Step 5: Player matching (like line 200-206 in master collector)
  console.log(chalk.cyan('\nStep 5: Player matching...'));
  const allStats: any[] = [];
  let playerCount = 0;
  
  for (const playerData of parsedPlayers.slice(0, 3)) {
    try {
      const playerId = await playerMatcher.ensurePlayer({
        name: playerData.playerName,
        sport: gameData.sport,
        espnId: playerData.playerId
      });
      
      console.log(chalk.green(`✓ Mapped ${playerData.playerName} to ID ${playerId}`));
      playerCount++;
      
      // Create stats (like line 209-218 in master collector)
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
      
    } catch (error: any) {
      console.error(chalk.red(`❌ Error mapping ${playerData.playerName}:`, error.message));
    }
  }
  
  console.log(chalk.green('✓ Created'), allStats.length, 'stat records');
  
  // Step 6: Database insert (like line 262 in master collector)
  console.log(chalk.cyan('\nStep 6: Database insert...'));
  
  if (allStats.length > 0) {
    const { error } = await supabase
      .from('player_stats')
      .insert(allStats);
      
    if (error) {
      console.error(chalk.red('❌ Insert error:'), error);
    } else {
      console.log(chalk.green('✓ Successfully inserted'), allStats.length, 'stats');
    }
  }
  
  parallelEngine.dispose();
  console.log(chalk.bold.green('\n✅ Flow test complete!'));
}

testMasterFlow().catch(console.error);