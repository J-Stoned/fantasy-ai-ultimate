#!/usr/bin/env tsx
/**
 * Comprehensive analysis of remaining NFL coverage gaps
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

interface GameIssue {
  id: number;
  external_id: string;
  date: string;
  score: string;
  issue: string;
  fixable: boolean;
}

async function analyzeRemainingGaps() {
  console.log(chalk.bold.cyan('\n🔍 COMPREHENSIVE NFL COVERAGE GAP ANALYSIS\n'));

  try {
    // 1. Get accurate coverage counts
    console.log(chalk.yellow('1. Current Coverage Analysis:'));
    
    // Get ALL NFL games (not just 2024)
    const { data: allNFLGames } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_score, away_score')
      .eq('sport_id', 'nfl')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .neq('home_score', 0)
      .neq('away_score', 0)
      .lte('start_time', new Date().toISOString());
    
    console.log(`Total completed NFL games: ${allNFLGames?.length || 0}`);
    
    // Check each for stats
    const gamesWithoutStats: typeof allNFLGames = [];
    let gamesWithStats = 0;
    
    for (const game of (allNFLGames || [])) {
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
    
    const totalGames = allNFLGames?.length || 0;
    const coveragePercent = ((gamesWithStats / totalGames) * 100).toFixed(1);
    
    console.log(`Games with stats: ${gamesWithStats}`);
    console.log(`Games without stats: ${gamesWithoutStats.length}`);
    console.log(chalk.bold.yellow(`Current NFL Coverage: ${coveragePercent}%`));
    
    // 2. Industry standards
    console.log(chalk.yellow('\n2. Industry Standards:'));
    console.log('  95%+ = Gold standard (FanDuel, DraftKings)');
    console.log('  90%+ = Professional grade');
    console.log('  85%+ = Acceptable minimum');
    console.log('  <85% = Inadequate for betting/analytics');
    
    if (parseFloat(coveragePercent) < 95) {
      const gapsTo95 = Math.ceil(totalGames * 0.95) - gamesWithStats;
      console.log(chalk.red(`  Need ${gapsTo95} more games for 95% coverage`));
    }
    
    // 3. Analyze the gaps
    console.log(chalk.yellow('\n3. Gap Analysis:'));
    
    const issues: GameIssue[] = [];
    const dateGroups: Record<string, number> = {};
    
    // Test first 10 games without stats
    const samplesToTest = gamesWithoutStats.slice(0, 10);
    
    for (const game of samplesToTest) {
      const year = new Date(game.start_time).getFullYear();
      dateGroups[year] = (dateGroups[year] || 0) + 1;
      
      // Test ESPN API
      const espnId = game.external_id.replace(/^(?:espn_)?(?:nfl_|nba_|mlb_|nhl_)/, '');
      
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary`,
          {
            params: { event: espnId },
            timeout: 5000
          }
        );
        
        if (response.status === 200 && response.data.boxscore?.players) {
          let playerCount = 0;
          response.data.boxscore.players.forEach((team: any) => {
            team.statistics?.forEach((cat: any) => {
              playerCount += cat.athletes?.length || 0;
            });
          });
          
          if (playerCount > 0) {
            issues.push({
              id: game.id,
              external_id: game.external_id,
              date: game.start_time.split('T')[0],
              score: `${game.home_score}-${game.away_score}`,
              issue: 'ESPN has data - collector failed',
              fixable: true
            });
          } else {
            issues.push({
              id: game.id,
              external_id: game.external_id,
              date: game.start_time.split('T')[0],
              score: `${game.home_score}-${game.away_score}`,
              issue: 'ESPN has no player data',
              fixable: false
            });
          }
        } else {
          issues.push({
            id: game.id,
            external_id: game.external_id,
            date: game.start_time.split('T')[0],
            score: `${game.home_score}-${game.away_score}`,
            issue: 'ESPN API no boxscore',
            fixable: false
          });
        }
      } catch (error: any) {
        issues.push({
          id: game.id,
          external_id: game.external_id,
          date: game.start_time.split('T')[0],
          score: `${game.home_score}-${game.away_score}`,
          issue: `ESPN error: ${error.response?.status || error.message}`,
          fixable: error.response?.status !== 404
        });
      }
      
      console.log(`  Tested game ${game.id}...`);
    }
    
    // 4. Summary of findings
    console.log(chalk.yellow('\n4. Issue Summary:'));
    
    const fixableCount = issues.filter(i => i.fixable).length;
    const unfixableCount = issues.filter(i => !i.fixable).length;
    const extrapolatedFixable = Math.round((fixableCount / samplesToTest.length) * gamesWithoutStats.length);
    
    console.log(`Sample tested: ${samplesToTest.length} games`);
    console.log(`Fixable issues: ${fixableCount} (${(fixableCount/samplesToTest.length*100).toFixed(0)}%)`);
    console.log(`Unfixable issues: ${unfixableCount} (${(unfixableCount/samplesToTest.length*100).toFixed(0)}%)`);
    console.log(`Estimated fixable games: ~${extrapolatedFixable} of ${gamesWithoutStats.length}`);
    
    const potentialCoverage = ((gamesWithStats + extrapolatedFixable) / totalGames * 100).toFixed(1);
    console.log(chalk.bold.green(`\nPotential coverage after fixes: ${potentialCoverage}%`));
    
    // 5. Date distribution
    console.log(chalk.yellow('\n5. Games by Year (from full set):'));
    const fullDateGroups: Record<string, number> = {};
    gamesWithoutStats.forEach(game => {
      const year = new Date(game.start_time).getFullYear();
      fullDateGroups[year] = (fullDateGroups[year] || 0) + 1;
    });
    
    Object.entries(fullDateGroups).sort().forEach(([year, count]) => {
      console.log(`  ${year}: ${count} games without stats`);
    });
    
    // 6. Sample issues
    console.log(chalk.yellow('\n6. Sample Issues:'));
    issues.forEach(issue => {
      const status = issue.fixable ? chalk.green('FIXABLE') : chalk.red('UNFIXABLE');
      console.log(`  Game ${issue.id} (${issue.date}): ${issue.issue} - ${status}`);
    });
    
    // 7. Recommendations
    console.log(chalk.bold.cyan('\n🎯 RECOMMENDATIONS:'));
    
    if (parseFloat(potentialCoverage) >= 95) {
      console.log(chalk.green('✅ Can achieve 95%+ coverage by fixing identified issues'));
      console.log('Actions:');
      console.log('  1. Rerun collector on fixable games');
      console.log('  2. Add better error handling for edge cases');
      console.log('  3. Implement retry logic for transient failures');
    } else if (parseFloat(potentialCoverage) >= 90) {
      console.log(chalk.yellow('🟡 Can achieve 90%+ coverage (professional grade)'));
      console.log('Actions:');
      console.log('  1. Fix all fixable issues');
      console.log('  2. Research alternative data sources for older games');
      console.log('  3. Consider 90%+ as acceptable for launch');
    } else {
      console.log(chalk.red('🔴 Need additional data sources to reach professional standards'));
      console.log('Actions:');
      console.log('  1. Investigate alternative APIs');
      console.log('  2. Focus on recent seasons (2022+) for higher coverage');
      console.log('  3. Consider purchasing historical data');
    }
    
    // 8. For statistical analysis platform
    console.log(chalk.bold.magenta('\n📊 FOR STATISTICAL ANALYSIS:'));
    console.log(`Current coverage (${coveragePercent}%) means:`);
    
    if (parseFloat(coveragePercent) >= 90) {
      console.log(chalk.green('  ✅ Sufficient for pattern detection'));
      console.log(chalk.green('  ✅ Adequate for player performance trends'));
      console.log(chalk.green('  ✅ Good for betting analytics'));
    } else if (parseFloat(coveragePercent) >= 85) {
      console.log(chalk.yellow('  🟡 Acceptable for pattern detection'));
      console.log(chalk.yellow('  🟡 May miss some edge cases'));
      console.log(chalk.yellow('  🟡 Should prioritize recent seasons'));
    } else {
      console.log(chalk.red('  ❌ Insufficient for reliable patterns'));
      console.log(chalk.red('  ❌ Risk of biased analysis'));
      console.log(chalk.red('  ❌ Not suitable for betting recommendations'));
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

analyzeRemainingGaps();