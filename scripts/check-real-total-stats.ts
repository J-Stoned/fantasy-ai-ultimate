#!/usr/bin/env tsx
/**
 * 📊 CHECK REAL TOTAL STATS
 * Get the actual total stats count after all fixes
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRealTotalStats() {
  console.log(chalk.bold.blue('📊 CHECKING REAL TOTAL STATS COUNT\n'));
  
  // 1. Get total stats
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.bold.green(`TOTAL STATS IN DATABASE: ${totalStats?.toLocaleString()}`));
  
  // 2. Count stats by sport (using game relationships)
  console.log(chalk.yellow('\n📊 COUNTING STATS BY SPORT:\n'));
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB'];
  let totalVerified = 0;
  
  for (const sport of sports) {
    // Get games for this sport
    const { data: games } = await supabase
      .from('games')
      .select('id')
      .eq('sport', sport)
      .limit(1000); // Get first 1000 games
    
    if (games && games.length > 0) {
      // Count stats for these games
      const { count: statsCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .in('game_id', games.map(g => g.id));
      
      console.log(`${sport}: ${statsCount?.toLocaleString()} stats (sample of ${games.length} games)`);
      
      // Estimate total if we only got a sample
      if (games.length === 1000) {
        const { count: totalGames } = await supabase
          .from('games')
          .select('*', { count: 'exact', head: true })
          .eq('sport', sport);
        
        const estimatedTotal = Math.round((statsCount || 0) * (totalGames || 0) / 1000);
        console.log(`  → Estimated total: ~${estimatedTotal.toLocaleString()} stats`);
        totalVerified += estimatedTotal;
      } else {
        totalVerified += statsCount || 0;
      }
    }
  }
  
  console.log(chalk.gray('-'.repeat(40)));
  console.log(`ESTIMATED TOTAL: ${totalVerified.toLocaleString()} stats`);
  
  // 3. Sample some recent stats
  console.log(chalk.yellow('\n📋 RECENT STATS SAMPLE:\n'));
  
  const { data: recentStats } = await supabase
    .from('player_game_logs')
    .select('created_at, game_id')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (recentStats && recentStats.length > 0) {
    console.log(`Most recent stat created: ${recentStats[0].created_at}`);
    
    // Get the sports for these stats
    const gameIds = [...new Set(recentStats.map(s => s.game_id))];
    const { data: games } = await supabase
      .from('games')
      .select('id, sport')
      .in('id', gameIds);
    
    const sportCounts: Record<string, number> = {};
    games?.forEach(game => {
      sportCounts[game.sport] = (sportCounts[game.sport] || 0) + 1;
    });
    
    console.log('Recent stats by sport:', sportCounts);
  }
  
  // 4. Check the discrepancy
  console.log(chalk.bold.red('\n⚠️  STATS COUNT ANALYSIS:\n'));
  
  if (totalStats && totalStats > 600000) {
    console.log(chalk.green(`✅ We DO have ${totalStats.toLocaleString()} stats!`));
    console.log(chalk.yellow('The 519,536 number was from an earlier check.'));
    console.log(chalk.yellow('Stats have been added since then!'));
  } else if (totalStats) {
    console.log(chalk.yellow(`Current count: ${totalStats.toLocaleString()}`));
    console.log(chalk.yellow('This is less than the 670K+ we expected.'));
    console.log(chalk.yellow('Some stats may have been deleted or not inserted.'));
  }
  
  // 5. Get exact counts for each sport
  console.log(chalk.bold.yellow('\n📊 EXACT STATS COUNT BY SPORT (this will take a moment):\n'));
  
  for (const sport of sports) {
    const { count: gamesCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
    
    // Get all game IDs for this sport in batches
    let allGameIds: number[] = [];
    const batchSize = 1000;
    
    for (let offset = 0; offset < (gamesCount || 0); offset += batchSize) {
      const { data: gameBatch } = await supabase
        .from('games')
        .select('id')
        .eq('sport', sport)
        .range(offset, offset + batchSize - 1);
      
      if (gameBatch) {
        allGameIds = allGameIds.concat(gameBatch.map(g => g.id));
      }
    }
    
    // Count stats for all games
    if (allGameIds.length > 0) {
      let totalSportStats = 0;
      
      // Process in chunks to avoid query limits
      for (let i = 0; i < allGameIds.length; i += 500) {
        const chunk = allGameIds.slice(i, i + 500);
        const { count } = await supabase
          .from('player_game_logs')
          .select('*', { count: 'exact', head: true })
          .in('game_id', chunk);
        
        totalSportStats += count || 0;
      }
      
      const avgPerGame = gamesCount ? (totalSportStats / gamesCount).toFixed(1) : '0';
      console.log(`${sport}: ${totalSportStats.toLocaleString()} stats (${gamesCount} games, avg ${avgPerGame} per game)`);
    }
  }
}

checkRealTotalStats().catch(console.error);