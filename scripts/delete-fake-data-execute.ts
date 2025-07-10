#!/usr/bin/env tsx
/**
 * EXECUTE: Delete all fake data from database
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function executeDeletion() {
  console.log(chalk.bold.red('🚀 EXECUTING FAKE DATA DELETION\n'));
  
  const startTime = Date.now();
  let totalDeleted = 0;
  
  // Step 1: Delete ML predictions
  console.log(chalk.yellow('Step 1: Cleaning ML predictions table...'));
  try {
    const { error } = await supabase
      .from('ml_predictions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all non-zero UUIDs
      
    if (!error) {
      console.log(chalk.green('✓ ML predictions cleaned'));
    }
  } catch (e) {
    console.log(chalk.gray('  ML predictions table already clean'));
  }
  
  // Step 2: Delete fake players in batches
  console.log(chalk.yellow('\nStep 2: Deleting fake players...'));
  
  // Pattern 1: The 835K test players
  console.log(chalk.gray('  Deleting _175133_ pattern players...'));
  let deleted = 0;
  let attempts = 0;
  
  while (attempts < 1000) { // Safety limit
    // Get batch of IDs
    const { data: batch } = await supabase
      .from('players')
      .select('id')
      .like('name', '%_175133%_%')
      .limit(500);
      
    if (!batch || batch.length === 0) break;
    
    const ids = batch.map(p => p.id);
    
    // Delete related data first
    await supabase.from('player_stats').delete().in('player_id', ids);
    await supabase.from('player_injuries').delete().in('player_id', ids);
    await supabase.from('player_game_logs').delete().in('player_id', ids);
    
    // Delete players
    const { error } = await supabase
      .from('players')
      .delete()
      .in('id', ids);
      
    if (error) {
      console.error('Delete error:', error);
      break;
    }
    
    deleted += batch.length;
    totalDeleted += batch.length;
    
    if (deleted % 10000 === 0) {
      console.log(chalk.gray(`    Deleted ${deleted.toLocaleString()} test players...`));
    }
    
    attempts++;
  }
  
  console.log(chalk.green(`  ✓ Deleted ${deleted.toLocaleString()} test players`));
  
  // Pattern 2: Other test patterns
  const testPatterns = [
    'test_%',
    'fake_%',
    'temp_%'
  ];
  
  for (const pattern of testPatterns) {
    const { error, count } = await supabase
      .from('players')
      .delete()
      .like('external_id', pattern);
      
    if (!error && count) {
      totalDeleted += count;
      console.log(chalk.green(`  ✓ Deleted ${count} ${pattern} players`));
    }
  }
  
  // Step 3: Clean incomplete records
  console.log(chalk.yellow('\nStep 3: Cleaning incomplete records...'));
  
  // Delete players without names
  const { count: noNameDeleted } = await supabase
    .from('players')
    .delete()
    .or('firstname.is.null,lastname.is.null,name.is.null');
    
  if (noNameDeleted) {
    totalDeleted += noNameDeleted;
    console.log(chalk.green(`  ✓ Deleted ${noNameDeleted} players without names`));
  }
  
  // Step 4: Final verification
  console.log(chalk.yellow('\nStep 4: Verifying results...'));
  
  const { count: totalPlayers } = await supabase
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
    
  const { count: realMLB } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'mlb');
    
  const { count: realNHL } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nhl');
    
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(chalk.bold.green('\n✅ DELETION COMPLETE!\n'));
  console.log(chalk.cyan('📊 FINAL DATABASE STATUS:'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`Total players: ${totalPlayers?.toLocaleString()} (was 858,164)`);
  console.log(`Deleted: ${totalDeleted.toLocaleString()} fake players`);
  console.log(`Time: ${elapsed} seconds`);
  
  console.log(chalk.cyan('\n🏆 REAL DATA REMAINING:'));
  console.log(`NFL: ${realNFL?.toLocaleString()} players`);
  console.log(`NCAA: ${realNCAA?.toLocaleString()} players`);
  console.log(`MLB: ${realMLB?.toLocaleString()} players`);
  console.log(`NHL: ${realNHL?.toLocaleString()} players`);
  
  console.log(chalk.bold.green('\n🎉 Your database is now clean and ready for real pattern detection!'));
}

executeDeletion().catch(console.error);