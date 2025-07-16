#!/usr/bin/env tsx
/**
 * 🏈 CHECK NCAA FOOTBALL STATS
 * Verify NCAA Football stats are still present
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNCAAFootballStats() {
  console.log(chalk.bold.blue('🏈 CHECK NCAA FOOTBALL STATS\n'));
  
  // Get ALL NCAA Football game IDs
  console.log('Loading all NCAA Football games...');
  const allGameIds = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('id')
      .eq('sport', 'NCAA_FB')
      .range(from, from + batchSize - 1);
    
    if (!data || data.length === 0) break;
    
    allGameIds.push(...data.map(g => g.id));
    from += batchSize;
    
    if (data.length < batchSize) break;
  }
  
  console.log(`Found ${allGameIds.length} NCAA Football games\\n`);
  
  // Count stats in batches
  console.log("Counting stats in batches...");
  let totalStats = 0;
  const countBatchSize = 100;
  
  for (let i = 0; i < allGameIds.length; i += countBatchSize) {
    const batch = allGameIds.slice(i, i + countBatchSize);
    
    const { count } = await supabase
      .from("player_game_logs")
      .select("*", { count: "exact", head: true })
      .in("game_id", batch);
    
    totalStats += count || 0;
    
    if (i % 1000 === 0) {
      console.log(`Progress: ${i}/${allGameIds.length} games checked, ${totalStats} stats found so far`);
    }
  }
  
  console.log(chalk.green(`\\n✅ ACTUAL NCAA Football stats count: ${totalStats.toLocaleString()}`));
  
  // Check when these were created
  const { data: sampleStats } = await supabase
    .from("player_game_logs")
    .select("created_at")
    .in("game_id", allGameIds.slice(0, 10))
    .order("created_at", { ascending: false })
    .limit(10);
  
  console.log("\\nSample creation times:");
  sampleStats?.forEach(stat => {
    console.log(`- ${stat.created_at}`);
  });
  
  // Check total database count
  const { count: totalCount } = await supabase
    .from("player_game_logs")
    .select("*", { count: "exact", head: true });
  
  console.log(chalk.yellow(`\\nTOTAL stats in database: ${totalCount?.toLocaleString()}`));
}

checkNCAAFootballStats().catch(console.error);
