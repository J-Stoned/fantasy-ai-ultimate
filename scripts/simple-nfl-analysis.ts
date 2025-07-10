#!/usr/bin/env tsx
/**
 * Simple NFL analysis to understand the gaps
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function simpleNFLAnalysis() {
  console.log(chalk.bold.cyan('\n📊 SIMPLE NFL ANALYSIS\n'));

  try {
    // 1. Basic counts
    const { count: totalNFL } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nfl');
    
    const { count: completedNFL } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nfl')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
    
    console.log(`Total NFL games: ${totalNFL}`);
    console.log(`Completed NFL games: ${completedNFL}`);

    // 2. Check stats coverage
    const { data: statsGameIds } = await supabase
      .from('player_stats')
      .select('game_id');
    
    const { data: allNFLGameIds } = await supabase
      .from('games')
      .select('id')
      .eq('sport_id', 'nfl');
    
    const nflGameIds = new Set(allNFLGameIds?.map(g => g.id) || []);
    const statsNFLGameIds = new Set(
      statsGameIds?.filter(s => nflGameIds.has(s.game_id)).map(s => s.game_id) || []
    );
    
    console.log(`NFL games with player_stats: ${statsNFLGameIds.size}`);

    // 3. Check game logs coverage
    const { data: logsGameIds } = await supabase
      .from('player_game_logs')
      .select('game_id');
    
    const logsNFLGameIds = new Set(
      logsGameIds?.filter(l => nflGameIds.has(l.game_id)).map(l => l.game_id) || []
    );
    
    console.log(`NFL games with player_game_logs: ${logsNFLGameIds.size}`);

    // 4. Calculate gaps
    const totalProcessable = completedNFL || 0;
    const actuallyProcessed = Math.max(statsNFLGameIds.size, logsNFLGameIds.size);
    const gapCount = totalProcessable - actuallyProcessed;
    const coveragePercent = ((actuallyProcessed / totalProcessable) * 100).toFixed(1);
    
    console.log(chalk.yellow(`\n📈 COVERAGE ANALYSIS:`));
    console.log(`  Processable games: ${totalProcessable}`);
    console.log(`  Actually processed: ${actuallyProcessed}`);
    console.log(`  Gap: ${gapCount} games`);
    console.log(`  Coverage: ${coveragePercent}%`);

    // 5. Why is coverage so low?
    if (parseFloat(coveragePercent) < 95) {
      console.log(chalk.red(`\n🔴 COVERAGE TOO LOW! Should be 95%+`));
      
      // Check for recent vs old games
      const { data: recentGames } = await supabase
        .from('games')
        .select('id, start_time')
        .eq('sport_id', 'nfl')
        .not('home_score', 'is', null)
        .gte('start_time', '2024-01-01')
        .order('start_time', { ascending: false });
      
      const recentGameIds = new Set(recentGames?.map(g => g.id) || []);
      const recentWithStats = Array.from(recentGameIds).filter(id => logsNFLGameIds.has(id));
      
      console.log(`  Recent games (2024+): ${recentGameIds.size}`);
      console.log(`  Recent with stats: ${recentWithStats.length}`);
      console.log(`  Recent coverage: ${((recentWithStats.length / recentGameIds.size) * 100).toFixed(1)}%`);

      // Sample unprocessed games
      const unprocessedIds = Array.from(recentGameIds).filter(id => !logsNFLGameIds.has(id));
      console.log(`\n  Sample unprocessed game IDs: ${unprocessedIds.slice(0, 10).join(', ')}`);
    }

    // 6. Recommendations
    console.log(chalk.bold.cyan(`\n🎯 TARGET: 95%+ COVERAGE`));
    console.log(`  Current: ${coveragePercent}%`);
    console.log(`  Need to process: ${gapCount} more games`);
    
    if (gapCount > 0) {
      console.log(chalk.yellow(`\n📋 ACTION PLAN:`));
      console.log(`  1. Identify why ${gapCount} games failed`);
      console.log(`  2. Fix root causes (API, parsing, etc.)`);
      console.log(`  3. Re-run collector on failed games only`);
      console.log(`  4. Achieve 95%+ coverage before moving to other sports`);
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

simpleNFLAnalysis();