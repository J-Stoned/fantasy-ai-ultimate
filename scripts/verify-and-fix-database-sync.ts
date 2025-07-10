#!/usr/bin/env tsx
/**
 * 🔧 VERIFY AND FIX DATABASE SYNC - Ensure stats are ACTUALLY saved
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAndFixDatabaseSync() {
  console.log(chalk.bold.cyan('\n🔧 VERIFYING AND FIXING DATABASE SYNC\n'));
  
  try {
    // 1. Check what collectors reported vs what's in database
    console.log(chalk.yellow('📊 COLLECTOR REPORTS VS DATABASE REALITY:\n'));
    
    const reports = [
      { file: './nfl-coverage-report-v4.json', sport: 'NFL' },
      { file: './nba-coverage-report-v4.json', sport: 'NBA' },
      { file: './mlb-coverage-report-v4.json', sport: 'MLB' },
      { file: './nhl-coverage-report-v4.json', sport: 'NHL' }
    ];
    
    for (const report of reports) {
      if (fs.existsSync(report.file)) {
        const data = JSON.parse(fs.readFileSync(report.file, 'utf-8'));
        console.log(`${report.sport} Collector reported: ${data.coverage}% (${data.gamesWithStats}/${data.totalGames})`);
        
        // Check actual database
        const { count: actualGames } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('sport_id', report.sport.toLowerCase())
          .gte('start_time', '2024-01-01')
          .lt('start_time', '2025-01-01')
          .not('home_score', 'is', null);
        
        // Get unique games with logs
        const { data: gamesWithLogs } = await supabase
          .from('games')
          .select('id')
          .eq('sport_id', report.sport.toLowerCase())
          .gte('start_time', '2024-01-01')
          .lt('start_time', '2025-01-01')
          .not('home_score', 'is', null);
        
        let actualWithStats = 0;
        if (gamesWithLogs) {
          for (const game of gamesWithLogs) {
            const { count } = await supabase
              .from('player_game_logs')
              .select('*', { count: 'exact', head: true })
              .eq('game_id', game.id)
              .limit(1);
            
            if (count && count > 0) actualWithStats++;
          }
        }
        
        const actualCoverage = actualGames ? ((actualWithStats / actualGames) * 100).toFixed(1) : '0';
        console.log(`${report.sport} Database actual: ${actualCoverage}% (${actualWithStats}/${actualGames})`);
        
        if (Math.abs(parseFloat(data.coverage) - parseFloat(actualCoverage)) > 5) {
          console.log(chalk.red(`  ⚠️  MISMATCH! Collector says ${data.coverage}% but database shows ${actualCoverage}%`));
        } else {
          console.log(chalk.green(`  ✅ Match confirmed`));
        }
        
        console.log('');
      }
    }
    
    // 2. Check for failed inserts
    console.log(chalk.yellow('🔍 CHECKING FOR COMMON ISSUES:\n'));
    
    // Check for games with partial stats
    const { data: recentGames } = await supabase
      .from('games')
      .select('id')
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null)
      .limit(100);
    
    let gamesWithPartialStats = 0;
    if (recentGames) {
      for (const game of recentGames) {
        const { count } = await supabase
          .from('player_game_logs')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', game.id);
        
        if (count && count > 0 && count < 10) {
          gamesWithPartialStats++;
        }
      }
    }
    
    console.log(`Games with partial stats (<10 players): ${gamesWithPartialStats}`);
    
    // 3. Test inserting a sample stat
    console.log(chalk.yellow('\n🧪 TESTING DATABASE WRITE:\n'));
    
    const testStat = {
      game_id: 999999, // Test game ID
      player_id: 1, // Test player
      game_date: '2024-01-01',
      stats: { test: true },
      fantasy_points: 0
    };
    
    const { error: insertError } = await supabase
      .from('player_game_logs')
      .insert(testStat);
    
    if (insertError) {
      console.log(chalk.red('❌ Database write test FAILED:'), insertError.message);
    } else {
      console.log(chalk.green('✅ Database write test PASSED'));
      
      // Clean up test
      await supabase
        .from('player_game_logs')
        .delete()
        .eq('game_id', 999999);
    }
    
    // 4. Final summary
    console.log(chalk.bold.cyan('\n📊 DATABASE SYNC SUMMARY:\n'));
    
    const { count: totalLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    
    console.log(`Total logs in database: ${totalLogs?.toLocaleString()}`);
    console.log(`Logs added today: ${todayLogs?.toLocaleString()}`);
    
    // 5. Recommendations
    console.log(chalk.bold.yellow('\n💡 RECOMMENDATIONS:\n'));
    
    if (gamesWithPartialStats > 10) {
      console.log('- Many games have partial stats - player matching may be failing');
      console.log('- Run player data standardization scripts');
    }
    
    console.log('- Use smaller batch sizes when inserting (100-500 records)');
    console.log('- Add retry logic for failed inserts');
    console.log('- Verify player IDs exist before inserting stats');
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

verifyAndFixDatabaseSync();