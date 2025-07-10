#!/usr/bin/env tsx
/**
 * Final cleanup - delete last 2,999 test players with stats
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function finalCleanup() {
  console.log(chalk.bold.red('🧹 FINAL CLEANUP - Last 2,999 test players\n'));
  
  // Get ALL remaining test player IDs
  const { data: testPlayers } = await supabase
    .from('players')
    .select('id')
    .like('name', '%_175133%_%');
    
  if (!testPlayers || testPlayers.length === 0) {
    console.log(chalk.green('✅ No test players found! Database is clean!'));
    return;
  }
  
  console.log(chalk.yellow(`Found ${testPlayers.length} test players with stats to clean...`));
  
  const ids = testPlayers.map(p => p.id);
  let totalDeleted = 0;
  
  // Delete in small chunks to handle the stats
  const chunkSize = 50;
  
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    
    // Delete ALL related data for this chunk
    console.log(chalk.gray(`  Cleaning chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(ids.length/chunkSize)}...`));
    
    // Delete stats
    const { count: statsCount } = await supabase
      .from('player_stats')
      .delete()
      .in('player_id', chunk);
      
    if (statsCount) {
      console.log(chalk.gray(`    Deleted ${statsCount} stats records`));
    }
    
    // Delete injuries
    await supabase.from('player_injuries').delete().in('player_id', chunk);
    
    // Delete game logs
    await supabase.from('player_game_logs').delete().in('player_id', chunk);
    
    // Delete news
    await supabase.from('player_news').delete().in('player_id', chunk);
    
    // Now delete the players
    const { error, count } = await supabase
      .from('players')
      .delete()
      .in('id', chunk);
      
    if (!error && count) {
      totalDeleted += count;
    } else if (error) {
      console.error('Error:', error.message);
    }
  }
  
  console.log(chalk.green(`\n✅ Deleted ${totalDeleted} test players`));
  
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
    
  console.log(chalk.bold.green('\n🎉 DATABASE CLEANED!\n'));
  console.log(chalk.cyan('📊 FINAL CLEAN DATABASE:'));
  console.log(`Total players: ${remaining?.toLocaleString()} (was 858,164)`);
  console.log(`NFL: ${realNFL?.toLocaleString()} real players`);
  console.log(`NCAA: ${realNCAA?.toLocaleString()} real players`);
  console.log('Plus MLB, NHL, NBA players');
  
  console.log(chalk.bold.green('\n✨ Ready for REAL data collection and pattern detection!'));
}

finalCleanup().catch(console.error);