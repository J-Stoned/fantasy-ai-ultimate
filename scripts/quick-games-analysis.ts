#!/usr/bin/env tsx
/**
 * ⚡ QUICK GAMES ANALYSIS
 * 
 * Fast analysis of games table corruption using batch queries
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function quickGamesAnalysis() {
  console.log(chalk.cyan.bold('\n⚡ QUICK GAMES ANALYSIS\n'));
  
  try {
    // 1. Basic game counts
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.white(`📊 Total games: ${totalGames || 0}`));
    
    // 2. Games by sport
    const { data: sportCounts } = await supabase
      .from('games')
      .select('sport')
      .not('sport', 'is', null);
    
    const sportBreakdown = sportCounts?.reduce((acc: any, game) => {
      acc[game.sport] = (acc[game.sport] || 0) + 1;
      return acc;
    }, {}) || {};
    
    console.log(chalk.yellow('\n🏈 GAMES BY SPORT:'));
    Object.entries(sportBreakdown).forEach(([sport, count]) => {
      console.log(chalk.white(`   ${sport}: ${count}`));
    });
    
    // 3. Games with null team references
    const { count: nullHomeTeams } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .is('home_team_id', null);
    
    const { count: nullAwayTeams } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .is('away_team_id', null);
    
    console.log(chalk.red(`\n❌ BROKEN REFERENCES:`));
    console.log(chalk.red(`   Games with null home_team_id: ${nullHomeTeams || 0}`));
    console.log(chalk.red(`   Games with null away_team_id: ${nullAwayTeams || 0}`));
    
    // 4. Games with missing scores
    const { count: missingScores } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .or('home_score.is.null,away_score.is.null');
    
    console.log(chalk.yellow(`\n⚠️  Games with missing scores: ${missingScores || 0}`));
    
    // 5. Player stats analysis
    const { count: totalStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    const { count: statsWithGames } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .not('game_id', 'is', null);
    
    const orphanedStats = (totalStats || 0) - (statsWithGames || 0);
    
    console.log(chalk.blue(`\n📊 PLAYER STATS:`));
    console.log(chalk.white(`   Total stats: ${totalStats || 0}`));
    console.log(chalk.green(`   Stats with games: ${statsWithGames || 0}`));
    console.log(chalk.red(`   Orphaned stats: ${orphanedStats}`));
    
    // 6. Player game logs analysis
    const { count: totalLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    const { count: logsWithGames } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('game_id', 'is', null);
    
    const orphanedLogs = (totalLogs || 0) - (logsWithGames || 0);
    
    console.log(chalk.blue(`\n📊 PLAYER GAME LOGS:`));
    console.log(chalk.white(`   Total logs: ${totalLogs || 0}`));
    console.log(chalk.green(`   Logs with games: ${logsWithGames || 0}`));
    console.log(chalk.red(`   Orphaned logs: ${orphanedLogs}`));
    
    // 7. Check for games referencing non-existent teams
    console.log(chalk.yellow(`\n🔍 Checking for orphaned games (this may take a moment)...`));
    
    const { data: gamesWithTeams } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id')
      .not('home_team_id', 'is', null)
      .not('away_team_id', 'is', null)
      .limit(100); // Sample first 100 games
    
    let orphanedGamesCount = 0;
    
    if (gamesWithTeams) {
      for (const game of gamesWithTeams) {
        const { data: homeTeam } = await supabase
          .from('teams')
          .select('id')
          .eq('id', game.home_team_id)
          .single();
        
        const { data: awayTeam } = await supabase
          .from('teams')
          .select('id')
          .eq('id', game.away_team_id)
          .single();
        
        if (!homeTeam || !awayTeam) {
          orphanedGamesCount++;
        }
      }
    }
    
    console.log(chalk.red(`   Orphaned games (sample): ${orphanedGamesCount} out of 100 checked`));
    
    // 8. Summary
    console.log(chalk.yellow('\n📋 CLEANUP SUMMARY:'));
    console.log(chalk.gray('═'.repeat(50)));
    
    const totalIssues = (nullHomeTeams || 0) + (nullAwayTeams || 0) + orphanedStats + orphanedLogs;
    
    console.log(chalk.red(`🗑️  Total issues found: ${totalIssues}`));
    console.log(chalk.red(`   • Null team references: ${(nullHomeTeams || 0) + (nullAwayTeams || 0)}`));
    console.log(chalk.red(`   • Orphaned stats: ${orphanedStats}`));
    console.log(chalk.red(`   • Orphaned logs: ${orphanedLogs}`));
    console.log(chalk.red(`   • Games with missing scores: ${missingScores || 0}`));
    
    if (totalIssues > 0) {
      console.log(chalk.yellow('\n💡 RECOMMENDATIONS:'));
      console.log(chalk.white('   • Run nuclear games cleanup to remove broken games'));
      console.log(chalk.white('   • Run nuclear stats cleanup to remove orphaned data'));
      console.log(chalk.white('   • Focus on collecting fresh, clean data for 2023-2025'));
    } else {
      console.log(chalk.green('\n✅ Database appears clean!'));
    }
    
    console.log(chalk.green('\n✅ Quick games analysis complete!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error analyzing games:'), error);
  }
}

quickGamesAnalysis().catch(console.error);