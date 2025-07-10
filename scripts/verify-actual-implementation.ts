#!/usr/bin/env tsx
/**
 * Verify if the stats improvements are actually in the database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyActualImplementation() {
  console.log(chalk.bold.cyan('\n🔍 VERIFYING ACTUAL DATABASE IMPLEMENTATION\n'));
  
  try {
    // 1. Count total player_game_logs
    const { count: totalLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.yellow('Database Stats:'));
    console.log(`Total player_game_logs: ${totalLogs?.toLocaleString()}`);
    
    // 2. Check logs added today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    
    console.log(`Game logs added today: ${todayCount?.toLocaleString()}`);
    
    // 3. Check last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { count: lastHourCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo.toISOString());
    
    console.log(`Game logs added in last hour: ${lastHourCount?.toLocaleString()}`);
    
    // 4. Get most recent entries
    const { data: recentLogs } = await supabase
      .from('player_game_logs')
      .select('id, game_id, created_at')
      .order('created_at', { ascending: false })
      .limit(3);
    
    console.log('\nMost recent game logs:');
    recentLogs?.forEach(log => {
      const created = new Date(log.created_at);
      const minutesAgo = Math.floor((Date.now() - created.getTime()) / 1000 / 60);
      console.log(`  Game ${log.game_id} - ${minutesAgo} minutes ago`);
    });
    
    // 5. Check 2024 NFL coverage
    console.log(chalk.yellow('\n2024 NFL Coverage:'));
    
    const { data: games2024 } = await supabase
      .from('games')
      .select('id')
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null);
    
    const totalGames = games2024?.length || 0;
    console.log(`Total 2024 NFL games: ${totalGames}`);
    
    // Count games with stats
    let gamesWithStats = 0;
    if (games2024) {
      const gameIds = games2024.map(g => g.id);
      
      // Check in batches
      for (let i = 0; i < gameIds.length; i += 100) {
        const batch = gameIds.slice(i, i + 100);
        const { data } = await supabase
          .from('player_game_logs')
          .select('game_id')
          .in('game_id', batch);
        
        const uniqueGames = new Set(data?.map(d => d.game_id) || []);
        gamesWithStats += uniqueGames.size;
      }
    }
    
    const coverage = ((gamesWithStats / totalGames) * 100).toFixed(1);
    console.log(`Games with stats: ${gamesWithStats}`);
    console.log(chalk.bold.green(`Current coverage: ${coverage}%`));
    
    // 6. Test specific games we tried to fix
    console.log(chalk.yellow('\nChecking specific games from fix attempt:'));
    const testGames = [3564384, 3564385, 3564386, 3564387, 3564388];
    
    for (const gameId of testGames) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', gameId);
      
      console.log(`  Game ${gameId}: ${count} stats ${count > 0 ? '✅' : '❌'}`);
    }
    
    // 7. Final verdict
    console.log(chalk.bold.cyan('\n📊 VERDICT:'));
    
    if (lastHourCount > 0 && parseFloat(coverage) > 90) {
      console.log(chalk.bold.green('✅ YES - Stats are ACTUALLY IMPLEMENTED!'));
      console.log(`   - ${lastHourCount} logs added in last hour`);
      console.log(`   - Coverage improved to ${coverage}%`);
      console.log(`   - Test games have stats`);
    } else if (parseFloat(coverage) > 90) {
      console.log(chalk.yellow('🟡 PARTIALLY - High coverage but no recent activity'));
      console.log(`   - Coverage is ${coverage}% (good)`);
      console.log(`   - But no logs added recently`);
    } else {
      console.log(chalk.red('❌ NO - Stats are NOT implemented'));
      console.log(`   - Coverage still at ${coverage}%`);
      console.log(`   - No recent logs added`);
      console.log(`   - Fix script may have failed`);
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

verifyActualImplementation();