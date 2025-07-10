#!/usr/bin/env tsx
/**
 * 📊 CHECK CURRENT STATS COVERAGE
 * Comprehensive analysis of what stats we have
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkStatsCoverage() {
  console.log(chalk.bold.cyan('\n📊 COMPREHENSIVE STATS COVERAGE ANALYSIS\n'));
  
  // 1. Overall counts
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
    
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
    
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  // 2. Games with stats
  const { data: gamesWithStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(10000);
    
  const uniqueGamesWithStats = new Set(gamesWithStats?.map(s => s.game_id) || []);
  
  console.log(chalk.yellow('📈 OVERALL COVERAGE:'));
  console.log(chalk.white(`   Total completed games: ${totalGames?.toLocaleString()}`));
  console.log(chalk.white(`   Games with stats: ${uniqueGamesWithStats.size.toLocaleString()}`));
  console.log(chalk.cyan(`   Coverage: ${((uniqueGamesWithStats.size / (totalGames || 1)) * 100).toFixed(1)}%`));
  console.log(chalk.white(`   Total stat records: ${totalStats?.toLocaleString()}`));
  console.log(chalk.white(`   Total game logs: ${totalLogs?.toLocaleString()}\n`));
  
  // 3. Coverage by sport
  console.log(chalk.yellow('🏆 COVERAGE BY SPORT:'));
  
  const sports = ['nfl', 'nba', 'mlb', 'nhl'];
  for (const sport of sports) {
    // Total games
    const { count: sportGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport)
      .not('home_score', 'is', null);
      
    // Games with stats
    const { data: sportGamesWithStats } = await supabase
      .from('games')
      .select('games.id')
      .eq('sport_id', sport)
      .not('home_score', 'is', null);
      
    if (!sportGamesWithStats) continue;
    
    let gamesWithStatsCount = 0;
    for (const game of sportGamesWithStats) {
      const { count } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .limit(1);
        
      if (count && count > 0) gamesWithStatsCount++;
    }
    
    const coverage = sportGames ? (gamesWithStatsCount / sportGames * 100).toFixed(1) : '0';
    console.log(chalk.white(`   ${sport.toUpperCase()}: ${gamesWithStatsCount}/${sportGames} games (${coverage}%)`));
  }
  
  // 4. Recent activity
  console.log(chalk.yellow('\n📅 RECENT COLLECTION ACTIVITY:'));
  
  const { data: recentStats } = await supabase
    .from('player_stats')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(100);
    
  if (recentStats && recentStats.length > 0) {
    const today = new Date().toDateString();
    const todayStats = recentStats.filter(s => 
      new Date(s.created_at).toDateString() === today
    ).length;
    
    console.log(chalk.white(`   Stats added today: ${todayStats}`));
    console.log(chalk.white(`   Last stat added: ${new Date(recentStats[0].created_at).toLocaleString()}`));
  }
  
  // 5. Data quality check
  console.log(chalk.yellow('\n🔍 DATA QUALITY:'));
  
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select('stat_type, stat_value')
    .limit(20);
    
  const statTypes = new Set(sampleStats?.map(s => s.stat_type) || []);
  console.log(chalk.white(`   Unique stat types: ${statTypes.size}`));
  console.log(chalk.gray(`   Examples: ${Array.from(statTypes).slice(0, 5).join(', ')}`));
  
  // 6. Recommendation
  console.log(chalk.bold.yellow('\n💡 RECOMMENDATION:\n'));
  
  const coveragePercent = (uniqueGamesWithStats.size / (totalGames || 1)) * 100;
  
  if (coveragePercent < 10) {
    console.log(chalk.cyan('   ▶️  Run FULL collection - you have less than 10% coverage'));
    console.log(chalk.white(`   This will collect stats for ${(totalGames || 0) - uniqueGamesWithStats.size} games`));
    console.log(chalk.white('   Estimated time: 20-30 minutes'));
  } else if (coveragePercent < 90) {
    console.log(chalk.cyan('   ▶️  Run PARTIAL collection - fill in the gaps'));
    console.log(chalk.white(`   This will collect stats for ${(totalGames || 0) - uniqueGamesWithStats.size} games`));
    console.log(chalk.white(`   Estimated time: ${Math.round(((totalGames || 0) - uniqueGamesWithStats.size) / 20 / 60)} minutes`));
  } else {
    console.log(chalk.green('   ✅ Coverage is already excellent! Only minor gaps to fill.'));
  }
  
  console.log(chalk.gray('\n   To run collection: npx tsx scripts/gpu-stats-collector/master-collector.ts\n'));
}

checkStatsCoverage().catch(console.error);