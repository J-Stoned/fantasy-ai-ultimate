#!/usr/bin/env tsx
/**
 * Delete 835K test data players
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function deleteTestData() {
  console.log(chalk.bold.red('🗑️  DELETING 835K TEST DATA PLAYERS\n'));
  
  let totalDeleted = 0;
  const batchSize = 1000;
  let iteration = 0;
  
  while (true) {
    // Get a batch of test players
    const { data: batch, error: selectError } = await supabase
      .from('players')
      .select('id')
      .like('name', '%_175133%_%')
      .limit(batchSize);
      
    if (selectError) {
      console.error('Select error:', selectError);
      break;
    }
    
    if (!batch || batch.length === 0) {
      console.log(chalk.green('\n✅ No more test data found!'));
      break;
    }
    
    // Delete the batch
    const ids = batch.map(p => p.id);
    const { error: deleteError } = await supabase
      .from('players')
      .delete()
      .in('id', ids);
      
    if (deleteError) {
      console.error('Delete error:', deleteError);
      break;
    }
    
    totalDeleted += batch.length;
    iteration++;
    
    // Progress update every 10 batches
    if (iteration % 10 === 0) {
      console.log(chalk.yellow(`Progress: Deleted ${totalDeleted.toLocaleString()} test players...`));
    }
    
    // Safety limit
    if (iteration > 1000) {
      console.log(chalk.red('Safety limit reached'));
      break;
    }
  }
  
  console.log(chalk.bold.green(`\n✅ TOTAL DELETED: ${totalDeleted.toLocaleString()} test players`));
  
  // Final count
  const { count: totalRemaining } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
    
  const { count: testRemaining } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .like('name', '%_175133%_%');
    
  console.log(chalk.cyan('\n📊 FINAL DATABASE STATUS:'));
  console.log(`Total players remaining: ${totalRemaining?.toLocaleString()}`);
  console.log(`Test players remaining: ${testRemaining?.toLocaleString()}`);
  
  // Count real players
  const { count: nflCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .ilike('external_id', 'sleeper_%');
    
  const { count: ncaaCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .ilike('external_id', 'espn_ncaa_%');
    
  console.log(chalk.green('\n✨ REAL DATA:'));
  console.log(`NFL players (Sleeper): ${nflCount?.toLocaleString()}`);
  console.log(`NCAA players: ${ncaaCount?.toLocaleString()}`);
}

deleteTestData().catch(console.error);