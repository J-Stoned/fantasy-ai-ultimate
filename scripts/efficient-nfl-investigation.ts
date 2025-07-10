#!/usr/bin/env tsx
/**
 * Efficient investigation of NFL games without stats
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function efficientNFLInvestigation() {
  console.log(chalk.bold.cyan('\n🔍 EFFICIENT NFL GAMES INVESTIGATION\n'));
  
  try {
    // 1. Get all completed NFL games
    console.log(chalk.yellow('1. Fetching NFL games...'));
    
    const { data: allNFLGames, count: totalCount } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_score, away_score', { count: 'exact' })
      .eq('sport_id', 'nfl')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
    
    console.log(`Total completed NFL games: ${totalCount}`);
    
    // 2. Get all game IDs that have stats (more efficient query)
    console.log(chalk.yellow('\n2. Finding games with stats...'));
    
    // Get unique game_ids from player_game_logs
    const { data: logsData } = await supabase
      .from('player_game_logs')
      .select('game_id');
    
    const gamesWithLogs = new Set(logsData?.map(d => d.game_id) || []);
    
    // Get unique game_ids from player_stats
    const { data: statsData } = await supabase
      .from('player_stats')
      .select('game_id');
    
    const gamesWithStats = new Set(statsData?.map(d => d.game_id) || []);
    
    // Combine both sets
    const allGamesWithStats = new Set([...gamesWithLogs, ...gamesWithStats]);
    
    // Filter NFL games to find which ones have stats
    const nflGamesWithStats = allNFLGames?.filter(g => allGamesWithStats.has(g.id)) || [];
    const nflGamesWithoutStats = allNFLGames?.filter(g => !allGamesWithStats.has(g.id)) || [];
    
    const coverage = ((nflGamesWithStats.length / (totalCount || 1)) * 100).toFixed(1);
    
    console.log(chalk.bold.green('\n✅ COVERAGE RESULTS:'));
    console.log(`  Games with stats: ${nflGamesWithStats.length}`);
    console.log(`  Games without stats: ${nflGamesWithoutStats.length}`);
    console.log(`  Coverage: ${coverage}%`);
    
    // 3. Analyze games without stats
    console.log(chalk.yellow('\n3. Analyzing games without stats...'));
    
    // Group by issues
    const missingExternalId = nflGamesWithoutStats.filter(g => !g.external_id);
    const zeroScores = nflGamesWithoutStats.filter(g => g.home_score === 0 && g.away_score === 0);
    const futureGames = nflGamesWithoutStats.filter(g => new Date(g.start_time) > new Date());
    const hasExternalId = nflGamesWithoutStats.filter(g => 
      g.external_id && 
      g.home_score !== 0 && 
      new Date(g.start_time) <= new Date()
    );
    
    console.log(chalk.yellow('\nIssue breakdown:'));
    console.log(`  Missing external_id: ${missingExternalId.length}`);
    console.log(`  Zero scores (0-0): ${zeroScores.length}`);
    console.log(`  Future games: ${futureGames.length}`);
    console.log(`  Has external_id (fixable): ${hasExternalId.length}`);
    
    // 4. Date analysis
    console.log(chalk.yellow('\n4. Date analysis of games without stats:'));
    
    const dateGroups: { [key: string]: number } = {};
    nflGamesWithoutStats.forEach(game => {
      const date = game.start_time.substring(0, 7); // YYYY-MM
      dateGroups[date] = (dateGroups[date] || 0) + 1;
    });
    
    const sortedDates = Object.entries(dateGroups).sort((a, b) => b[0].localeCompare(a[0]));
    console.log('  Recent months:');
    sortedDates.slice(0, 10).forEach(([date, count]) => {
      console.log(`    ${date}: ${count} games`);
    });
    
    // 5. Test sample games with external IDs
    console.log(chalk.yellow('\n5. Testing sample games with ESPN API...'));
    
    const samplesToTest = hasExternalId.slice(0, 3);
    let successfulTests = 0;
    
    for (const game of samplesToTest) {
      const espnId = game.external_id?.replace(/^(?:espn_)?(?:nfl_)?/, '');
      console.log(`\n  Testing game ${game.id} (${game.start_time.split('T')[0]}):`);
      console.log(`    ESPN ID: ${espnId}`);
      
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary`,
          {
            params: { event: espnId },
            timeout: 10000
          }
        );
        
        const hasBoxscore = !!response.data.boxscore;
        const hasPlayers = response.data.boxscore?.players?.length > 0;
        const hasBetting = !!response.data.pickcenter;
        
        console.log(`    ✅ ESPN Response: ${response.status}`);
        console.log(`    Boxscore: ${hasBoxscore ? '✅' : '❌'}`);
        console.log(`    Players: ${hasPlayers ? '✅' : '❌'}`);
        console.log(`    Betting data: ${hasBetting ? '✅' : '❌'}`);
        
        if (hasBoxscore && hasPlayers) {
          successfulTests++;
        }
        
      } catch (error: any) {
        console.log(`    ❌ Error: ${error.response?.status || error.message}`);
      }
    }
    
    // 6. Calculate improvement potential
    console.log(chalk.bold.yellow('\n📈 IMPROVEMENT ANALYSIS:'));
    
    const currentCoverage = parseFloat(coverage);
    const potentialFixable = hasExternalId.length;
    const potentialCoverage = ((nflGamesWithStats.length + potentialFixable) / (totalCount || 1) * 100).toFixed(1);
    
    console.log(`  Current coverage: ${coverage}%`);
    console.log(`  Potentially fixable: ${potentialFixable} games`);
    console.log(`  Potential coverage: ${potentialCoverage}%`);
    console.log(`  Games needed for 95%: ${Math.ceil((totalCount || 0) * 0.95) - nflGamesWithStats.length}`);
    console.log(`  Games needed for 99%: ${Math.ceil((totalCount || 0) * 0.99) - nflGamesWithStats.length}`);
    
    // 7. Industry comparison
    console.log(chalk.bold.cyan('\n🏆 COVERAGE STANDARDS:'));
    console.log(`  99%+ - Exceptional (ESPN, official sources)`);
    console.log(`  95-99% - Gold standard (professional analytics)`);
    console.log(`  90-95% - Very good (most commercial platforms)`);
    console.log(`  85-90% - Acceptable (startup phase)`);
    console.log(`  Below 85% - Needs improvement`);
    
    if (currentCoverage >= 95) {
      console.log(chalk.bold.green(`\n🎉 Your ${coverage}% coverage MEETS the gold standard!`));
    } else if (currentCoverage >= 90) {
      console.log(chalk.bold.yellow(`\n✅ Your ${coverage}% coverage is VERY GOOD!`));
      console.log(`Only ${(95 - currentCoverage).toFixed(1)}% away from gold standard.`);
    } else if (currentCoverage >= 85) {
      console.log(chalk.bold.yellow(`\n🟡 Your ${coverage}% coverage is acceptable but could be improved.`));
    } else {
      console.log(chalk.bold.red(`\n🔴 Your ${coverage}% coverage needs improvement.`));
    }
    
    // 8. ESPN Betting Data
    console.log(chalk.bold.cyan('\n💰 ESPN BETTING DATA:'));
    console.log(`ESPN API provides betting data in the "pickcenter" and "odds" sections.`);
    console.log(`This includes: spreads, over/under totals, moneylines, and consensus picks.`);
    console.log(chalk.yellow(`\n⚠️  Currently NOT storing betting data in your database.`));
    console.log(`Consider adding betting_lines table population to your collectors.`);
    
    // 9. Recommendations
    console.log(chalk.bold.green('\n📋 RECOMMENDATIONS:'));
    
    if (potentialFixable > 0 && currentCoverage < 95) {
      console.log(`1. Process the ${potentialFixable} games with external_ids to improve coverage`);
    }
    if (currentCoverage >= 93) {
      console.log(`2. Your 93%+ coverage is already very good for a production system`);
    }
    console.log(`3. Add betting data collection to maximize value from ESPN API`);
    console.log(`4. Focus on recent games (last 2 seasons) for highest value`);
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

efficientNFLInvestigation().catch(console.error);