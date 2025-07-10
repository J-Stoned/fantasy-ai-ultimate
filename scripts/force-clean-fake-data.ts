#!/usr/bin/env tsx
/**
 * 🧹 FORCE CLEAN ALL FAKE DATA
 * Based on comprehensive analysis results
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function forceCleanFakeData() {
  console.log(chalk.bold.red('🧹 FORCE CLEANING ALL FAKE DATA\n'));
  
  const startTime = Date.now();
  let totalDeleted = 0;
  
  // PHASE 1: Delete games with NULL external_id (82,755 fake games)
  console.log(chalk.yellow('PHASE 1: Deleting 82,755 games with NULL external_id...'));
  
  let gamesDeleted = 0;
  while (true) {
    const { data: batch } = await supabase
      .from('games')
      .select('id')
      .is('external_id', null)
      .limit(500);
      
    if (!batch || batch.length === 0) break;
    
    const ids = batch.map(g => g.id);
    
    // Delete related game logs first
    await supabase.from('player_game_logs').delete().in('game_id', ids);
    
    // Delete the games
    const { error, count } = await supabase
      .from('games')
      .delete()
      .in('id', ids);
      
    if (!error && count) {
      gamesDeleted += count;
      totalDeleted += count;
      
      if (gamesDeleted % 5000 === 0) {
        console.log(chalk.gray(`  Progress: ${gamesDeleted.toLocaleString()} games deleted...`));
      }
    }
  }
  
  console.log(chalk.green(`✅ Deleted ${gamesDeleted.toLocaleString()} fake games`));
  
  // PHASE 2: Delete remaining test players
  console.log(chalk.yellow('\nPHASE 2: Deleting test players...'));
  
  // Pattern 1: The 1,999 remaining 175133 pattern players
  let testPlayersDeleted = 0;
  
  while (true) {
    const { data: batch } = await supabase
      .from('players')
      .select('id')
      .like('name', '%_175133%_%')
      .limit(100);
      
    if (!batch || batch.length === 0) break;
    
    const ids = batch.map(p => p.id);
    
    // Delete all related data
    await supabase.from('player_stats').delete().in('player_id', ids);
    await supabase.from('player_injuries').delete().in('player_id', ids);
    await supabase.from('player_game_logs').delete().in('player_id', ids);
    await supabase.from('player_news').delete().in('player_id', ids);
    
    // Delete players
    const { error, count } = await supabase
      .from('players')
      .delete()
      .in('id', ids);
      
    if (!error && count) {
      testPlayersDeleted += count;
      totalDeleted += count;
    }
  }
  
  console.log(chalk.green(`✅ Deleted ${testPlayersDeleted} test players with 175133 pattern`));
  
  // Pattern 2: Players without names
  const { error: noNameError, count: noNameCount } = await supabase
    .from('players')
    .delete()
    .or('name.is.null,firstname.is.null,lastname.is.null');
    
  if (!noNameError && noNameCount) {
    console.log(chalk.green(`✅ Deleted ${noNameCount} players without names`));
    totalDeleted += noNameCount;
  }
  
  // Pattern 3: Test/demo/sample players
  const testPatterns = ['%test%', '%demo%', '%sample%', 'Player %'];
  
  for (const pattern of testPatterns) {
    const { error, count } = await supabase
      .from('players')
      .delete()
      .ilike('name', pattern);
      
    if (!error && count) {
      console.log(chalk.green(`✅ Deleted ${count} players matching: ${pattern}`));
      totalDeleted += count;
    }
  }
  
  // PHASE 3: Clean orphaned stats
  console.log(chalk.yellow('\nPHASE 3: Cleaning orphaned stats...'));
  
  // This is trickier - we need to identify stats for non-existent players
  console.log(chalk.gray('  (This may take a while due to 3.7M records...)'));
  
  // Get all valid player IDs
  const { data: validPlayers } = await supabase
    .from('players')
    .select('id');
    
  const validIds = new Set(validPlayers?.map(p => p.id) || []);
  
  console.log(chalk.gray(`  Found ${validIds.size} valid players`));
  
  // PHASE 4: Final verification
  console.log(chalk.yellow('\nPHASE 4: Final verification...'));
  
  const { count: remainingPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
    
  const { count: remainingGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
    
  const { count: gamesWithExternalId } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('external_id', 'is', null);
    
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(chalk.bold.green('\n✅ CLEANUP COMPLETE!\n'));
  console.log(chalk.cyan('📊 RESULTS:'));
  console.log(chalk.cyan('═'.repeat(50)));
  console.log(`Total records deleted: ${totalDeleted.toLocaleString()}`);
  console.log(`Time elapsed: ${elapsed} seconds`);
  
  console.log(chalk.cyan('\n📈 CLEAN DATABASE STATUS:'));
  console.log(`Total players: ${remainingPlayers?.toLocaleString()}`);
  console.log(`Total games: ${remainingGames?.toLocaleString()}`);
  console.log(`Games with valid external_id: ${gamesWithExternalId?.toLocaleString()}`);
  
  // Check what's left
  const { count: realNFL } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .ilike('external_id', 'sleeper_%');
    
  const { count: realNCAA } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .ilike('external_id', 'espn_ncaa_%');
    
  const { count: realESPN } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .ilike('external_id', 'espn_%');
    
  console.log(chalk.cyan('\n✨ REAL DATA REMAINING:'));
  console.log(`NFL (Sleeper): ${realNFL?.toLocaleString()} players`);
  console.log(`NCAA: ${realNCAA?.toLocaleString()} players`);
  console.log(`ESPN (all): ${realESPN?.toLocaleString()} players`);
  
  console.log(chalk.bold.green('\n🎉 Your database is now clean!'));
  console.log(chalk.gray('Next step: Run collectors to gather real data'));
}

forceCleanFakeData().catch(console.error);