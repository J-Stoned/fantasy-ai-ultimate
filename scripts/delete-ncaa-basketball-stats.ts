#!/usr/bin/env tsx
/**
 * 🗑️ DELETE NCAA BASKETBALL STATS
 * Remove all existing NCAA Basketball stats for a fresh start
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteNCAABasketballStats() {
  console.log(chalk.bold.red('🗑️ DELETE NCAA BASKETBALL STATS\n'));
  
  // Get all NCAA Basketball game IDs
  const allGameIds = [];
  let from = 0;
  const batchSize = 1000;
  
  console.log('Loading NCAA Basketball games...');
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('id')
      .eq('sport', 'NCAA_BB')
      .range(from, from + batchSize - 1);
    
    if (!data || data.length === 0) break;
    
    allGameIds.push(...data.map(g => g.id));
    from += batchSize;
    
    if (data.length < batchSize) break;
  }
  
  console.log(`Found ${allGameIds.length} NCAA Basketball games`);
  
  // Delete stats in chunks
  console.log('\nDeleting stats...');
  let totalDeleted = 0;
  const deleteChunkSize = 500;
  
  for (let i = 0; i < allGameIds.length; i += deleteChunkSize) {
    const chunk = allGameIds.slice(i, i + deleteChunkSize);
    
    const { error, count } = await supabase
      .from('player_game_logs')
      .delete()
      .in('game_id', chunk);
    
    if (error) {
      console.error(`Error deleting chunk: ${error.message}`);
    } else {
      totalDeleted += count || 0;
      console.log(`Deleted chunk ${Math.floor(i / deleteChunkSize) + 1}/${Math.ceil(allGameIds.length / deleteChunkSize)} (${totalDeleted} total)`);
    }
  }
  
  console.log(chalk.green(`\n✅ Deleted ${totalDeleted} NCAA Basketball stats`));
  
  // Verify
  const { count: remainingCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', allGameIds.slice(0, 100));
  
  console.log(`Verification: ${remainingCount || 0} stats remaining for first 100 games`);
}

deleteNCAABasketballStats().catch(console.error);