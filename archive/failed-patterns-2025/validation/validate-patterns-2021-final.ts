#!/usr/bin/env tsx
/**
 * 🔥 10X PATTERN VALIDATION - FINAL VERSION
 * 
 * ALL 5 patterns with CORRECT ROI calculations
 * Proper moneyline odds handling
 * Fixed database queries
 */

import { Pool } from 'pg';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: 'postgres',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Proper American odds to decimal conversion
function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    // Underdog: +150 = 2.50 decimal
    return (americanOdds / 100) + 1;
  } else {
    // Favorite: -150 = 1.67 decimal
    return (100 / Math.abs(americanOdds)) + 1;
  }
}

// Calculate payout for a winning bet
function calculateWinnings(stake: number, americanOdds: number): number {
  const decimal = americanToDecimal(americanOdds);
  return stake * decimal; // This includes the original stake
}

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
    WHERE t.city IN ('Denver', 'Salt Lake City', 'Phoenix', 'Calgary', 'Edmonton', 'Colorado Springs', 'Miami', 'Mexico City')
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
        bl.away_moneyline,
        EXTRACT(EPOCH FROM (g2.start_time::timestamp - g1.start_time::timestamp))/3600 as hours_between
      FROM games g1
      JOIN games g2 ON (
        (g1.home_team_id = g2.away_team_id OR g1.away_team_id = g2.home_team_id) 
        AND g2.start_time > g1.start_time 
        AND g2.start_time::timestamp <= g1.start_time::timestamp + INTERVAL '36 hours'
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
        AND g1.sport = g2.sport
    )
    SELECT DISTINCT ON (id) *,
      CASE 
        WHEN home_score > away_score THEN 'home'
        ELSE 'away'
      END as winner
    FROM back_to_back_games
    WHERE hours_between <= 36
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
        id as blowout_game_id,
        ABS(home_score - away_score) as margin,
        sport
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
      bl.margin as previous_margin,
      blines.home_line as home_moneyline,
      blines.away_moneyline,
      EXTRACT(EPOCH FROM (g.start_time::timestamp - bl.blowout_date::timestamp))/86400 as days_between
    FROM blowout_losses bl
    JOIN games g ON (
      (bl.blown_out_team_id = g.home_team_id OR bl.blown_out_team_id = g.away_team_id)
      AND g.start_time > bl.blowout_date
      AND g.start_time::timestamp <= bl.blowout_date::timestamp + INTERVAL '10 days'
      AND g.id != bl.blowout_game_id
      AND g.sport = bl.sport
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

async function getPerfectStorm() {
  // High-scoring favorites at home with good recent form
  const query = `
    WITH team_recent_stats AS (
      SELECT 
        team_id,
        AVG(points_scored) as avg_points_last_5,
        COUNT(CASE WHEN won THEN 1 END) as wins_last_5
      FROM (
        SELECT 
          home_team_id as team_id,
          home_score as points_scored,
          home_score > away_score as won,
          start_time,
          ROW_NUMBER() OVER (PARTITION BY home_team_id ORDER BY start_time DESC) as rn
        FROM games
        WHERE status = 'Final'
          AND start_time >= '2020-10-01'
          AND start_time <= '2021-12-31'
        UNION ALL
        SELECT 
          away_team_id as team_id,
          away_score as points_scored,
          away_score > home_score as won,
          start_time,
          ROW_NUMBER() OVER (PARTITION BY away_team_id ORDER BY start_time DESC) as rn
        FROM games
        WHERE status = 'Final'
          AND start_time >= '2020-10-01'
          AND start_time <= '2021-12-31'
      ) recent_games
      WHERE rn <= 5
      GROUP BY team_id
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
        WHEN g.home_score > g.away_score THEN 'home'
        ELSE 'away'
      END as winner,
      htf.avg_points_last_5 as home_avg_points,
      htf.wins_last_5 as home_recent_wins,
      bl.home_line as home_moneyline,
      bl.away_moneyline,
      bl.over_under as total_line
    FROM games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    JOIN team_recent_stats htf ON g.home_team_id = htf.team_id
    LEFT JOIN betting_lines bl ON g.id = bl.game_id
    WHERE g.status = 'Final'
      AND g.home_score IS NOT NULL
      AND g.away_score IS NOT NULL
      AND g.start_time >= '2021-01-01'
      AND g.start_time <= '2021-12-31'
      AND g.sport IN ('NBA', 'NFL')
      -- Perfect Storm criteria
      AND htf.avg_points_last_5 > 100  -- High scoring team
      AND htf.wins_last_5 >= 3  -- Good recent form
      AND bl.home_line < 0  -- Home favorite
      AND bl.over_under > 200  -- High scoring game expected
    ORDER BY g.start_time;
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

async function getDivisionDogBite() {
  // Division games where underdog wins
  // Since we don't have conference/division data, we'll use frequent matchups as proxy
  const query = `
    WITH division_rivals AS (
      SELECT 
        LEAST(home_team_id, away_team_id) as team1,
        GREATEST(home_team_id, away_team_id) as team2,
        sport,
        COUNT(*) as matchups
      FROM games
      WHERE status = 'Final'
        AND start_time >= '2020-01-01'
        AND start_time <= '2021-12-31'
      GROUP BY LEAST(home_team_id, away_team_id), GREATEST(home_team_id, away_team_id), sport
      HAVING COUNT(*) >= 3  -- Teams that play each other 3+ times are likely division rivals
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
        WHEN g.home_score > g.away_score THEN 'home'
        ELSE 'away'
      END as winner,
      bl.home_line as home_moneyline,
      bl.away_moneyline,
      CASE 
        WHEN bl.home_line > 0 THEN 'home'
        WHEN bl.away_moneyline > 0 THEN 'away'
        ELSE NULL
      END as underdog,
      dr.matchups as season_matchups
    FROM games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    JOIN division_rivals dr ON 
      ((dr.team1 = g.home_team_id AND dr.team2 = g.away_team_id) OR 
       (dr.team1 = g.away_team_id AND dr.team2 = g.home_team_id))
      AND dr.sport = g.sport
    LEFT JOIN betting_lines bl ON g.id = bl.game_id
    WHERE g.status = 'Final'
      AND g.home_score IS NOT NULL
      AND g.away_score IS NOT NULL
      AND g.start_time >= '2021-01-01'
      AND g.start_time <= '2021-12-31'
      AND g.sport IN ('NFL', 'NBA', 'NHL', 'MLB')
      -- Underdog criteria
      AND (bl.home_line > 0 OR bl.away_moneyline > 0)
      AND (
        (bl.home_line > 0 AND bl.home_line <= 300) OR 
        (bl.away_moneyline > 0 AND bl.away_moneyline <= 300)
      )
    ORDER BY g.start_time;
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

async function analyzePattern(patternName: string, games: any[], expectedAccuracy: number) {
  const results = {
    pattern: patternName,
    opportunities: games.length,
    correct: 0,
    accuracy: 0,
    expectedAccuracy,
    totalBet: 0,
    totalReturn: 0,
    roi: 0,
    byLeague: {} as any,
    bySport: {} as any,
    winsByOdds: { favorite: 0, underdog: 0 },
    totalByOdds: { favorite: 0, underdog: 0 }
  };
  
  // Calculate accuracy and ROI
  for (const game of games) {
    let predicted = '';
    let betOdds = 0;
    
    // Determine prediction based on pattern
    switch (patternName) {
      case 'Altitude Advantage':
        predicted = 'home';
        betOdds = game.home_moneyline;
        break;
      case 'Back-to-Back Fade':
        predicted = game.b2b_team_side === 'home' ? 'away' : 'home';
        betOdds = predicted === 'home' ? game.home_moneyline : game.away_moneyline;
        break;
      case 'Embarrassment Revenge':
        predicted = game.revenge_team_side;
        betOdds = predicted === 'home' ? game.home_moneyline : game.away_moneyline;
        break;
      case 'Perfect Storm':
        predicted = 'home';
        betOdds = game.home_moneyline;
        break;
      case 'Division Dog Bite':
        predicted = game.underdog || '';
        betOdds = predicted === 'home' ? game.home_moneyline : game.away_moneyline;
        break;
    }
    
    const correct = predicted && predicted === game.winner;
    if (correct) {
      results.correct++;
    }
    
    // Track by sport
    const sport = game.sport || 'Unknown';
    if (!results.bySport[sport]) {
      results.bySport[sport] = { total: 0, correct: 0, bet: 0, return: 0 };
    }
    results.bySport[sport].total++;
    if (correct) {
      results.bySport[sport].correct++;
    }
    
    // Calculate ROI if we have valid odds
    if (betOdds && !isNaN(parseFloat(betOdds))) {
      const odds = parseFloat(betOdds);
      const stake = 100;
      results.totalBet += stake;
      results.bySport[sport].bet += stake;
      
      // Track favorite vs underdog
      if (odds < 0) {
        results.totalByOdds.favorite++;
        if (correct) results.winsByOdds.favorite++;
      } else {
        results.totalByOdds.underdog++;
        if (correct) results.winsByOdds.underdog++;
      }
      
      if (correct) {
        const winnings = calculateWinnings(stake, odds);
        results.totalReturn += winnings;
        results.bySport[sport].return += winnings;
      }
    }
  }
  
  results.accuracy = results.opportunities > 0 ? 
    (results.correct / results.opportunities * 100) : 0;
  
  results.roi = results.totalBet > 0 ? 
    ((results.totalReturn - results.totalBet) / results.totalBet * 100) : 0;
  
  return results;
}

async function validate2021Patterns() {
  console.log(chalk.bold.cyan('🔥 10X PATTERN VALIDATION - FINAL ANALYSIS\n'));
  
  // Database stats
  const gamesQuery = await pool.query(`
    SELECT COUNT(*) as count, COUNT(DISTINCT sport) as sports
    FROM games 
    WHERE start_time >= '2021-01-01' 
      AND start_time <= '2021-12-31'
      AND status = 'Final';
  `);
  
  const bettingQuery = await pool.query(`
    SELECT COUNT(DISTINCT bl.game_id) as count
    FROM betting_lines bl
    JOIN games g ON bl.game_id = g.id
    WHERE g.start_time >= '2021-01-01' 
      AND g.start_time <= '2021-12-31'
      AND g.status = 'Final';
  `);
  
  console.log(chalk.yellow(`2021 Season Overview:`));
  console.log(`  Total games: ${gamesQuery.rows[0].count.toLocaleString()}`);
  console.log(`  Sports covered: ${gamesQuery.rows[0].sports}`);
  console.log(`  Games with betting: ${bettingQuery.rows[0].count.toLocaleString()}`);
  console.log(`  Betting coverage: ${((bettingQuery.rows[0].count / gamesQuery.rows[0].count) * 100).toFixed(1)}%\n`);
  
  // Validate each pattern
  const allResults = [];
  
  console.log(chalk.bold.yellow('📊 PATTERN VALIDATION:\n'));
  
  // 1. Back-to-Back Fade
  console.log(chalk.cyan('1. Back-to-Back Fade...'));
  const b2bGames = await getBackToBackFade();
  const b2bResults = await analyzePattern('Back-to-Back Fade', b2bGames, 76.8);
  allResults.push(b2bResults);
  console.log(chalk.green(`   ✅ ${b2bGames.length} opportunities found`));
  console.log(chalk.green(`   📊 Accuracy: ${b2bResults.accuracy.toFixed(1)}% (Expected: 76.8%)`));
  console.log(chalk.green(`   💰 ROI: ${b2bResults.roi.toFixed(1)}%`));
  console.log();
  
  // 2. Embarrassment Revenge
  console.log(chalk.cyan('2. Embarrassment Revenge...'));
  const revengeGames = await getEmbarrassmentRevenge();
  const revengeResults = await analyzePattern('Embarrassment Revenge', revengeGames, 74.4);
  allResults.push(revengeResults);
  console.log(chalk.green(`   ✅ ${revengeGames.length} opportunities found`));
  console.log(chalk.green(`   📊 Accuracy: ${revengeResults.accuracy.toFixed(1)}% (Expected: 74.4%)`));
  console.log(chalk.green(`   💰 ROI: ${revengeResults.roi.toFixed(1)}%`));
  console.log();
  
  // 3. Altitude Advantage
  console.log(chalk.cyan('3. Altitude Advantage...'));
  const altitudeGames = await getAltitudeAdvantage();
  const altitudeResults = await analyzePattern('Altitude Advantage', altitudeGames, 68.3);
  allResults.push(altitudeResults);
  console.log(chalk.green(`   ✅ ${altitudeGames.length} opportunities found`));
  console.log(chalk.green(`   📊 Accuracy: ${altitudeResults.accuracy.toFixed(1)}% (Expected: 68.3%)`));
  console.log(chalk.green(`   💰 ROI: ${altitudeResults.roi.toFixed(1)}%`));
  console.log();
  
  // 4. Perfect Storm
  console.log(chalk.cyan('4. Perfect Storm...'));
  const stormGames = await getPerfectStorm();
  const stormResults = await analyzePattern('Perfect Storm', stormGames, 67.0);
  allResults.push(stormResults);
  console.log(chalk.green(`   ✅ ${stormGames.length} opportunities found`));
  console.log(chalk.green(`   📊 Accuracy: ${stormResults.accuracy.toFixed(1)}% (Expected: 67.0%)`));
  console.log(chalk.green(`   💰 ROI: ${stormResults.roi.toFixed(1)}%`));
  console.log();
  
  // 5. Division Dog Bite
  console.log(chalk.cyan('5. Division Dog Bite...'));
  const divisionGames = await getDivisionDogBite();
  const divisionResults = await analyzePattern('Division Dog Bite', divisionGames, 58.6);
  allResults.push(divisionResults);
  console.log(chalk.green(`   ✅ ${divisionGames.length} opportunities found`));
  console.log(chalk.green(`   📊 Accuracy: ${divisionResults.accuracy.toFixed(1)}% (Expected: 58.6%)`));
  console.log(chalk.green(`   💰 ROI: ${divisionResults.roi.toFixed(1)}%`));
  
  // Performance Summary
  console.log(chalk.bold.cyan('\n📊 2021 PATTERN PERFORMANCE SUMMARY:\n'));
  console.log(chalk.gray('Pattern                  | Opps  | Accuracy | Expected | Diff   | ROI'));
  console.log(chalk.gray('-------------------------|-------|----------|----------|--------|--------'));
  
  let totalOpps = 0;
  let totalCorrect = 0;
  let totalBet = 0;
  let totalReturn = 0;
  
  for (const result of allResults) {
    const accuracyColor = result.accuracy >= 52.4 ? chalk.green : chalk.red;
    const roiColor = result.roi > 0 ? chalk.green : chalk.red;
    const diff = (result.accuracy - result.expectedAccuracy).toFixed(1);
    
    console.log(
      `${result.pattern.padEnd(24)} | ${String(result.opportunities).padStart(5)} | ` +
      `${accuracyColor(result.accuracy.toFixed(1) + '%').padStart(8)} | ${String(result.expectedAccuracy + '%').padStart(8)} | ` +
      `${accuracyColor((parseFloat(diff) >= 0 ? '+' : '') + diff + '%').padStart(6)} | ` +
      `${roiColor(result.roi.toFixed(1) + '%').padStart(6)}`
    );
    
    totalOpps += result.opportunities;
    totalCorrect += result.correct;
    totalBet += result.totalBet;
    totalReturn += result.totalReturn;
  }
  
  const overallAccuracy = totalOpps > 0 ? (totalCorrect / totalOpps * 100).toFixed(1) : '0.0';
  const overallROI = totalBet > 0 ? ((totalReturn - totalBet) / totalBet * 100).toFixed(1) : '0.0';
  
  console.log(chalk.gray('-------------------------|-------|----------|----------|--------|--------'));
  console.log(
    chalk.bold(`${'TOTAL'.padEnd(24)} | ${String(totalOpps).padStart(5)} | ` +
    `${chalk.cyan(overallAccuracy + '%').padStart(8)} | ${chalk.gray('65.2%').padStart(8)} | ` +
    `${chalk.cyan((parseFloat(overallAccuracy) >= 65.2 ? '+' : '') + (parseFloat(overallAccuracy) - 65.2).toFixed(1) + '%').padStart(6)} | ` +
    `${chalk.cyan(overallROI + '%').padStart(6)}`)
  );
  
  // Deep Dive Analysis
  console.log(chalk.bold.cyan('\n🔍 DEEP DIVE ANALYSIS:\n'));
  
  // Sport breakdown
  console.log(chalk.yellow('Pattern Performance by Sport:'));
  for (const result of allResults) {
    if (Object.keys(result.bySport).length > 0) {
      console.log(chalk.cyan(`\n${result.pattern}:`));
      for (const [sport, stats] of Object.entries(result.bySport as any)) {
        const sportAccuracy = stats.total > 0 ? (stats.correct / stats.total * 100).toFixed(1) : '0.0';
        const sportROI = stats.bet > 0 ? ((stats.return - stats.bet) / stats.bet * 100).toFixed(1) : '0.0';
        console.log(`  ${sport}: ${sportAccuracy}% accuracy (${stats.correct}/${stats.total}), ROI: ${sportROI}%`);
      }
    }
  }
  
  // Financial Summary
  if (totalBet > 0) {
    console.log(chalk.bold.yellow('\n💰 FINANCIAL SUMMARY:'));
    console.log(`  Total Wagered: $${totalBet.toLocaleString()}`);
    console.log(`  Total Return: $${totalReturn.toFixed(2)}`);
    console.log(`  Net Profit/Loss: ${totalReturn >= totalBet ? chalk.green : chalk.red}$${(totalReturn - totalBet).toFixed(2)}`);
    console.log(`  ROI: ${overallROI}%`);
    console.log(`  Break-even rate needed: 52.4% (with -110 juice)`);
    console.log(`  Actual win rate: ${overallAccuracy}%`);
  }
  
  // Key Insights
  console.log(chalk.bold.yellow('\n🎯 KEY INSIGHTS:'));
  
  const profitablePatterns = allResults.filter(r => r.accuracy >= 52.4);
  const bestPattern = allResults.reduce((best, current) => 
    current.accuracy > best.accuracy ? current : best
  );
  const worstPattern = allResults.reduce((worst, current) => 
    current.accuracy < worst.accuracy ? current : worst
  );
  
  console.log(`  ✅ Profitable patterns (>52.4%): ${profitablePatterns.length}/5`);
  console.log(`  🏆 Best performer: ${bestPattern.pattern} (${bestPattern.accuracy.toFixed(1)}%)`);
  console.log(`  💀 Worst performer: ${worstPattern.pattern} (${worstPattern.accuracy.toFixed(1)}%)`);
  console.log(`  💡 Total opportunities: ${totalOpps.toLocaleString()} across all patterns`);
  
  if (profitablePatterns.length === 0) {
    console.log(chalk.red(`\n  ⚠️  WARNING: NO PATTERNS BEAT THE BREAK-EVEN RATE!`));
    console.log(chalk.red(`  🚨 The claimed accuracy rates appear to be SEVERELY OVERSTATED`));
    console.log(chalk.red(`  💸 Following these patterns would result in SIGNIFICANT LOSSES`));
  } else {
    console.log(chalk.green(`\n  ✨ ${profitablePatterns.length} patterns show promise for profitability`));
    profitablePatterns.forEach(p => {
      console.log(chalk.green(`     - ${p.pattern}: ${p.accuracy.toFixed(1)}% accuracy, ${p.roi.toFixed(1)}% ROI`));
    });
  }
  
  // Pattern Reality Check
  console.log(chalk.bold.red('\n🚨 PATTERN REALITY CHECK:'));
  for (const result of allResults) {
    const gap = result.expectedAccuracy - result.accuracy;
    if (gap > 10) {
      console.log(chalk.red(`  ${result.pattern}: ${gap.toFixed(1)}% BELOW claimed accuracy!`));
    }
  }
}

async function main() {
  try {
    await validate2021Patterns();
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
  } finally {
    await pool.end();
  }
}

main();