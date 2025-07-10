#!/usr/bin/env tsx
/**
 * 🔍 VERIFY ALL SPORTS DATABASE - No BS, just facts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyAllSportsDatabase() {
  console.log(chalk.bold.cyan('\n🔍 VERIFYING ACTUAL DATABASE IMPLEMENTATION - NO BS\n'));
  
  try {
    // 1. Total database stats
    console.log(chalk.bold.yellow('📊 DATABASE REALITY CHECK:\n'));
    
    const { count: totalLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Total player_game_logs in database: ${totalLogs?.toLocaleString()}`);
    
    // Check what was added today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    
    console.log(`Logs added today: ${todayCount?.toLocaleString()}`);
    
    // 2. Check each sport's ACTUAL coverage
    console.log(chalk.bold.yellow('\n🏆 ACTUAL COVERAGE BY SPORT:\n'));
    
    const sports = ['nfl', 'nba', 'mlb', 'nhl'];
    const results: any = {};
    
    for (const sport of sports) {
      // Get ALL 2024 games for this sport
      const { data: games } = await supabase
        .from('games')
        .select('id, external_id, start_time')
        .eq('sport_id', sport)
        .gte('start_time', '2024-01-01')
        .lt('start_time', '2025-01-01')
        .not('home_score', 'is', null)
        .not('away_score', 'is', null);
      
      if (!games || games.length === 0) {
        console.log(`${sport.toUpperCase()}: No games found`);
        continue;
      }
      
      // Count games with actual stats
      let gamesWithStats = 0;
      const gamesWithoutStats = [];
      
      for (const game of games) {
        const { count } = await supabase
          .from('player_game_logs')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', game.id);
        
        if (count && count > 0) {
          gamesWithStats++;
        } else {
          gamesWithoutStats.push(game);
        }
      }
      
      const coverage = ((gamesWithStats / games.length) * 100).toFixed(1);
      const gapsTo95 = Math.max(0, Math.ceil(games.length * 0.95) - gamesWithStats);
      
      results[sport] = {
        total: games.length,
        withStats: gamesWithStats,
        withoutStats: games.length - gamesWithStats,
        coverage: parseFloat(coverage),
        gapsTo95
      };
      
      // Color code the output
      let color = 'red';
      let status = 'NEEDS WORK';
      if (parseFloat(coverage) >= 95) {
        color = 'green';
        status = 'GOLD STANDARD ✅';
      } else if (parseFloat(coverage) >= 90) {
        color = 'yellow';
        status = 'PROFESSIONAL 🟡';
      } else if (parseFloat(coverage) >= 85) {
        color = 'cyan';
        status = 'GOOD 🔵';
      }
      
      console.log(chalk[color as 'red'](
        `${sport.toUpperCase()}: ${gamesWithStats}/${games.length} games (${coverage}%) - ${status}`
      ));
      
      if (gapsTo95 > 0) {
        console.log(`  Need ${gapsTo95} more games for 95%`);
      }
      
      // Show sample of missing games
      if (gamesWithoutStats.length > 0 && gamesWithoutStats.length <= 5) {
        console.log('  Missing game IDs:', gamesWithoutStats.map(g => g.id).join(', '));
      }
    }
    
    // 3. Overall platform coverage
    const totalGames = Object.values(results).reduce((sum: number, r: any) => sum + r.total, 0);
    const totalWithStats = Object.values(results).reduce((sum: number, r: any) => sum + r.withStats, 0);
    const overallCoverage = ((totalWithStats / totalGames) * 100).toFixed(1);
    
    console.log(chalk.bold.cyan('\n📈 OVERALL PLATFORM COVERAGE:'));
    console.log(`Total 2024 games: ${totalGames}`);
    console.log(`Games with stats: ${totalWithStats}`);
    console.log(`Overall coverage: ${overallCoverage}%`);
    
    // 4. Recent activity check
    console.log(chalk.bold.yellow('\n⏰ RECENT ACTIVITY:'));
    
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);
    const { data: recentLogs } = await supabase
      .from('player_game_logs')
      .select('id, game_id, created_at')
      .gte('created_at', lastHour.toISOString())
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (recentLogs && recentLogs.length > 0) {
      console.log(`Last ${recentLogs.length} logs:`);
      recentLogs.forEach(log => {
        const age = Math.floor((Date.now() - new Date(log.created_at).getTime()) / 1000 / 60);
        console.log(`  Game ${log.game_id} - ${age} minutes ago`);
      });
    } else {
      console.log(chalk.red('  No logs added in the last hour'));
    }
    
    // 5. Final verdict
    console.log(chalk.bold.magenta('\n🎯 BOTTOM LINE:\n'));
    
    const sportsAt95Plus = Object.entries(results).filter(([_, r]: [string, any]) => r.coverage >= 95);
    const sportsAt90Plus = Object.entries(results).filter(([_, r]: [string, any]) => r.coverage >= 90);
    
    if (sportsAt95Plus.length === 4) {
      console.log(chalk.bold.green('✅ ALL SPORTS AT 95%+ COVERAGE - GOLD STANDARD ACHIEVED!'));
    } else if (sportsAt90Plus.length === 4) {
      console.log(chalk.bold.yellow('🟡 ALL SPORTS AT 90%+ COVERAGE - PROFESSIONAL GRADE!'));
    } else {
      console.log(chalk.bold.red(`❌ Only ${sportsAt95Plus.length}/4 sports at 95%+ coverage`));
      console.log(chalk.yellow(`🟡 ${sportsAt90Plus.length}/4 sports at 90%+ coverage`));
      
      // Show what needs to be done
      console.log(chalk.cyan('\n📋 TO ACHIEVE 95%+ EVERYWHERE:'));
      Object.entries(results).forEach(([sport, r]: [string, any]) => {
        if (r.coverage < 95 && r.gapsTo95 > 0) {
          console.log(`  ${sport.toUpperCase()}: Need ${r.gapsTo95} more games`);
        }
      });
    }
    
    // 6. Data integrity check
    console.log(chalk.bold.yellow('\n🔒 DATA INTEGRITY:'));
    
    // Check for duplicate entries
    const { data: duplicateCheck } = await supabase.rpc('check_duplicate_game_logs');
    if (duplicateCheck && duplicateCheck.length > 0) {
      console.log(chalk.red(`  ⚠️  Found ${duplicateCheck.length} duplicate entries`));
    } else {
      console.log(chalk.green('  ✅ No duplicate entries found'));
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

verifyAllSportsDatabase();