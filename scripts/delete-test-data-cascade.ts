#!/usr/bin/env tsx
/**
 * Delete 835K test data players and their related records
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
  console.log(chalk.bold.red('🗑️  DELETING 835K TEST DATA PLAYERS AND RELATED RECORDS\n'));
  
  // First, get all test player IDs
  console.log(chalk.yellow('Step 1: Finding test player IDs...'));
  
  const testPlayerIds: number[] = [];
  let offset = 0;
  const chunkSize = 10000;
  
  while (true) {
    const { data: chunk, error } = await supabase
      .from('players')
      .select('id')
      .like('name', '%_175133%_%')
      .range(offset, offset + chunkSize - 1);
      
    if (error) {
      console.error('Error fetching IDs:', error);
      break;
    }
    
    if (!chunk || chunk.length === 0) break;
    
    testPlayerIds.push(...chunk.map(p => p.id));
    console.log(`  Found ${testPlayerIds.length} test player IDs...`);
    
    if (chunk.length < chunkSize) break;
    offset += chunkSize;
  }
  
  console.log(chalk.green(`✓ Found ${testPlayerIds.length.toLocaleString()} test player IDs`));
  
  // Delete in batches
  const batchSize = 1000;
  const batches = [];
  for (let i = 0; i < testPlayerIds.length; i += batchSize) {
    batches.push(testPlayerIds.slice(i, i + batchSize));
  }
  
  console.log(chalk.yellow(`\nStep 2: Deleting related records in ${batches.length} batches...`));
  
  // Delete related records first
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    // Delete player_stats
    const { error: statsError } = await supabase
      .from('player_stats')
      .delete()
      .in('player_id', batch);
      
    if (statsError && statsError.code !== 'PGRST116') {
      console.error('Error deleting stats:', statsError);
    }
    
    // Delete player_game_logs
    const { error: logsError } = await supabase
      .from('player_game_logs')
      .delete()
      .in('player_id', batch);
      
    if (logsError && logsError.code !== 'PGRST116') {
      console.error('Error deleting game logs:', logsError);
    }
    
    // Progress update
    if ((i + 1) % 10 === 0) {
      console.log(chalk.gray(`  Cleaned batch ${i + 1}/${batches.length}`));
    }
  }
  
  console.log(chalk.green('✓ Related records deleted'));
  
  // Now delete the players
  console.log(chalk.yellow('\nStep 3: Deleting player records...'));
  
  let totalDeleted = 0;
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    const { error } = await supabase
      .from('players')
      .delete()
      .in('id', batch);
      
    if (error) {
      console.error('Error deleting players:', error);
      break;
    }
    
    totalDeleted += batch.length;
    
    // Progress update
    if ((i + 1) % 10 === 0) {
      console.log(chalk.gray(`  Deleted ${totalDeleted.toLocaleString()} players...`));
    }
  }
  
  console.log(chalk.bold.green(`\n✅ SUCCESSFULLY DELETED ${totalDeleted.toLocaleString()} TEST PLAYERS!`));
  
  // Final verification
  const { count: remaining } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
    
  const { count: realNFL } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .ilike('external_id', 'sleeper_%');
    
  const { count: realNCAA } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .ilike('external_id', 'espn_ncaa_%');
    
  console.log(chalk.cyan('\n📊 CLEAN DATABASE STATUS:'));
  console.log(`Total players: ${remaining?.toLocaleString()}`);
  console.log(`NFL players: ${realNFL?.toLocaleString()}`);
  console.log(`NCAA players: ${realNCAA?.toLocaleString()}`);
}

deleteTestData().catch(console.error);