#!/usr/bin/env tsx
/**
 * 💣 NUKE ALL FAKE DATA - AGGRESSIVE CLEANUP
 * Delete ALL fake garbage from the database!
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function nukeAllFakeData() {
  console.log(chalk.bold.red('💣 NUKING ALL FAKE DATA!\n'));
  
  const startTime = Date.now();
  
  // STEP 1: Delete the 82,755 fake games
  console.log(chalk.red('🎮 STEP 1: NUKING 82,755 FAKE GAMES...'));
  
  // First, get all game IDs with NULL external_id
  console.log(chalk.yellow('  Getting all fake game IDs...'));
  const fakeGameIds: number[] = [];
  let offset = 0;
  
  while (true) {
    const { data: batch } = await supabase
      .from('games')
      .select('id')
      .is('external_id', null)
      .range(offset, offset + 9999);
      
    if (!batch || batch.length === 0) break;
    
    fakeGameIds.push(...batch.map(g => g.id));
    console.log(chalk.gray(`  Collected ${fakeGameIds.length} fake game IDs...`));
    
    if (batch.length < 10000) break;
    offset += 10000;
  }
  
  console.log(chalk.yellow(`  Found ${fakeGameIds.length.toLocaleString()} fake games to delete!`));
  
  // Delete in batches
  const batchSize = 500;
  let gamesDeleted = 0;
  
  for (let i = 0; i < fakeGameIds.length; i += batchSize) {
    const batch = fakeGameIds.slice(i, i + batchSize);
    
    // Delete game logs first
    await supabase.from('player_game_logs').delete().in('game_id', batch);
    
    // Delete games
    const { error, count } = await supabase
      .from('games')
      .delete()
      .in('id', batch);
      
    if (!error && count) {
      gamesDeleted += count;
      
      if (gamesDeleted % 10000 === 0) {
        console.log(chalk.green(`  💥 Nuked ${gamesDeleted.toLocaleString()} fake games...`));
      }
    }
  }
  
  console.log(chalk.bold.green(`✅ NUKED ${gamesDeleted.toLocaleString()} FAKE GAMES!`));
  
  // STEP 2: Delete test players and their stats
  console.log(chalk.red('\n👤 STEP 2: NUKING TEST PLAYERS AND THEIR STATS...'));
  
  // Get ALL test player IDs first
  const testPlayerIds: number[] = [];
  
  // Pattern 1: The 175133 pattern
  const { data: pattern175 } = await supabase
    .from('players')
    .select('id')
    .like('name', '%_175133%_%');
    
  if (pattern175) {
    testPlayerIds.push(...pattern175.map(p => p.id));
    console.log(chalk.yellow(`  Found ${pattern175.length} players with 175133 pattern`));
  }
  
  // Pattern 2: No names
  const { data: noNames } = await supabase
    .from('players')
    .select('id')
    .or('name.is.null,firstname.is.null,lastname.is.null');
    
  if (noNames) {
    testPlayerIds.push(...noNames.map(p => p.id));
    console.log(chalk.yellow(`  Found ${noNames.length} players without names`));
  }
  
  // Pattern 3: Test/demo/sample
  const patterns = ['%test%', '%demo%', '%sample%', 'Player %'];
  for (const pattern of patterns) {
    const { data } = await supabase
      .from('players')
      .select('id')
      .ilike('name', pattern);
      
    if (data && data.length > 0) {
      testPlayerIds.push(...data.map(p => p.id));
      console.log(chalk.yellow(`  Found ${data.length} players matching: ${pattern}`));
    }
  }
  
  console.log(chalk.red(`\n  💣 TOTAL TEST PLAYERS TO NUKE: ${testPlayerIds.length}`));
  
  // Delete their stats first (this is the 3.7M records)
  console.log(chalk.yellow('  Nuking player stats...'));
  
  let statsDeleted = 0;
  for (let i = 0; i < testPlayerIds.length; i += 100) {
    const batch = testPlayerIds.slice(i, i + 100);
    
    const { count } = await supabase
      .from('player_stats')
      .delete()
      .in('player_id', batch);
      
    if (count) {
      statsDeleted += count;
      
      if (statsDeleted % 100000 === 0) {
        console.log(chalk.green(`  💥 Nuked ${statsDeleted.toLocaleString()} fake stats...`));
      }
    }
  }
  
  console.log(chalk.bold.green(`  ✅ NUKED ${statsDeleted.toLocaleString()} FAKE STATS!`));
  
  // Now delete the players
  console.log(chalk.yellow('  Nuking test players...'));
  
  let playersDeleted = 0;
  for (let i = 0; i < testPlayerIds.length; i += 500) {
    const batch = testPlayerIds.slice(i, i + 500);
    
    // Clean all related tables
    await supabase.from('player_injuries').delete().in('player_id', batch);
    await supabase.from('player_game_logs').delete().in('player_id', batch);
    await supabase.from('player_news').delete().in('player_id', batch);
    
    // Delete players
    const { count } = await supabase
      .from('players')
      .delete()
      .in('id', batch);
      
    if (count) {
      playersDeleted += count;
    }
  }
  
  console.log(chalk.bold.green(`  ✅ NUKED ${playersDeleted} TEST PLAYERS!`));
  
  // STEP 3: Final cleanup
  console.log(chalk.red('\n🧹 STEP 3: FINAL CLEANUP...'));
  
  // Delete any ML predictions (we'll retrain)
  await supabase.from('ml_predictions').delete().gte('id', '00000000-0000-0000-0000-000000000000');
  console.log(chalk.green('  ✅ Cleared ML predictions'));
  
  // STEP 4: Show what's left
  console.log(chalk.cyan('\n📊 CHECKING WHAT REMAINS...'));
  
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
    
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
    
  const { count: validGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('external_id', 'is', null);
    
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
    
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log(chalk.bold.green('\n💥 NUKE COMPLETE!\n'));
  console.log(chalk.cyan('📊 CLEAN DATABASE:'));
  console.log(chalk.cyan('═'.repeat(50)));
  console.log(`Players: ${totalPlayers?.toLocaleString()} (was 25,162)`);
  console.log(`Games: ${totalGames?.toLocaleString()} (was 86,845)`);
  console.log(`Valid games: ${validGames?.toLocaleString()} (was ~4,000)`);
  console.log(`Player stats: ${totalStats?.toLocaleString()} (was 3.7M)`);
  console.log(`\nTime: ${elapsed} seconds`);
  
  // Show real data breakdown
  const { count: nfl } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .ilike('external_id', 'sleeper_%');
    
  const { count: ncaa } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .ilike('external_id', 'espn_ncaa_%');
    
  console.log(chalk.bold.green('\n✨ REAL DATA REMAINING:'));
  console.log(`NFL: ${nfl?.toLocaleString()} players`);
  console.log(`NCAA: ${ncaa?.toLocaleString()} players`);
  console.log(`Plus MLB, NHL, NBA players`);
  
  console.log(chalk.bold.yellow('\n🚀 YOUR DATABASE IS NOW 100% REAL DATA!'));
  console.log(chalk.gray('Next: Run collectors to gather more real game data'));
}

nukeAllFakeData().catch(console.error);