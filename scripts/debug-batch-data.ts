#!/usr/bin/env tsx
/**
 * Debug what data the batch processor is actually returning
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { parallelEngine } from './gpu-stats-collector/parallel-engine';
import { batchProcessor } from './gpu-stats-collector/batch-processor';
import { SportParsers } from './gpu-stats-collector/parsers/sport-parsers';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugBatchData() {
  console.log(chalk.bold.cyan('\n🔍 DEBUGGING BATCH PROCESSOR DATA\n'));
  
  // Get 1 game
  const { data: games } = await supabase
    .from('games')
    .select('id, external_id, sport_id, home_team_id, away_team_id, start_time, home_score, away_score')
    .eq('external_id', 'nfl_401671628')
    .single();
    
  if (!games) {
    console.error('Game not found');
    return;
  }
  
  console.log(chalk.yellow('Original game:'));
  console.log(JSON.stringify(games, null, 2));
  
  await parallelEngine.initialize();
  
  try {
    // GPU process
    const gpuProcessed = await parallelEngine.processGamesParallel([games]);
    console.log(chalk.cyan('\nGPU processed:'));
    console.log(JSON.stringify(gpuProcessed[0], null, 2));
    
    // Batch process
    const apiResults = await batchProcessor.processBatch(gpuProcessed);
    console.log(chalk.cyan('\nAPI Results:'));
    console.log(`Results length: ${apiResults.length}`);
    
    if (apiResults.length > 0) {
      const result = apiResults[0];
      console.log('Keys:', Object.keys(result));
      console.log('Game ID:', result.gameId);
      console.log('ESPN ID:', result.espnId); 
      console.log('Sport:', result.sport);
      console.log('Has data?', !!result.data);
      console.log('Has boxscore?', !!result.data?.boxscore);
      console.log('Players length:', result.data?.boxscore?.players?.length || 0);
      
      if (result.data?.boxscore?.players?.length > 0) {
        console.log('Team 1 stats categories:', result.data.boxscore.players[0].statistics?.length || 0);
        if (result.data.boxscore.players[0].statistics?.length > 0) {
          console.log('First category:', result.data.boxscore.players[0].statistics[0].name);
          console.log('Athletes in first category:', result.data.boxscore.players[0].statistics[0].athletes?.length || 0);
        }
      }
      
      // Test direct parsing
      console.log(chalk.cyan('\nTesting parser directly:'));
      const parsed = SportParsers.parseNFLGame(result.data);
      console.log(`Parser returned ${parsed.length} players`);
      
      if (parsed.length > 0) {
        console.log('First player:', JSON.stringify(parsed[0], null, 2));
      }
    }
    
  } finally {
    parallelEngine.dispose();
  }
}

debugBatchData().catch(console.error);