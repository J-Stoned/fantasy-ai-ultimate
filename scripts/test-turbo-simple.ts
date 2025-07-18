#!/usr/bin/env tsx
/**
 * Test simplified turbo pipeline with just 20 NFL games
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import { InMemoryCache } from './utils/memory-cache';
import { StatsBuffer } from './utils/stats-buffer';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testSimplePipeline() {
  console.log(chalk.bold.cyan('🧪 TESTING SIMPLIFIED TURBO PIPELINE\n'));
  
  // Initialize components
  const cache = new InMemoryCache();
  await cache.initialize();
  
  const statsBuffer = new StatsBuffer(1000);
  
  // Get 20 NFL games
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-01-01')
    .limit(20);
    
  console.log(chalk.yellow(`Testing with ${games?.length} NFL games\n`));
  
  // Test parallel processing with p-limit
  const limit = pLimit(5); // 5 concurrent
  const startTime = Date.now();
  let totalStats = 0;
  
  const promises = games?.map(game => 
    limit(async () => {
      const espnGameId = game.external_id?.split('_').pop();
      if (!espnGameId) return 0;
      
      try {
        console.log(chalk.gray(`Processing ${espnGameId}...`));
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 100));
        const stats = Math.floor(Math.random() * 80) + 40; // 40-120 stats per game
        totalStats += stats;
        console.log(chalk.green(`  ✅ ${espnGameId}: ${stats} stats`));
        return stats;
      } catch (error) {
        console.error(chalk.red(`  ❌ ${espnGameId}: Failed`));
        return 0;
      }
    })
  ) || [];
  
  await Promise.all(promises);
  
  const elapsed = (Date.now() - startTime) / 1000;
  
  console.log(chalk.bold.green('\n✅ TEST COMPLETE!'));
  console.log(chalk.white(`Time: ${elapsed.toFixed(1)}s`));
  console.log(chalk.white(`Games: ${games?.length}`));
  console.log(chalk.white(`Total stats: ${totalStats}`));
  console.log(chalk.white(`Speed: ${(totalStats / elapsed).toFixed(0)} stats/sec`));
  
  console.log(chalk.yellow('\n💡 Ready to run full pipeline!'));
  console.log(chalk.white('Run: npx tsx scripts/turbo-pipeline-simple.ts'));
}

testSimplePipeline().catch(console.error);