#!/usr/bin/env tsx
/**
 * FORCE DELETE: Remove all fake data by clearing related tables first
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function forceDelete() {
  console.log(chalk.bold.red('💪 FORCE DELETING ALL FAKE DATA\n'));
  
  // Step 1: Get ALL test player IDs upfront
  console.log(chalk.yellow('Step 1: Collecting all test player IDs...'));
  
  const testPlayerIds: number[] = [];
  let offset = 0;
  
  while (true) {
    const { data: batch } = await supabase
      .from('players')
      .select('id')
      .like('name', '%_175133%_%')
      .range(offset, offset + 9999);
      
    if (!batch || batch.length === 0) break;
    
    testPlayerIds.push(...batch.map(p => p.id));
    console.log(chalk.gray(`  Collected ${testPlayerIds.length.toLocaleString()} IDs...`));
    
    if (batch.length < 10000) break;
    offset += 10000;
  }
  
  console.log(chalk.green(`✓ Found ${testPlayerIds.length.toLocaleString()} test player IDs`));
  
  if (testPlayerIds.length === 0) {
    console.log(chalk.yellow('No test players found!'));
    return;
  }
  
  // Step 2: Delete from all related tables in batches
  const tables = [
    { name: 'player_stats', estimate: '10M+' },
    { name: 'player_injuries', estimate: '100K+' },
    { name: 'player_game_logs', estimate: '1M+' },
    { name: 'ml_predictions', estimate: '10K+' }
  ];
  
  for (const table of tables) {
    console.log(chalk.yellow(`\nStep 2.${tables.indexOf(table) + 1}: Deleting from ${table.name} (est: ${table.estimate} records)...`));
    
    let deleted = 0;
    const batchSize = 100; // Small batches to avoid timeouts
    
    // Process in chunks
    for (let i = 0; i < testPlayerIds.length; i += batchSize) {
      const chunk = testPlayerIds.slice(i, i + batchSize);
      
      try {
        const { error, count } = await supabase
          .from(table.name)
          .delete()
          .in('player_id', chunk);
          
        if (!error && count) {
          deleted += count;
        }
        
        // Progress update
        if ((i / batchSize) % 100 === 0 && i > 0) {
          console.log(chalk.gray(`    Progress: ${((i / testPlayerIds.length) * 100).toFixed(1)}% - Deleted ${deleted.toLocaleString()} records`));
        }
      } catch (e) {
        // Continue on error
      }
    }
    
    console.log(chalk.green(`  ✓ Deleted ${deleted.toLocaleString()} records from ${table.name}`));
  }
  
  // Step 3: Now delete the players themselves
  console.log(chalk.yellow('\nStep 3: Deleting test players...'));
  
  let playersDeleted = 0;
  const playerBatchSize = 500;
  
  for (let i = 0; i < testPlayerIds.length; i += playerBatchSize) {
    const chunk = testPlayerIds.slice(i, i + playerBatchSize);
    
    const { error, count } = await supabase
      .from('players')
      .delete()
      .in('id', chunk);
      
    if (!error && count) {
      playersDeleted += count;
    }
    
    if ((i / playerBatchSize) % 20 === 0 && i > 0) {
      console.log(chalk.gray(`    Deleted ${playersDeleted.toLocaleString()} players...`));
    }
  }
  
  console.log(chalk.green(`✓ Deleted ${playersDeleted.toLocaleString()} test players`));
  
  // Step 4: Final cleanup and verification
  console.log(chalk.yellow('\nStep 4: Final verification...'));
  
  const { count: remaining } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
    
  const { count: testRemaining } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .like('name', '%_175133%_%');
    
  console.log(chalk.bold.green('\n🎉 FORCE DELETE COMPLETE!\n'));
  console.log(chalk.cyan('📊 RESULTS:'));
  console.log(`Total players remaining: ${remaining?.toLocaleString()}`);
  console.log(`Test players remaining: ${testRemaining?.toLocaleString()}`);
  console.log(`Successfully deleted: ${testPlayerIds.length - (testRemaining || 0)} test players`);
  
  if (testRemaining === 0) {
    console.log(chalk.bold.green('\n✨ ALL FAKE DATA HAS BEEN REMOVED! ✨'));
    console.log('Your database is now clean!');
  }
}

forceDelete().catch(console.error);