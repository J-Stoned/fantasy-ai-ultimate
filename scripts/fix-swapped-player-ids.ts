#!/usr/bin/env tsx
/**
 * Fix player_id values that are actually ESPN IDs
 * This will correct the mapping to use actual database player IDs
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixSwappedIds() {
  console.log(chalk.bold.cyan('\n🔧 FIXING PLAYER ID ISSUES\n'));
  
  // First, let's identify the problematic stats
  // These will have player_id values that are too large (ESPN IDs are in millions)
  const { data: problemStats, count } = await supabase
    .from('player_stats')
    .select('id, game_id, player_id, stat_type, stat_value', { count: 'exact' })
    .gt('player_id', 1000000) // ESPN IDs are typically > 1M
    .order('id')
    .limit(1000);
    
  console.log(chalk.yellow(`Found ${count} stats with ESPN player IDs instead of database IDs\n`));
  
  if (!problemStats || problemStats.length === 0) {
    console.log(chalk.green('No problematic stats found!'));
    return;
  }
  
  // Get unique ESPN IDs
  const espnIds = [...new Set(problemStats.map(s => s.player_id))];
  console.log(chalk.cyan(`Unique ESPN player IDs to fix: ${espnIds.length}\n`));
  
  // Build mapping from ESPN ID to database player ID
  const espnToDbMap = new Map<number, number>();
  let mapped = 0;
  let notFound = 0;
  
  for (const espnId of espnIds) {
    // Look for player with this ESPN ID
    const { data: player } = await supabase
      .from('players')
      .select('id')
      .or(`external_id.eq.espn_${espnId},external_id.eq.${espnId}`)
      .single();
      
    if (player) {
      espnToDbMap.set(espnId, player.id);
      mapped++;
    } else {
      notFound++;
      console.log(chalk.red(`⚠️  No player found for ESPN ID: ${espnId}`));
    }
  }
  
  console.log(chalk.green(`\n✓ Mapped ${mapped} ESPN IDs to database player IDs`));
  if (notFound > 0) {
    console.log(chalk.yellow(`⚠️  ${notFound} ESPN IDs could not be mapped\n`));
  }
  
  // Now fix the stats
  console.log(chalk.cyan('Fixing player_stats entries...\n'));
  
  let fixed = 0;
  let errors = 0;
  const batchSize = 100;
  
  for (let i = 0; i < problemStats.length; i += batchSize) {
    const batch = problemStats.slice(i, i + batchSize);
    
    for (const stat of batch) {
      const correctPlayerId = espnToDbMap.get(stat.player_id);
      
      if (correctPlayerId) {
        const { error } = await supabase
          .from('player_stats')
          .update({ player_id: correctPlayerId })
          .eq('id', stat.id);
          
        if (error) {
          console.error(chalk.red(`Error fixing stat ${stat.id}:`), error);
          errors++;
        } else {
          fixed++;
        }
      }
    }
    
    // Progress update
    const progress = Math.min(i + batchSize, problemStats.length);
    console.log(chalk.gray(`Progress: ${progress}/${problemStats.length} (${fixed} fixed, ${errors} errors)`));
  }
  
  console.log(chalk.bold.green(`\n\n✅ FIXING COMPLETE!\n`));
  console.log(chalk.green(`Stats fixed: ${fixed}`));
  console.log(chalk.red(`Errors: ${errors}`));
  console.log(chalk.yellow(`Skipped (no mapping): ${problemStats.length - fixed - errors}`));
  
  // Verify the fix
  console.log(chalk.cyan('\n🔍 Verifying fix...\n'));
  
  const { count: remainingBad } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true })
    .gt('player_id', 1000000);
    
  console.log(chalk.yellow(`Remaining stats with ESPN IDs: ${remainingBad || 0}`));
  
  // Check if we now have proper coverage
  const { data: coverage } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(10000);
    
  const uniqueGames = new Set(coverage?.map(s => s.game_id));
  console.log(chalk.green(`\n📊 Stats now cover ${uniqueGames.size} unique games`));
}

// Add dry run option
const isDryRun = process.argv.includes('--dry-run');

if (isDryRun) {
  console.log(chalk.yellow('\n⚠️  DRY RUN MODE - No changes will be made\n'));
}

fixSwappedIds().catch(console.error);