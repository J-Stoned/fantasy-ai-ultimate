#!/usr/bin/env tsx
/**
 * Comprehensive NFL database analysis to understand coverage gaps
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function comprehensiveNFLAnalysis() {
  console.log(chalk.bold.cyan('\n📊 COMPREHENSIVE NFL DATABASE ANALYSIS\n'));

  try {
    // 1. Count total NFL games by different criteria
    console.log(chalk.yellow('1. NFL Game Counts:'));
    
    const { count: totalBySportId } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nfl');
    
    const { count: totalBySport } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'nfl');
    
    const { count: completedBySportId } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nfl')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
    
    console.log(`  Total NFL games (sport_id='nfl'): ${totalBySportId}`);
    console.log(`  Total NFL games (sport='nfl'): ${totalBySport}`);
    console.log(`  Completed NFL games: ${completedBySportId}`);

    // 2. Check external_id patterns
    console.log(chalk.yellow('\n2. External ID Analysis:'));
    
    const { data: externalIdSamples } = await supabase
      .from('games')
      .select('external_id')
      .eq('sport_id', 'nfl')
      .not('external_id', 'is', null)
      .limit(10);
    
    console.log('  Sample external_ids:');
    externalIdSamples?.forEach(game => {
      console.log(`    ${game.external_id}`);
    });

    const { count: missingExternalId } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nfl')
      .is('external_id', null);
    
    console.log(`  Games missing external_id: ${missingExternalId}`);

    // 3. Check which games have stats
    console.log(chalk.yellow('\n3. Stats Coverage Analysis:'));
    
    const { data: gamesWithStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', 
        supabase
          .from('games')
          .select('id')
          .eq('sport_id', 'nfl')
      );
    
    const uniqueGamesWithStats = new Set(gamesWithStats?.map(s => s.game_id) || []);
    console.log(`  NFL games with player_stats: ${uniqueGamesWithStats.size}`);

    const { data: gamesWithLogs } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id',
        supabase
          .from('games')
          .select('id')
          .eq('sport_id', 'nfl')
      );
    
    const uniqueGamesWithLogs = new Set(gamesWithLogs?.map(l => l.game_id) || []);
    console.log(`  NFL games with player_game_logs: ${uniqueGamesWithLogs.size}`);

    // 4. Check date ranges
    console.log(chalk.yellow('\n4. Date Range Analysis:'));
    
    const { data: dateRange } = await supabase
      .from('games')
      .select('start_time')
      .eq('sport_id', 'nfl')
      .not('start_time', 'is', null)
      .order('start_time', { ascending: true });
    
    if (dateRange && dateRange.length > 0) {
      const earliest = dateRange[0].start_time;
      const latest = dateRange[dateRange.length - 1].start_time;
      console.log(`  Earliest game: ${earliest}`);
      console.log(`  Latest game: ${latest}`);
    }

    // 5. Check for future games
    const today = new Date().toISOString();
    const { count: futureGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nfl')
      .gt('start_time', today);
    
    console.log(`  Future games (shouldn't be processed): ${futureGames}`);

    // 6. Check for games missing scores
    const { count: incompleteGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nfl')
      .or('home_score.is.null,away_score.is.null');
    
    console.log(`  Games missing scores: ${incompleteGames}`);

    // 7. Calculate ideal processing target
    console.log(chalk.yellow('\n5. Processing Target:'));
    
    const idealTarget = (completedBySportId || 0) - (futureGames || 0) - (incompleteGames || 0) - (missingExternalId || 0);
    const currentCoverage = uniqueGamesWithLogs.size;
    const remaining = idealTarget - currentCoverage;
    
    console.log(`  Ideal target games: ${idealTarget}`);
    console.log(`  Current coverage: ${currentCoverage} (${((currentCoverage/idealTarget)*100).toFixed(1)}%)`);
    console.log(`  Remaining to process: ${remaining}`);

    // 8. Sample some games without stats for analysis
    console.log(chalk.yellow('\n6. Sample Games Without Stats:'));
    
    const { data: unprocessedGames } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_score, away_score')
      .eq('sport_id', 'nfl')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .not('external_id', 'is', null)
      .lte('start_time', today)
      .limit(10);
    
    if (unprocessedGames) {
      // Filter to only games without stats
      const gamesWithoutStats = unprocessedGames.filter(g => !uniqueGamesWithLogs.has(g.id));
      
      console.log('  Sample unprocessed games:');
      gamesWithoutStats.slice(0, 5).forEach(game => {
        console.log(`    ID: ${game.id}, External: ${game.external_id}, Date: ${game.start_time?.split('T')[0]}`);
      });
    }

    // 9. Summary and recommendations
    console.log(chalk.bold.green('\n📈 SUMMARY & RECOMMENDATIONS:'));
    
    const successRate = ((currentCoverage / idealTarget) * 100).toFixed(1);
    console.log(`  Current Success Rate: ${successRate}%`);
    
    if (parseFloat(successRate) < 80) {
      console.log(chalk.red('  🔴 NEEDS IMPROVEMENT'));
      console.log('  Recommendations:');
      console.log('    1. Analyze why remaining games failed');
      console.log('    2. Check ESPN API for failed external_ids');
      console.log('    3. Improve error handling and retry logic');
    } else {
      console.log(chalk.green('  🟢 GOOD COVERAGE'));
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

comprehensiveNFLAnalysis();