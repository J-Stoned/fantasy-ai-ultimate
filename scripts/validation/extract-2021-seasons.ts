#!/usr/bin/env tsx
/**
 * 🏆 2021 SEASON EXTRACTOR
 * 
 * Extracts complete 2021 seasons for each sport:
 * - NFL 2021: Sep 9, 2021 - Feb 13, 2022 (Super Bowl LVI)
 * - NBA 2021-22: Oct 19, 2021 - Jun 16, 2022 (Finals)
 * - NHL 2021-22: Oct 12, 2021 - Jun 26, 2022 (Stanley Cup)
 * - MLB 2021: Apr 1, 2021 - Nov 2, 2021 (World Series)
 */

import { queryMany, queryOne } from '../utils/local-db-pool.js';
import chalk from 'chalk';

// Season definitions with proper date ranges
const SEASONS_2021 = {
  NFL: {
    name: 'NFL 2021',
    start: '2021-09-09',
    end: '2022-02-14',  // Day after Super Bowl LVI
    sport: 'NFL'
  },
  NBA: {
    name: 'NBA 2021-22',
    start: '2021-10-19',
    end: '2022-06-17',  // Day after Finals Game 6
    sport: 'NBA'
  },
  NHL: {
    name: 'NHL 2021-22', 
    start: '2021-10-12',
    end: '2022-06-27',  // Day after Stanley Cup Game 6
    sport: 'NHL'
  },
  MLB: {
    name: 'MLB 2021',
    start: '2021-04-01',
    end: '2021-11-03',  // Day after World Series Game 6
    sport: 'MLB'
  },
  MILB: {
    name: 'MiLB 2021',
    start: '2021-05-04',  // MiLB started late in 2021
    end: '2021-09-30',
    sport: 'MILB'
  }
};

async function extract2021Seasons() {
  console.log(chalk.cyan('🏆 EXTRACTING 2021 SEASONS DATA\n'));
  
  const seasonStats = {};
  
  for (const [key, season] of Object.entries(SEASONS_2021)) {
    console.log(chalk.yellow(`\n📊 ${season.name}:`));
    console.log(chalk.gray(`Date range: ${season.start} to ${season.end}`));
    
    try {
      // Count games in season
      const gamesQuery = `
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN home_score > away_score THEN 1 END) as home_wins,
               COUNT(CASE WHEN away_score > home_score THEN 1 END) as away_wins,
               AVG(home_score) as avg_home_score,
               AVG(away_score) as avg_away_score
        FROM games
        WHERE sport = $1
          AND start_time >= $2
          AND start_time < $3
          AND status IN ('Final', 'STATUS_FINAL', 'completed')
      `;
      
      const gameStats = await queryOne(gamesQuery, [season.sport, season.start, season.end]);
      
      // Count games with betting lines
      const bettingQuery = `
        SELECT COUNT(DISTINCT g.id) as games_with_lines,
               AVG(bl.over_under) as avg_total,
               AVG(ABS(bl.home_line)) as avg_spread
        FROM games g
        JOIN betting_lines bl ON bl.game_id = g.id
        WHERE g.sport = $1
          AND g.start_time >= $2
          AND g.start_time < $3
          AND g.status IN ('Final', 'STATUS_FINAL', 'completed')
      `;
      
      const bettingStats = await queryOne(bettingQuery, [season.sport, season.start, season.end]);
      
      // Count player stats
      const statsQuery = `
        SELECT COUNT(*) as total_stats,
               COUNT(DISTINCT pgl.player_id) as unique_players
        FROM player_game_logs pgl
        JOIN games g ON pgl.game_id = g.id
        WHERE g.sport = $1
          AND g.start_time >= $2
          AND g.start_time < $3
      `;
      
      const playerStats = await queryOne(statsQuery, [season.sport, season.start, season.end]);
      
      const stats = {
        games: parseInt(gameStats.total),
        homeWins: parseInt(gameStats.home_wins),
        awayWins: parseInt(gameStats.away_wins),
        homeWinPct: ((parseInt(gameStats.home_wins) / parseInt(gameStats.total)) * 100).toFixed(1),
        avgHomeScore: parseFloat(gameStats.avg_home_score).toFixed(1),
        avgAwayScore: parseFloat(gameStats.avg_away_score).toFixed(1),
        gamesWithLines: parseInt(bettingStats.games_with_lines),
        avgTotal: parseFloat(bettingStats.avg_total).toFixed(1),
        avgSpread: parseFloat(bettingStats.avg_spread).toFixed(1),
        totalStats: parseInt(playerStats.total_stats),
        uniquePlayers: parseInt(playerStats.unique_players)
      };
      
      seasonStats[key] = stats;
      
      console.log(chalk.green(`✅ Games: ${stats.games}`));
      console.log(chalk.gray(`   Home Win %: ${stats.homeWinPct}%`));
      console.log(chalk.gray(`   Avg Score: ${stats.avgHomeScore} - ${stats.avgAwayScore}`));
      console.log(chalk.green(`✅ Betting Lines: ${stats.gamesWithLines} games`));
      console.log(chalk.gray(`   Avg Total: ${stats.avgTotal}`));
      console.log(chalk.gray(`   Avg Spread: ${stats.avgSpread}`));
      console.log(chalk.green(`✅ Player Stats: ${stats.totalStats.toLocaleString()}`));
      console.log(chalk.gray(`   Unique Players: ${stats.uniquePlayers.toLocaleString()}`));
      
    } catch (error) {
      console.error(chalk.red(`❌ Error processing ${season.name}:`), error.message);
    }
  }
  
  // Summary
  console.log(chalk.cyan('\n📊 2021 SEASONS SUMMARY:'));
  console.log(chalk.cyan('========================'));
  
  let totalGames = 0;
  let totalStats = 0;
  
  for (const [sport, stats] of Object.entries(seasonStats)) {
    totalGames += stats.games;
    totalStats += stats.totalStats;
    console.log(chalk.yellow(`${sport}: ${stats.games} games, ${stats.totalStats.toLocaleString()} stats`));
  }
  
  console.log(chalk.cyan('------------------------'));
  console.log(chalk.green(`TOTAL: ${totalGames.toLocaleString()} games, ${totalStats.toLocaleString()} stats`));
  
  // Save season data for pattern validation
  console.log(chalk.cyan('\n💾 Saving season metadata...'));
  
  const fs = await import('fs/promises');
  await fs.writeFile(
    'scripts/validation/2021-seasons-metadata.json',
    JSON.stringify({
      seasons: SEASONS_2021,
      stats: seasonStats,
      extractedAt: new Date().toISOString()
    }, null, 2)
  );
  
  console.log(chalk.green('✅ Season data saved to 2021-seasons-metadata.json'));
  console.log(chalk.yellow('\n🎯 Ready for pattern validation!'));
}

// Run extraction
extract2021Seasons()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });