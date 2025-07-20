#!/usr/bin/env tsx
/**
 * 🏆 2021 SEASON EXTRACTOR (FIXED)
 * 
 * Extracts ACTUAL 2021 seasons based on what's in our database:
 * - NFL 2021: Sep 2021 - Feb 2022 (includes playoffs)
 * - NBA 2021-22: Oct 2021 - Jun 2022 (need to look in 2022!)
 * - NHL 2021-22: Oct 2021 - Jun 2022 (need to look in 2022!)
 * - MLB 2021: Apr 2021 - Nov 2021 ✅
 * - NCAA sports: Various 2021-22 seasons
 */

import { queryMany, queryOne } from '../utils/local-db-pool.js';
import chalk from 'chalk';

// CORRECTED Season definitions based on actual data
const SEASONS_2021 = {
  NFL: {
    name: 'NFL 2021',
    // NFL 2021 regular season + playoffs
    queries: [
      { start: '2021-09-01', end: '2021-12-31', label: 'Regular Season' },
      { start: '2022-01-01', end: '2022-02-15', label: 'Playoffs' }
    ],
    sport: 'NFL'
  },
  NBA: {
    name: 'NBA 2021-22',
    // Full NBA season Oct 2021 - June 2022
    queries: [
      { start: '2021-10-01', end: '2021-12-31', label: '2021 games' },
      { start: '2022-01-01', end: '2022-06-30', label: '2022 games' }
    ],
    sport: 'NBA'
  },
  NHL: {
    name: 'NHL 2021-22',
    // Full NHL season Oct 2021 - June 2022
    queries: [
      { start: '2021-10-01', end: '2021-12-31', label: '2021 games' },
      { start: '2022-01-01', end: '2022-06-30', label: '2022 games' }
    ],
    sport: 'NHL'
  },
  MLB: {
    name: 'MLB 2021',
    queries: [
      { start: '2021-04-01', end: '2021-11-30', label: 'Full Season' }
    ],
    sport: 'MLB'
  },
  NCAA_FB: {
    name: 'NCAA Football 2021',
    queries: [
      { start: '2021-08-01', end: '2021-12-31', label: 'Regular Season' },
      { start: '2022-01-01', end: '2022-01-15', label: 'Bowl Games' }
    ],
    sport: 'NCAA_FB'
  },
  NCAA_BB: {
    name: 'NCAA Basketball 2021-22',
    queries: [
      { start: '2021-11-01', end: '2021-12-31', label: '2021 games' },
      { start: '2022-01-01', end: '2022-04-15', label: '2022 games' }
    ],
    sport: 'NCAA_BB'
  }
};

async function extractFixed2021Seasons() {
  console.log(chalk.cyan('🏆 EXTRACTING 2021 SEASONS DATA (FIXED VERSION)\n'));
  
  const seasonStats = {};
  let grandTotalGames = 0;
  let grandTotalStats = 0;
  let grandTotalBetting = 0;
  
  for (const [key, season] of Object.entries(SEASONS_2021)) {
    console.log(chalk.yellow(`\n📊 ${season.name}:`));
    
    let totalGames = 0;
    let totalStats = 0;
    let totalBetting = 0;
    let totalHomeWins = 0;
    let totalAwayWins = 0;
    let totalHomeScore = 0;
    let totalAwayScore = 0;
    
    try {
      // Query each date range
      for (const query of season.queries) {
        console.log(chalk.gray(`  ${query.label}: ${query.start} to ${query.end}`));
        
        // Count games
        const gamesResult = await queryOne(`
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN home_score > away_score THEN 1 END) as home_wins,
            COUNT(CASE WHEN away_score > home_score THEN 1 END) as away_wins,
            SUM(home_score) as total_home_score,
            SUM(away_score) as total_away_score
          FROM games
          WHERE sport = $1
            AND start_time >= $2
            AND start_time < $3
            AND status = 'Final'
        `, [season.sport, query.start, query.end]);
        
        const games = parseInt(gamesResult.total) || 0;
        totalGames += games;
        totalHomeWins += parseInt(gamesResult.home_wins) || 0;
        totalAwayWins += parseInt(gamesResult.away_wins) || 0;
        totalHomeScore += parseFloat(gamesResult.total_home_score) || 0;
        totalAwayScore += parseFloat(gamesResult.total_away_score) || 0;
        
        console.log(chalk.gray(`    Games: ${games}`));
        
        // Count betting lines
        const bettingResult = await queryOne(`
          SELECT COUNT(DISTINCT g.id) as games_with_lines
          FROM games g
          JOIN betting_lines bl ON bl.game_id = g.id
          WHERE g.sport = $1
            AND g.start_time >= $2
            AND g.start_time < $3
        `, [season.sport, query.start, query.end]);
        
        totalBetting += parseInt(bettingResult.games_with_lines) || 0;
        
        // Count player stats
        const statsResult = await queryOne(`
          SELECT COUNT(*) as total_stats
          FROM player_game_logs pgl
          JOIN games g ON pgl.game_id = g.id
          WHERE g.sport = $1
            AND g.start_time >= $2
            AND g.start_time < $3
        `, [season.sport, query.start, query.end]);
        
        totalStats += parseInt(statsResult.total_stats) || 0;
      }
      
      // Calculate season totals
      const homeWinPct = totalGames > 0 ? ((totalHomeWins / totalGames) * 100).toFixed(1) : '0.0';
      const avgHomeScore = totalGames > 0 ? (totalHomeScore / totalGames).toFixed(1) : '0.0';
      const avgAwayScore = totalGames > 0 ? (totalAwayScore / totalGames).toFixed(1) : '0.0';
      const bettingPct = totalGames > 0 ? ((totalBetting / totalGames) * 100).toFixed(1) : '0.0';
      
      seasonStats[key] = {
        games: totalGames,
        homeWins: totalHomeWins,
        awayWins: totalAwayWins,
        homeWinPct,
        avgHomeScore,
        avgAwayScore,
        gamesWithLines: totalBetting,
        bettingPct,
        totalStats
      };
      
      // Display results
      console.log(chalk.green(`✅ Total Games: ${totalGames}`));
      console.log(chalk.gray(`   Home Win %: ${homeWinPct}%`));
      console.log(chalk.gray(`   Avg Score: ${avgHomeScore} - ${avgAwayScore}`));
      console.log(chalk.green(`✅ Betting Lines: ${totalBetting} games (${bettingPct}%)`));
      console.log(chalk.green(`✅ Player Stats: ${totalStats.toLocaleString()}`));
      
      grandTotalGames += totalGames;
      grandTotalStats += totalStats;
      grandTotalBetting += totalBetting;
      
    } catch (error) {
      console.error(chalk.red(`❌ Error processing ${season.name}:`), error.message);
    }
  }
  
  // Summary
  console.log(chalk.cyan('\n📊 2021 SEASONS SUMMARY (CORRECTED):'));
  console.log(chalk.cyan('====================================='));
  
  for (const [sport, stats] of Object.entries(seasonStats)) {
    console.log(chalk.yellow(`${sport}: ${stats.games} games, ${stats.totalStats.toLocaleString()} stats, ${stats.gamesWithLines} w/ betting`));
  }
  
  console.log(chalk.cyan('-------------------------------------'));
  console.log(chalk.green(`TOTAL: ${grandTotalGames.toLocaleString()} games, ${grandTotalStats.toLocaleString()} stats`));
  console.log(chalk.green(`Betting Coverage: ${grandTotalBetting.toLocaleString()} games (${((grandTotalBetting/grandTotalGames)*100).toFixed(1)}%)`));
  
  // Save corrected season data
  console.log(chalk.cyan('\n💾 Saving corrected season metadata...'));
  
  const fs = await import('fs/promises');
  await fs.writeFile(
    'scripts/validation/2021-seasons-metadata-fixed.json',
    JSON.stringify({
      seasons: SEASONS_2021,
      stats: seasonStats,
      totals: {
        games: grandTotalGames,
        stats: grandTotalStats,
        bettingLines: grandTotalBetting
      },
      extractedAt: new Date().toISOString()
    }, null, 2)
  );
  
  console.log(chalk.green('✅ Corrected season data saved!'));
  console.log(chalk.yellow('\n🎯 Ready for pattern validation on REAL 2021 data!'));
}

// Run extraction
extractFixed2021Seasons()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });