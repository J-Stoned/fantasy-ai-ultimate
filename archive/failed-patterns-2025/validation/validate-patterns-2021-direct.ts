#!/usr/bin/env tsx
/**
 * 🎯 VALIDATE PATTERNS ON 2021 DATA - DIRECT DATABASE VERSION
 * 
 * Runs pattern validation directly against database
 * Bypasses API authentication issues for testing
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Create local PostgreSQL connection
const pool = new Pool({
  host: 'localhost', // When running from Windows, use localhost
  port: 5432,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: 'postgres',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Our 5 proven patterns
const PATTERNS = [
  { name: 'Back-to-Back Fade', expectedAccuracy: 76.8 },
  { name: 'Embarrassment Revenge', expectedAccuracy: 74.4 },
  { name: 'Altitude Advantage', expectedAccuracy: 68.3 },
  { name: 'Perfect Storm', expectedAccuracy: 67.0 },
  { name: 'Division Dog Bite', expectedAccuracy: 58.6 }
];

async function getAltitudeAdvantage() {
  const query = `
    SELECT 
      g.id,
      g.start_time,
      g.sport,
      ht.name as home_team,
      at.name as away_team,
      g.home_score,
      g.away_score,
      t.city,
      CASE 
        WHEN g.home_score > g.away_score THEN 'home'
        ELSE 'away'
      END as winner,
      bl.home_line as home_moneyline,
      bl.away_moneyline
    FROM games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    JOIN teams t ON g.home_team_id = t.id
    LEFT JOIN betting_lines bl ON g.id = bl.game_id
    WHERE t.city IN ('Denver', 'Salt Lake City', 'Phoenix', 'Calgary', 'Edmonton', 'Colorado Springs')
      AND g.status = 'Final'
      AND g.home_score IS NOT NULL
      AND g.away_score IS NOT NULL
      AND g.start_time >= '2021-01-01'
      AND g.start_time <= '2021-12-31'
    ORDER BY g.start_time;
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

async function getBackToBackFade() {
  const query = `
    WITH back_to_back_games AS (
      SELECT 
        g2.id,
        g2.start_time,
        g2.sport,
        g2.home_team_id,
        g2.away_team_id,
        g2.home_score,
        g2.away_score,
        ht.name as home_team,
        at.name as away_team,
        CASE 
          WHEN g1.home_team_id = g2.away_team_id THEN 'away'
          WHEN g1.away_team_id = g2.home_team_id THEN 'home'
        END as b2b_team_side,
        bl.home_line as home_moneyline,
        bl.away_moneyline
      FROM games g1
      JOIN games g2 ON (
        (g1.home_team_id = g2.away_team_id OR g1.away_team_id = g2.home_team_id) 
        AND g2.start_time > g1.start_time 
        AND g2.start_time::timestamp <= g1.start_time::timestamp + INTERVAL '2 days'
      )
      JOIN teams ht ON g2.home_team_id = ht.id
      JOIN teams at ON g2.away_team_id = at.id
      LEFT JOIN betting_lines bl ON g2.id = bl.game_id
      WHERE g1.status = 'Final' 
        AND g2.status = 'Final'
        AND g2.home_score IS NOT NULL
        AND g2.away_score IS NOT NULL
        AND g2.start_time >= '2021-01-01'
        AND g2.start_time <= '2021-12-31'
    )
    SELECT DISTINCT ON (id) *,
      CASE 
        WHEN home_score > away_score THEN 'home'
        ELSE 'away'
      END as winner
    FROM back_to_back_games
    ORDER BY id, start_time;
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

async function getEmbarrassmentRevenge() {
  const query = `
    WITH blowout_losses AS (
      SELECT 
        CASE 
          WHEN home_score - away_score >= 20 THEN away_team_id
          WHEN away_score - home_score >= 20 THEN home_team_id
        END as blown_out_team_id,
        start_time as blowout_date,
        id as blowout_game_id
      FROM games
      WHERE status = 'Final'
        AND (ABS(home_score - away_score) >= 20)
        AND start_time >= '2020-10-01'
        AND start_time <= '2021-12-31'
    )
    SELECT 
      g.id,
      g.start_time,
      g.sport,
      ht.name as home_team,
      at.name as away_team,
      g.home_score,
      g.away_score,
      CASE 
        WHEN bl.blown_out_team_id = g.home_team_id THEN 'home'
        ELSE 'away'
      END as revenge_team_side,
      CASE 
        WHEN g.home_score > g.away_score THEN 'home'
        ELSE 'away'
      END as winner,
      blines.home_line as home_moneyline,
      blines.away_moneyline
    FROM blowout_losses bl
    JOIN games g ON (
      (bl.blown_out_team_id = g.home_team_id OR bl.blown_out_team_id = g.away_team_id)
      AND g.start_time > bl.blowout_date
      AND g.start_time::timestamp <= bl.blowout_date::timestamp + INTERVAL '10 days'
      AND g.id != bl.blowout_game_id
    )
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    LEFT JOIN betting_lines blines ON g.id = blines.game_id
    WHERE g.status = 'Final'
      AND g.home_score IS NOT NULL
      AND g.away_score IS NOT NULL
      AND g.start_time >= '2021-01-01'
      AND g.start_time <= '2021-12-31'
    ORDER BY g.start_time;
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

async function validatePatterns() {
  console.log(chalk.bold.cyan('🎯 VALIDATING PATTERNS ON 2021 DATA - DIRECT DATABASE VERSION\n'));
  
  // First, check how many 2021 games we have
  const gamesQuery = await pool.query(`
    SELECT COUNT(*) as count
    FROM games 
    WHERE start_time >= '2021-01-01' 
      AND start_time <= '2021-12-31'
      AND status = 'Final';
  `);
  
  const totalGames = parseInt(gamesQuery.rows[0].count);
  console.log(chalk.yellow(`Total 2021 games: ${totalGames.toLocaleString()}\n`));
  
  // Check betting lines coverage
  const bettingQuery = await pool.query(`
    SELECT COUNT(DISTINCT bl.game_id) as count
    FROM betting_lines bl
    JOIN games g ON bl.game_id = g.id
    WHERE g.start_time >= '2021-01-01' 
      AND g.start_time <= '2021-12-31'
      AND g.status = 'Final';
  `);
  
  const gamesWithBetting = parseInt(bettingQuery.rows[0].count);
  console.log(chalk.yellow(`Games with betting lines: ${gamesWithBetting.toLocaleString()}`));
  console.log(chalk.gray(`Coverage: ${((gamesWithBetting / totalGames) * 100).toFixed(1)}%\n`));
  
  console.log(chalk.bold.yellow('📊 PATTERN VALIDATION:\n'));
  
  const results = [];
  
  // Validate Altitude Advantage
  console.log(chalk.cyan('Validating Altitude Advantage...'));
  try {
    const altitudeGames = await getAltitudeAdvantage();
    const altitudeWins = altitudeGames.filter(g => g.winner === 'home').length;
    const altitudeAccuracy = altitudeGames.length > 0 ? (altitudeWins / altitudeGames.length * 100) : 0;
    
    results.push({
      pattern: 'Altitude Advantage',
      opportunities: altitudeGames.length,
      correct: altitudeWins,
      accuracy: altitudeAccuracy.toFixed(1),
      expectedAccuracy: 68.3,
      games: altitudeGames
    });
    
    console.log(chalk.green(`  ✅ ${altitudeGames.length} opportunities found`));
    console.log(chalk.green(`  📊 Accuracy: ${altitudeAccuracy.toFixed(1)}% (Expected: 68.3%)`));
    console.log();
  } catch (error) {
    console.log(chalk.red(`  ❌ Error: ${error.message}\n`));
  }
  
  // Validate Back-to-Back Fade
  console.log(chalk.cyan('Validating Back-to-Back Fade...'));
  try {
    const b2bGames = await getBackToBackFade();
    const b2bCorrect = b2bGames.filter(g => {
      // Bet against the team playing back-to-back
      return (g.b2b_team_side === 'home' && g.winner === 'away') ||
             (g.b2b_team_side === 'away' && g.winner === 'home');
    }).length;
    const b2bAccuracy = b2bGames.length > 0 ? (b2bCorrect / b2bGames.length * 100) : 0;
    
    results.push({
      pattern: 'Back-to-Back Fade',
      opportunities: b2bGames.length,
      correct: b2bCorrect,
      accuracy: b2bAccuracy.toFixed(1),
      expectedAccuracy: 76.8,
      games: b2bGames
    });
    
    console.log(chalk.green(`  ✅ ${b2bGames.length} opportunities found`));
    console.log(chalk.green(`  📊 Accuracy: ${b2bAccuracy.toFixed(1)}% (Expected: 76.8%)`));
    console.log();
  } catch (error) {
    console.log(chalk.red(`  ❌ Error: ${error.message}\n`));
  }
  
  // Validate Embarrassment Revenge
  console.log(chalk.cyan('Validating Embarrassment Revenge...'));
  try {
    const revengeGames = await getEmbarrassmentRevenge();
    const revengeCorrect = revengeGames.filter(g => g.revenge_team_side === g.winner).length;
    const revengeAccuracy = revengeGames.length > 0 ? (revengeCorrect / revengeGames.length * 100) : 0;
    
    results.push({
      pattern: 'Embarrassment Revenge',
      opportunities: revengeGames.length,
      correct: revengeCorrect,
      accuracy: revengeAccuracy.toFixed(1),
      expectedAccuracy: 74.4,
      games: revengeGames
    });
    
    console.log(chalk.green(`  ✅ ${revengeGames.length} opportunities found`));
    console.log(chalk.green(`  📊 Accuracy: ${revengeAccuracy.toFixed(1)}% (Expected: 74.4%)`));
    console.log();
  } catch (error) {
    console.log(chalk.red(`  ❌ Error: ${error.message}\n`));
  }
  
  // Calculate ROI for patterns with betting data
  console.log(chalk.bold.cyan('\n💰 CALCULATING ROI:\n'));
  
  for (const result of results) {
    if (result.games && result.games.length > 0) {
      let totalBet = 0;
      let totalReturn = 0;
      let gamesWithOdds = 0;
      
      for (const game of result.games) {
        if (game.home_moneyline && game.away_moneyline) {
          gamesWithOdds++;
          totalBet += 100; // $100 per bet
          
          let betOnHome = false;
          
          // Determine which side to bet on based on pattern
          if (result.pattern === 'Altitude Advantage') {
            betOnHome = true; // Always bet on home team
          } else if (result.pattern === 'Back-to-Back Fade') {
            betOnHome = game.b2b_team_side === 'away'; // Bet against B2B team
          } else if (result.pattern === 'Embarrassment Revenge') {
            betOnHome = game.revenge_team_side === 'home'; // Bet on revenge team
          }
          
          const winner = game.winner;
          const betWon = (betOnHome && winner === 'home') || (!betOnHome && winner === 'away');
          
          if (betWon) {
            const odds = parseFloat(betOnHome ? game.home_moneyline : game.away_moneyline);
            if (!isNaN(odds)) {
              if (odds < 0) {
                // Favorite: -150 means bet $150 to win $100
                const profit = 100 / (Math.abs(odds) / 100);
                totalReturn += 100 + profit;
              } else {
                // Underdog: +150 means bet $100 to win $150
                const profit = odds;
                totalReturn += 100 + profit;
              }
            }
          }
        }
      }
      
      const roi = totalBet > 0 ? ((totalReturn - totalBet) / totalBet * 100) : 0;
      
      console.log(chalk.yellow(`${result.pattern}:`));
      console.log(chalk.gray(`  Games with odds: ${gamesWithOdds}/${result.opportunities}`));
      if (totalBet > 0) {
        console.log(chalk.green(`  Total bet: $${totalBet.toLocaleString()}`));
        console.log(chalk.green(`  Total return: $${totalReturn.toFixed(2)}`));
        console.log(chalk.green(`  Net profit: $${(totalReturn - totalBet).toFixed(2)}`));
        console.log(chalk.bold.green(`  ROI: ${roi.toFixed(1)}%`));
      } else {
        console.log(chalk.gray(`  No betting data available`));
      }
      console.log();
    }
  }
  
  // Summary
  console.log(chalk.bold.cyan('\n📊 2021 PATTERN PERFORMANCE SUMMARY:\n'));
  console.log(chalk.gray('Pattern                  | Opps | Accuracy | Expected | Diff'));
  console.log(chalk.gray('-------------------------|------|----------|----------|-------'));
  
  let totalOpps = 0;
  let totalCorrect = 0;
  
  for (const result of results) {
    const accuracyColor = parseFloat(result.accuracy) >= result.expectedAccuracy ? chalk.green : chalk.red;
    const diff = (parseFloat(result.accuracy) - result.expectedAccuracy).toFixed(1);
    
    console.log(
      `${result.pattern.padEnd(24)} | ${String(result.opportunities).padStart(4)} | ` +
      `${accuracyColor(result.accuracy + '%').padStart(8)} | ${String(result.expectedAccuracy + '%').padStart(8)} | ` +
      `${accuracyColor((diff >= 0 ? '+' : '') + diff + '%').padStart(5)}`
    );
    
    totalOpps += result.opportunities;
    totalCorrect += result.correct;
  }
  
  const overallAccuracy = totalOpps > 0 ? (totalCorrect / totalOpps * 100).toFixed(1) : '0.0';
  
  console.log(chalk.gray('-------------------------|------|----------|----------|-------'));
  console.log(
    chalk.bold(`${'TOTAL'.padEnd(24)} | ${String(totalOpps).padStart(4)} | ` +
    `${chalk.cyan(overallAccuracy + '%').padStart(8)} | ${chalk.gray('70.0%').padStart(8)} | ` +
    `${chalk.cyan((parseFloat(overallAccuracy) >= 70 ? '+' : '') + (parseFloat(overallAccuracy) - 70).toFixed(1) + '%').padStart(5)}`)
  );
}

async function main() {
  try {
    await validatePatterns();
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
  } finally {
    await pool.end();
  }
}

main();