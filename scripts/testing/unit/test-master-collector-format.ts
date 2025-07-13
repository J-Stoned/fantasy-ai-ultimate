#!/usr/bin/env tsx
/**
 * Test the format mismatch in master collector
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { parallelEngine } from './gpu-stats-collector/parallel-engine';
import { batchProcessor } from './gpu-stats-collector/batch-processor';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testFormats() {
  console.log(chalk.bold.cyan('\n🔍 TESTING FORMAT COMPATIBILITY\n'));
  
  // Get a game like master collector does
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
  console.log(chalk.yellow('Original game format:'));
  console.log(JSON.stringify(game, null, 2));
  
  // What does parallel engine return?
  console.log(chalk.cyan('\nAfter parallel engine processing:'));
  const gpuProcessed = await parallelEngine.processGamesParallel([game]);
  console.log(JSON.stringify(gpuProcessed[0], null, 2));
  
  // What does batch processor expect?
  console.log(chalk.cyan('\nTesting batch processor with original format:'));
  try {
    const result1 = await batchProcessor.fetchGameStats(game);
    console.log(chalk.green('✓ Original format works'));
    console.log('Result keys:', Object.keys(result1));
  } catch (error: any) {
    console.error(chalk.red('❌ Original format failed:'), error.message);
  }
  
  console.log(chalk.cyan('\nTesting batch processor with GPU processed format:'));
  try {
    const result2 = await batchProcessor.fetchGameStats(gpuProcessed[0]);
    console.log(chalk.green('✓ GPU processed format works'));
    console.log('Result keys:', Object.keys(result2));
  } catch (error: any) {
    console.error(chalk.red('❌ GPU processed format failed:'), error.message);
  }
}

testFormats().catch(console.error);