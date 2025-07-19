#!/usr/bin/env tsx
/**
 * turbo-clean-empty-stats.ts - Placeholder
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import os from 'os';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CPU_CORES = os.cpus().length;
const dbLimit = pLimit(CPU_CORES);

async function cleanEmptyStats() {
  console.log(chalk.bold.cyan('🚀 EMPTY STATS CLEANUP\n'));
  
  try {
    // Count empty stats
    const { count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .or('stats.is.null,stats.eq.{}');
    
    console.log(chalk.yellow(`Found ${count || 0} empty stats to clean\n`));
    
    if (!count || count === 0) {
      console.log(chalk.green('✅ No empty stats found!'));
      return;
    }
    
    // Delete in batches
    let deleted = 0;
    const batchSize = 10000;
    
    while (deleted < count) {
      const { data: emptyStats } = await supabase
        .from('player_game_logs')
        .select('id')
        .or('stats.is.null,stats.eq.{}')
        .limit(batchSize);
      
      if (!emptyStats || emptyStats.length === 0) break;
      
      const ids = emptyStats.map(s => s.id);
      await supabase
        .from('player_game_logs')
        .delete()
        .in('id', ids);
      
      deleted += ids.length;
      console.log(chalk.green(`Deleted ${deleted}/${count} empty stats...`));
    }
    
    console.log(chalk.bold.green(`\n✅ Cleaned ${deleted} empty stats!`));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

cleanEmptyStats().catch(console.error);
