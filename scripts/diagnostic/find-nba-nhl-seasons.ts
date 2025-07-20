#!/usr/bin/env tsx
/**
 * 🏀🏒 FIND NBA & NHL 2021-22 SEASONS
 * 
 * These leagues cross calendar years, need to find actual games
 */

import { queryMany, queryOne } from '../utils/local-db-pool.js';
import chalk from 'chalk';

async function findNbaNhlSeasons() {
  console.log(chalk.cyan('🏀🏒 FINDING NBA & NHL 2021-22 SEASONS\n'));
  
  try {
    // Check NBA seasons
    console.log(chalk.yellow('🏀 NBA SEASONS:'));
    const nbaSummary = await queryMany(`
      SELECT 
        CASE 
          WHEN EXTRACT(MONTH FROM start_time::timestamp) >= 10 THEN 
            EXTRACT(YEAR FROM start_time::timestamp) || '-' || (EXTRACT(YEAR FROM start_time::timestamp) + 1)
          ELSE 
            (EXTRACT(YEAR FROM start_time::timestamp) - 1) || '-' || EXTRACT(YEAR FROM start_time::timestamp)
        END as season,
        COUNT(*) as games,
        MIN(start_time)::date as first_game,
        MAX(start_time)::date as last_game,
        COUNT(CASE WHEN status = 'Final' THEN 1 END) as final_games
      FROM games
      WHERE sport = 'NBA'
      GROUP BY season
      ORDER BY season DESC
      LIMIT 10
    `);
    
    console.log(chalk.gray('Season | Games | First Game | Last Game | Final'));
    console.log(chalk.gray('-'.repeat(70)));
    nbaSummary.forEach(row => {
      const is202122 = row.season === '2021-2022';
      const color = is202122 ? chalk.green : chalk.gray;
      console.log(color(`${row.season} | ${row.games.toString().padStart(5)} | ${row.first_game} | ${row.last_game} | ${row.final_games}`));
    });
    
    // Check NHL seasons
    console.log(chalk.yellow('\n🏒 NHL SEASONS:'));
    const nhlSummary = await queryMany(`
      SELECT 
        CASE 
          WHEN EXTRACT(MONTH FROM start_time::timestamp) >= 10 THEN 
            EXTRACT(YEAR FROM start_time::timestamp) || '-' || (EXTRACT(YEAR FROM start_time::timestamp) + 1)
          ELSE 
            (EXTRACT(YEAR FROM start_time::timestamp) - 1) || '-' || EXTRACT(YEAR FROM start_time::timestamp)
        END as season,
        COUNT(*) as games,
        MIN(start_time)::date as first_game,
        MAX(start_time)::date as last_game,
        COUNT(CASE WHEN status = 'Final' THEN 1 END) as final_games
      FROM games
      WHERE sport = 'NHL'
      GROUP BY season
      ORDER BY season DESC
      LIMIT 10
    `);
    
    console.log(chalk.gray('Season | Games | First Game | Last Game | Final'));
    console.log(chalk.gray('-'.repeat(70)));
    nhlSummary.forEach(row => {
      const is202122 = row.season === '2021-2022';
      const color = is202122 ? chalk.green : chalk.gray;
      console.log(color(`${row.season} | ${row.games.toString().padStart(5)} | ${row.first_game} | ${row.last_game} | ${row.final_games}`));
    });
    
    // Get detailed 2021-22 info
    console.log(chalk.cyan('\n📊 DETAILED 2021-22 SEASON INFO:'));
    
    // NBA 2021-22
    const nba202122 = await queryOne(`
      SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN status = 'Final' THEN 1 END) as final_games,
        MIN(start_time)::date as first_game,
        MAX(start_time)::date as last_game
      FROM games
      WHERE sport = 'NBA'
        AND start_time >= '2021-10-01'
        AND start_time < '2022-07-01'
    `);
    
    console.log(chalk.green(`\n🏀 NBA 2021-22:`));
    console.log(chalk.green(`   Total Games: ${nba202122.total_games}`));
    console.log(chalk.green(`   Final Games: ${nba202122.final_games}`));
    console.log(chalk.green(`   Season: ${nba202122.first_game} to ${nba202122.last_game}`));
    
    // NHL 2021-22
    const nhl202122 = await queryOne(`
      SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN status = 'Final' THEN 1 END) as final_games,
        MIN(start_time)::date as first_game,
        MAX(start_time)::date as last_game
      FROM games
      WHERE sport = 'NHL'
        AND start_time >= '2021-10-01'
        AND start_time < '2022-07-01'
    `);
    
    console.log(chalk.green(`\n🏒 NHL 2021-22:`));
    console.log(chalk.green(`   Total Games: ${nhl202122.total_games}`));
    console.log(chalk.green(`   Final Games: ${nhl202122.final_games}`));
    console.log(chalk.green(`   Season: ${nhl202122.first_game} to ${nhl202122.last_game}`));
    
    // Check betting coverage
    console.log(chalk.yellow('\n💰 BETTING COVERAGE:'));
    
    const nbaBetting = await queryOne(`
      SELECT COUNT(DISTINCT g.id) as games_with_lines
      FROM games g
      JOIN betting_lines bl ON bl.game_id = g.id
      WHERE g.sport = 'NBA'
        AND g.start_time >= '2021-10-01'
        AND g.start_time < '2022-07-01'
    `);
    
    const nhlBetting = await queryOne(`
      SELECT COUNT(DISTINCT g.id) as games_with_lines
      FROM games g
      JOIN betting_lines bl ON bl.game_id = g.id
      WHERE g.sport = 'NHL'
        AND g.start_time >= '2021-10-01'
        AND g.start_time < '2022-07-01'
    `);
    
    console.log(chalk.green(`NBA 2021-22: ${nbaBetting.games_with_lines} games with betting lines`));
    console.log(chalk.green(`NHL 2021-22: ${nhlBetting.games_with_lines} games with betting lines`));
    
    // Summary
    console.log(chalk.cyan('\n🎯 CONCLUSION:'));
    if (parseInt(nba202122.total_games) > 0 || parseInt(nhl202122.total_games) > 0) {
      console.log(chalk.green('✅ NBA and NHL 2021-22 seasons ARE in the database!'));
      console.log(chalk.yellow('📝 Need to update extraction script with correct date ranges'));
    } else {
      console.log(chalk.red('❌ NBA and NHL 2021-22 seasons are missing'));
      console.log(chalk.yellow('📝 May need to collect this data'));
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

findNbaNhlSeasons()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });