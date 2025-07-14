#!/usr/bin/env tsx
/**
 * DEBUG PLAYER GAME LOGS - Check what data we actually have
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import chalk from 'chalk';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugPlayerGameLogs() {
  console.log(chalk.bold.cyan('🔍 DEBUGGING PLAYER GAME LOGS DATA'));
  
  try {
    // 1. Check total count
    const { count: totalCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.blue(`\n📊 Total player_game_logs: ${totalCount?.toLocaleString()}`));
    
    // 2. Check count with stats.points
    const { count: withPoints } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('stats->points', 'is', null);
    
    console.log(chalk.blue(`📊 Records with stats.points: ${withPoints?.toLocaleString()}`));
    
    // 3. Check count with is_home field
    const { count: withIsHome } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('is_home', 'is', null);
    
    console.log(chalk.blue(`📊 Records with is_home: ${withIsHome?.toLocaleString()}`));
    
    // 4. Check count with minutes_played
    const { count: withMinutes } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('minutes_played', 'is', null);
    
    console.log(chalk.blue(`📊 Records with minutes_played: ${withMinutes?.toLocaleString()}`));
    
    // 5. Check count with game_date
    const { count: withGameDate } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('game_date', 'is', null);
    
    console.log(chalk.blue(`📊 Records with game_date: ${withGameDate?.toLocaleString()}`));
    
    // 6. Check count with ALL required fields
    const { count: completeRecords } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('stats->points', 'is', null)
      .not('is_home', 'is', null)
      .not('minutes_played', 'is', null)
      .not('game_date', 'is', null);
    
    console.log(chalk.green(`\n✅ Records with ALL pattern fields: ${completeRecords?.toLocaleString()}`));
    
    // 7. Get sample records to inspect structure
    console.log(chalk.yellow('\n📋 Sample Records:'));
    
    const { data: sampleRecords } = await supabase
      .from('player_game_logs')
      .select('*')
      .limit(5);
    
    if (sampleRecords && sampleRecords.length > 0) {
      sampleRecords.forEach((record, index) => {
        console.log(chalk.cyan(`\nRecord ${index + 1}:`));
        console.log(`  ID: ${record.id}`);
        console.log(`  Player ID: ${record.player_id}`);
        console.log(`  Game ID: ${record.game_id}`);
        console.log(`  is_home: ${record.is_home}`);
        console.log(`  minutes_played: ${record.minutes_played}`);
        console.log(`  game_date: ${record.game_date}`);
        console.log(`  stats: ${JSON.stringify(record.stats).substring(0, 100)}...`);
        console.log(`  computed_metrics: ${JSON.stringify(record.computed_metrics).substring(0, 100)}...`);
      });
    }
    
    // 8. Check specific stats fields
    console.log(chalk.yellow('\n📊 Checking stats field structure:'));
    
    const { data: statsStructure } = await supabase
      .from('player_game_logs')
      .select('stats')
      .not('stats', 'is', null)
      .limit(10);
    
    if (statsStructure && statsStructure.length > 0) {
      const statKeys = new Set<string>();
      statsStructure.forEach(record => {
        if (record.stats && typeof record.stats === 'object') {
          Object.keys(record.stats).forEach(key => statKeys.add(key));
        }
      });
      
      console.log(chalk.blue('Available stats fields:'));
      Array.from(statKeys).sort().forEach(key => {
        console.log(`  - ${key}`);
      });
    }
    
    // 9. Check data types of key fields
    console.log(chalk.yellow('\n🔍 Checking data types in stats.points:'));
    
    const { data: pointsData } = await supabase
      .from('player_game_logs')
      .select('stats')
      .not('stats->points', 'is', null)
      .limit(20);
    
    if (pointsData && pointsData.length > 0) {
      const pointTypes = new Map<string, number>();
      pointsData.forEach(record => {
        const points = record.stats?.points;
        const type = typeof points;
        pointTypes.set(type, (pointTypes.get(type) || 0) + 1);
        
        // Show some example values
        if (pointTypes.get(type) === 1) {
          console.log(`  Example ${type}: ${points}`);
        }
      });
      
      console.log(chalk.blue('\nData type distribution:'));
      pointTypes.forEach((count, type) => {
        console.log(`  ${type}: ${count} records`);
      });
    }
    
    // 10. Check for any "complete" field
    const { data: completeFieldCheck } = await supabase
      .from('player_game_logs')
      .select('*')
      .limit(1);
    
    if (completeFieldCheck && completeFieldCheck.length > 0) {
      const fieldNames = Object.keys(completeFieldCheck[0]);
      console.log(chalk.yellow('\n📋 All available fields:'));
      fieldNames.forEach(field => {
        console.log(`  - ${field}`);
      });
    }
    
  } catch (error: any) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
  }
}

// Run the debug script
debugPlayerGameLogs().catch(console.error);