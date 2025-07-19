#!/usr/bin/env tsx
/**
 * 🔍 INVESTIGATE STATS BY GAME SPORT
 * 
 * Better approach: Join player_game_logs with games table to get sport
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateStatsByGameSport() {
  console.log(chalk.bold.cyan('🔍 INVESTIGATING PLAYER STATS BY GAME SPORT\n'));

  try {
    // 1. Total player_game_logs
    console.log(chalk.blue('1️⃣ Total player_game_logs count...'));
    const { count: totalLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.green(`Total: ${totalLogs?.toLocaleString()}`));

    // 2. Check stats column structure
    console.log(chalk.blue('\n2️⃣ Checking stats column structure...'));
    const { data: sampleLogs } = await supabase
      .from('player_game_logs')
      .select('id, stats')
      .limit(100);
    
    let nullCount = 0;
    let emptyCount = 0;
    let withDataCount = 0;
    const fieldCounts: number[] = [];
    
    sampleLogs?.forEach(log => {
      if (log.stats === null) {
        nullCount++;
      } else if (typeof log.stats === 'object' && Object.keys(log.stats).length === 0) {
        emptyCount++;
      } else {
        withDataCount++;
        fieldCounts.push(Object.keys(log.stats).length);
      }
    });
    
    console.log(`Sample of 100: ${withDataCount} with data, ${emptyCount} empty, ${nullCount} null`);
    if (fieldCounts.length > 0) {
      console.log(`Field counts: min=${Math.min(...fieldCounts)}, max=${Math.max(...fieldCounts)}, avg=${Math.round(fieldCounts.reduce((a,b) => a+b, 0) / fieldCounts.length)}`);
    }

    // 3. Get sports from games table
    console.log(chalk.blue('\n3️⃣ Getting unique sports from games table...'));
    const { data: sports } = await supabase
      .from('games')
      .select('sport')
      .not('sport', 'is', null);
    
    const uniqueSports = [...new Set(sports?.map(s => s.sport) || [])];
    console.log(chalk.yellow(`Found ${uniqueSports.length} sports: ${uniqueSports.join(', ')}`));

    // 4. Count stats by sport (using game joins)
    console.log(chalk.blue('\n4️⃣ Counting stats by sport (via game joins)...'));
    
    const sportCounts: Record<string, number> = {};
    
    for (const sport of uniqueSports) {
      // Get game IDs for this sport
      const { data: games } = await supabase
        .from('games')
        .select('id')
        .eq('sport', sport);
      
      const gameIds = games?.map(g => g.id) || [];
      
      if (gameIds.length === 0) {
        sportCounts[sport] = 0;
        continue;
      }
      
      // Count stats for these games (in batches)
      let sportTotal = 0;
      for (let i = 0; i < gameIds.length; i += 500) {
        const batch = gameIds.slice(i, i + 500);
        const { count } = await supabase
          .from('player_game_logs')
          .select('*', { count: 'exact', head: true })
          .in('game_id', batch);
        
        sportTotal += count || 0;
      }
      
      sportCounts[sport] = sportTotal;
      console.log(`${sport}: ${sportTotal.toLocaleString()} stats`);
    }

    // 5. Check for orphaned stats (no matching game)
    console.log(chalk.blue('\n5️⃣ Checking for orphaned stats (no game match)...'));
    
    // Get sample of game_ids from stats
    const { data: statGameIds } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .limit(1000);
    
    const uniqueStatGameIds = [...new Set(statGameIds?.map(s => s.game_id) || [])];
    
    // Check if these games exist
    const { data: existingGames } = await supabase
      .from('games')
      .select('id')
      .in('id', uniqueStatGameIds);
    
    const existingGameIds = new Set(existingGames?.map(g => g.id) || []);
    const orphanedGameIds = uniqueStatGameIds.filter(id => !existingGameIds.has(id));
    
    console.log(`Sample check: ${orphanedGameIds.length} of ${uniqueStatGameIds.length} stats point to non-existent games`);

    // 6. Look for the missing NCAA Baseball stats
    console.log(chalk.blue('\n6️⃣ Looking for misattributed NCAA Baseball stats...'));
    
    // Check for stats in spring months
    const { count: springStats } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .gte('game_date', '2023-02-01')
      .lte('game_date', '2023-06-30');
    
    console.log(chalk.yellow(`Spring season stats (Feb-Jun): ${springStats?.toLocaleString()}`));

    // 7. Check player_stats table if it exists
    console.log(chalk.blue('\n7️⃣ Checking for player_stats table...'));
    
    const { count: playerStatsCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    if (playerStatsCount !== null) {
      console.log(chalk.green(`Found player_stats table with ${playerStatsCount.toLocaleString()} records!`));
    } else {
      console.log(chalk.gray('No player_stats table found'));
    }

    // Generate final report
    console.log(chalk.bold.cyan('\n\n📊 FINAL REPORT\n'));
    console.log(chalk.gray('='.repeat(80)));
    
    console.log(chalk.yellow('STATS BREAKDOWN BY SPORT:'));
    const sortedSports = Object.entries(sportCounts).sort(([,a], [,b]) => b - a);
    let totalAcrossSports = 0;
    
    sortedSports.forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count.toLocaleString()}`);
      totalAcrossSports += count;
    });
    
    console.log(chalk.gray('-'.repeat(40)));
    console.log(`  TOTAL: ${totalAcrossSports.toLocaleString()}`);
    
    console.log(chalk.yellow('\n\nKEY FINDINGS:'));
    console.log(`1. Total player_game_logs: ${totalLogs?.toLocaleString()}`);
    console.log(`2. Sum of stats by sport: ${totalAcrossSports.toLocaleString()}`);
    console.log(`3. Difference: ${(totalLogs! - totalAcrossSports).toLocaleString()} (likely orphaned or null sport)`);
    console.log(`4. Gap from CLAUDE.md (713,216): ${(713216 - totalLogs!).toLocaleString()}`);
    
    if (playerStatsCount !== null) {
      console.log(chalk.green(`\n✅ IMPORTANT: Found separate player_stats table with ${playerStatsCount.toLocaleString()} records!`));
      console.log('This might be where the actual detailed stats are stored.');
    }

    console.log(chalk.yellow('\n\nLIKELY EXPLANATION:'));
    console.log('1. The 713,216 count might have included both player_game_logs AND player_stats');
    console.log('2. The missing 184K NCAA Baseball stats are orphaned (player ID mismatch)');
    console.log('3. Some stats may have been cleaned up or deduplicated');
    console.log('4. player_game_logs might be game participation records, not detailed stats');

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

// Run investigation
investigateStatsByGameSport().catch(console.error);