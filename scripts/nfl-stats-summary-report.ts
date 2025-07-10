import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function generateNFLStatsSummary() {
  console.log(chalk.bold.blue('\n=============================================================='));
  console.log(chalk.bold.blue('               🏈 NFL STATS COVERAGE REPORT 🏈               '));
  console.log(chalk.bold.blue('==============================================================\n'));

  try {
    // 1. Total NFL Games
    const { count: totalNFLGames, error: countError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nfl')
      .not('home_score', 'is', null);

    console.log(chalk.cyan('📊 DATABASE OVERVIEW:'));
    console.log(`   Total completed NFL games: ${chalk.yellow(totalNFLGames?.toLocaleString() || '0')}`);

    // 2. Get all stats count
    const { count: totalStatsCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });

    console.log(`   Total player_stats records (all sports): ${chalk.yellow(totalStatsCount?.toLocaleString() || '0')}`);

    // 3. Get NFL-specific stats
    // First get sample of NFL game IDs to check
    const { data: sampleNFLGames } = await supabase
      .from('games')
      .select('id')
      .eq('sport_id', 'nfl')
      .not('home_score', 'is', null)
      .limit(500);

    const sampleGameIds = sampleNFLGames?.map(g => g.id) || [];

    // Count stats for these games
    const { data: nflStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', sampleGameIds);

    const uniqueNFLGames = new Set(nflStats?.map(s => s.game_id) || []);
    const sampleCoverage = (uniqueNFLGames.size / sampleGameIds.length) * 100;

    // Extrapolate to estimate total
    const estimatedGamesWithStats = Math.round((sampleCoverage / 100) * (totalNFLGames || 0));
    const estimatedTotalNFLStats = Math.round((nflStats?.length || 0) * ((totalNFLGames || 0) / sampleGameIds.length));

    console.log(`\n📈 NFL STATS COVERAGE (based on ${sampleGameIds.length} game sample):`);
    console.log(`   Estimated games with stats: ${chalk.green(estimatedGamesWithStats.toLocaleString())} / ${totalNFLGames?.toLocaleString()}`);
    console.log(`   Estimated coverage: ${chalk.green(sampleCoverage.toFixed(1) + '%')}`);
    console.log(`   Estimated NFL stats records: ${chalk.green(estimatedTotalNFLStats.toLocaleString())}`);

    // 4. Check recent collector activity
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { count: recentStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo);

    const { count: weekStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneWeekAgo);

    console.log(`\n📅 RECENT COLLECTION ACTIVITY:`);
    console.log(`   Stats added in last 24h: ${chalk.yellow(recentStats?.toLocaleString() || '0')}`);
    console.log(`   Stats added in last 7d: ${chalk.yellow(weekStats?.toLocaleString() || '0')}`);

    // 5. V3 Collector Analysis
    console.log(`\n🔍 V3 COLLECTOR STATUS:`);
    console.log(`   Expected from CLAUDE.md: ${chalk.red('138,905 NFL stats')}`);
    console.log(`   Estimated actual NFL stats: ${chalk.yellow(estimatedTotalNFLStats.toLocaleString())}`);
    
    if (estimatedTotalNFLStats >= 138905) {
      console.log(chalk.green(`   ✅ V3 collector data appears to be present!`));
    } else {
      console.log(chalk.red(`   ❌ V3 collector data appears to be missing`));
      console.log(`   Gap: ${chalk.red((138905 - estimatedTotalNFLStats).toLocaleString() + ' records')}`);
    }

    // 6. Sample some games with high stats count
    console.log(`\n🏟️  SAMPLE GAMES WITH STATS:`);
    const { data: gamesWithHighStats } = await supabase
      .from('player_stats')
      .select('game_id')
      .limit(1000);

    const gameStatCounts = new Map<number, number>();
    gamesWithHighStats?.forEach(s => {
      gameStatCounts.set(s.game_id, (gameStatCounts.get(s.game_id) || 0) + 1);
    });

    const sortedGames = Array.from(gameStatCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [gameId, count] of sortedGames) {
      const { data: gameInfo } = await supabase
        .from('games')
        .select('external_id, sport_id, start_time')
        .eq('id', gameId)
        .single();

      if (gameInfo?.sport_id === 'nfl') {
        console.log(`   Game ${gameId} (${gameInfo.external_id}): ${chalk.green(count + ' stats')}`);
      }
    }

    // 7. Check for data quality issues
    console.log(`\n⚠️  DATA QUALITY CHECK:`);
    
    // Check for games with very few stats
    const { data: lowStatGames } = await supabase
      .from('games')
      .select('id')
      .eq('sport_id', 'nfl')
      .not('home_score', 'is', null)
      .limit(20);

    let incompleteCount = 0;
    for (const game of lowStatGames || []) {
      const { count } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);

      if (count && count > 0 && count < 50) {
        incompleteCount++;
      }
    }

    if (incompleteCount > 0) {
      console.log(`   Found ${chalk.red(incompleteCount)} games with incomplete stats (< 50 records)`);
    } else {
      console.log(chalk.green(`   ✓ No incomplete games detected in sample`));
    }

    // 8. Recommendations
    console.log(chalk.bold.yellow('\n💡 RECOMMENDATIONS:'));
    
    if (estimatedTotalNFLStats < 138905) {
      console.log('   1. The V3 collector data (138,905 records) appears to be missing');
      console.log('   2. Current coverage is only ~' + sampleCoverage.toFixed(1) + '% of NFL games');
      console.log('   3. Consider running the NFL stats collector to fill the gaps');
      console.log(`   4. Missing approximately ${((totalNFLGames || 0) - estimatedGamesWithStats).toLocaleString()} games`);
    } else {
      console.log('   ✅ Good coverage! V3 collector data appears to be loaded.');
      console.log('   Consider spot-checking data quality for accuracy.');
    }

    console.log(chalk.bold.blue('\n==============================================================\n'));

  } catch (error) {
    console.error('Error generating report:', error);
  }

  process.exit(0);
}

generateNFLStatsSummary();