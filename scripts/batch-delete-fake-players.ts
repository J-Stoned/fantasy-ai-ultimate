#!/usr/bin/env tsx
/**
 * Batch delete all 835K fake players
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function batchDelete() {
  console.log(chalk.bold.red('🗑️  BATCH DELETING 835K FAKE PLAYERS\n'));
  
  const startTime = Date.now();
  let totalDeleted = 0;
  let iterations = 0;
  const batchSize = 500;
  
  while (true) {
    // Get batch of test players
    const { data: batch, error: fetchError } = await supabase
      .from('players')
      .select('id')
      .like('name', '%_175133%_%')
      .limit(batchSize);
      
    if (fetchError || !batch || batch.length === 0) {
      if (fetchError) console.error('Fetch error:', fetchError);
      break;
    }
    
    const ids = batch.map(p => p.id);
    
    // Delete related data first (in case they have any)
    await supabase.from('player_stats').delete().in('player_id', ids);
    await supabase.from('player_injuries').delete().in('player_id', ids);
    await supabase.from('player_game_logs').delete().in('player_id', ids);
    
    // Delete the players
    const { error: deleteError, count } = await supabase
      .from('players')
      .delete()
      .in('id', ids);
      
    if (deleteError) {
      console.error('Delete error:', deleteError);
      break;
    }
    
    totalDeleted += batch.length;
    iterations++;
    
    // Progress update
    if (iterations % 10 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (totalDeleted / (parseInt(elapsed) || 1)).toFixed(0);
      console.log(chalk.yellow(
        `Progress: ${totalDeleted.toLocaleString()} deleted | ` +
        `${rate}/sec | ${elapsed}s elapsed`
      ));
    }
    
    // Safety limit
    if (iterations > 2000) {
      console.log(chalk.red('Safety limit reached'));
      break;
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(chalk.bold.green(`\n✅ BATCH DELETE COMPLETE!\n`));
  console.log(`Total deleted: ${totalDeleted.toLocaleString()} fake players`);
  console.log(`Time: ${elapsed} seconds`);
  console.log(`Rate: ${(totalDeleted / parseInt(elapsed)).toFixed(0)} players/second`);
  
  // Final count
  const { count: remaining } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
    
  const { count: testRemaining } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .like('name', '%_175133%_%');
    
  console.log(chalk.cyan('\n📊 FINAL STATUS:'));
  console.log(`Total players: ${remaining?.toLocaleString()}`);
  console.log(`Test players remaining: ${testRemaining?.toLocaleString()}`);
  
  if (testRemaining === 0) {
    console.log(chalk.bold.green('\n🎉 ALL FAKE DATA REMOVED!'));
    
    // Show real data
    const { count: nfl } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .ilike('external_id', 'sleeper_%');
      
    const { count: ncaa } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .ilike('external_id', 'espn_ncaa_%');
      
    console.log(chalk.cyan('\n✨ YOUR CLEAN DATABASE:'));
    console.log(`NFL: ${nfl?.toLocaleString()} real players`);
    console.log(`NCAA: ${ncaa?.toLocaleString()} real players`);
    console.log(`Plus MLB, NHL, NBA data`);
  }
}

batchDelete().catch(console.error);