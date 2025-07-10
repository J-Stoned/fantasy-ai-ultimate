#!/usr/bin/env tsx
/**
 * Comprehensive investigation of the 66 NFL games without stats
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
  gameId: number;
  externalId: string | null;
  date: string;
  score: string;
  issue: string;
  canBeFixed: boolean;
}

async function investigate66NFLGames() {
  console.log(chalk.bold.cyan('\n🔍 INVESTIGATING 66 NFL GAMES WITHOUT STATS\n'));
  
  try {
    // 1. First, get accurate count of NFL games with/without stats
    console.log(chalk.yellow('1. Getting accurate counts...'));
    
    // Get all completed NFL games
    const { data: allNFLGames } = await supabase
      .from('games')
      .select('id, external_id, start_time, home_score, away_score, home_team_id, away_team_id')
      .eq('sport_id', 'nfl')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: false });
    
    if (!allNFLGames) {
      console.error('Failed to fetch NFL games');
      return;
    }
    
    console.log(`Total completed NFL games: ${allNFLGames.length}`);
    
    // Check which games have stats
    const gamesWithStats = new Set<number>();
    const gamesWithoutStats: typeof allNFLGames = [];
    
    console.log('Checking each game for stats...');
    for (let i = 0; i < allNFLGames.length; i++) {
      const game = allNFLGames[i];
      
      // Check player_game_logs
      const { count: logsCount } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      // Check player_stats as well
      const { count: statsCount } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      if ((logsCount && logsCount > 0) || (statsCount && statsCount > 0)) {
        gamesWithStats.add(game.id);
      } else {
        gamesWithoutStats.push(game);
      }
      
      // Progress update
      if ((i + 1) % 100 === 0) {
        console.log(`  Checked ${i + 1}/${allNFLGames.length} games...`);
      }
    }
    
    const actualGamesWithoutStats = gamesWithoutStats.length;
    const coveragePercent = ((gamesWithStats.size / allNFLGames.length) * 100).toFixed(1);
    
    console.log(chalk.bold.green(`\n✅ ACTUAL RESULTS:`));
    console.log(`  Games with stats: ${gamesWithStats.size}`);
    console.log(`  Games without stats: ${actualGamesWithoutStats}`);
    console.log(`  Coverage: ${coveragePercent}%`);
    
    // 2. Analyze games without stats by various criteria
    console.log(chalk.yellow('\n2. Analyzing games without stats...'));
    
    const issues: GameIssue[] = [];
    
    // Group by date ranges
    const dateGroups: { [key: string]: number } = {};
    
    for (const game of gamesWithoutStats) {
      const year = new Date(game.start_time).getFullYear();
      const month = new Date(game.start_time).getMonth() + 1;
      const dateKey = `${year}-${month.toString().padStart(2, '0')}`;
      dateGroups[dateKey] = (dateGroups[dateKey] || 0) + 1;
      
      // Determine the issue
      let issue = '';
      let canBeFixed = false;
      
      if (!game.external_id) {
        issue = 'Missing external_id';
        canBeFixed = false;
      } else if (game.home_score === 0 && game.away_score === 0) {
        issue = 'Scores are 0-0 (might be cancelled/postponed)';
        canBeFixed = false;
      } else if (new Date(game.start_time) > new Date()) {
        issue = 'Future game';
        canBeFixed = false;
      } else {
        issue = 'Has external_id - may be fixable';
        canBeFixed = true;
      }
      
      issues.push({
        gameId: game.id,
        externalId: game.external_id,
        date: game.start_time.split('T')[0],
        score: `${game.home_score}-${game.away_score}`,
        issue,
        canBeFixed
      });
    }
    
    // 3. Show date distribution
    console.log(chalk.yellow('\n3. Date distribution of games without stats:'));
    const sortedDates = Object.entries(dateGroups).sort((a, b) => b[0].localeCompare(a[0]));
    sortedDates.slice(0, 10).forEach(([date, count]) => {
      console.log(`  ${date}: ${count} games`);
    });
    
    // 4. Show issue breakdown
    console.log(chalk.yellow('\n4. Issue breakdown:'));
    const issueGroups: { [key: string]: number } = {};
    issues.forEach(issue => {
      issueGroups[issue.issue] = (issueGroups[issue.issue] || 0) + 1;
    });
    
    Object.entries(issueGroups).forEach(([issue, count]) => {
      console.log(`  ${issue}: ${count} games`);
    });
    
    // 5. Test a few games with external_ids
    console.log(chalk.yellow('\n5. Testing games with external_ids to see if ESPN has data...'));
    
    const fixableGames = issues.filter(g => g.canBeFixed).slice(0, 5);
    
    for (const game of fixableGames) {
      console.log(`\nTesting game ${game.gameId} (${game.date}):`);
      
      if (game.externalId) {
        const espnId = game.externalId.replace(/^(?:espn_)?(?:nfl_)?/, '');
        
        try {
          const response = await axios.get(
            `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary`,
            {
              params: { event: espnId },
              timeout: 10000
            }
          );
          
          const boxscore = response.data.boxscore;
          if (boxscore && boxscore.players) {
            let totalPlayers = 0;
            boxscore.players.forEach((team: any) => {
              team.statistics?.forEach((category: any) => {
                totalPlayers += category.athletes?.length || 0;
              });
            });
            
            if (totalPlayers > 0) {
              console.log(chalk.green(`  ✅ ESPN has data! ${totalPlayers} players found`));
            } else {
              console.log(chalk.red(`  ❌ ESPN has no player data`));
            }
          } else {
            console.log(chalk.red(`  ❌ No boxscore in ESPN response`));
          }
        } catch (error: any) {
          console.log(chalk.red(`  ❌ ESPN API error: ${error.response?.status || error.message}`));
        }
      }
    }
    
    // 6. Calculate potential improvement
    console.log(chalk.bold.yellow('\n📈 IMPROVEMENT POTENTIAL:'));
    
    const fixableCount = issues.filter(g => g.canBeFixed).length;
    const currentCoverage = parseFloat(coveragePercent);
    const potentialCoverage = ((gamesWithStats.size + fixableCount) / allNFLGames.length * 100).toFixed(1);
    
    console.log(`  Current coverage: ${coveragePercent}%`);
    console.log(`  Fixable games: ${fixableCount}`);
    console.log(`  Potential coverage: ${potentialCoverage}%`);
    
    // 7. Industry standards comparison
    console.log(chalk.bold.cyan('\n🏆 INDUSTRY STANDARDS:'));
    console.log(`  95%+ - Gold standard (comprehensive coverage)`);
    console.log(`  90-95% - Very good (acceptable for most applications)`);
    console.log(`  85-90% - Good (some gaps but usable)`);
    console.log(`  Below 85% - Needs improvement`);
    
    if (currentCoverage >= 95) {
      console.log(chalk.bold.green(`\n✅ Current ${coveragePercent}% EXCEEDS gold standard!`));
    } else if (currentCoverage >= 90) {
      console.log(chalk.bold.yellow(`\n🟡 Current ${coveragePercent}% is very good, ${(95 - currentCoverage).toFixed(1)}% away from gold standard`));
    } else {
      console.log(chalk.bold.red(`\n🔴 Current ${coveragePercent}% needs improvement to reach 95% gold standard`));
    }
    
    // 8. Export detailed report
    const reportPath = '/mnt/c/Users/st0ne/Hey Fantasy/fantasy-ai-ultimate/nfl-missing-stats-report.json';
    const report = {
      summary: {
        totalGames: allNFLGames.length,
        gamesWithStats: gamesWithStats.size,
        gamesWithoutStats: actualGamesWithoutStats,
        coverage: coveragePercent,
        fixableGames: fixableCount,
        potentialCoverage
      },
      dateDistribution: dateGroups,
      issueBreakdown: issueGroups,
      detailedIssues: issues.slice(0, 100) // First 100 for review
    };
    
    console.log(chalk.green(`\n📄 Detailed report saved to: ${reportPath}`));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

investigate66NFLGames().catch(console.error);