#!/usr/bin/env tsx
/**
 * 🔥 10X PATTERN VALIDATION - COMPLETE ANALYSIS
 * 
 * ALL 5 patterns with CORRECT ROI calculations
 * Deep dive analysis on failures
 * Ready for pattern discovery engine
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

// Our 5 proven patterns
const PATTERNS = [
  { name: 'Back-to-Back Fade', expectedAccuracy: 76.8 },
  { name: 'Embarrassment Revenge', expectedAccuracy: 74.4 },
  { name: 'Altitude Advantage', expectedAccuracy: 68.3 },
  { name: 'Perfect Storm', expectedAccuracy: 67.0 },
  { name: 'Division Dog Bite', expectedAccuracy: 58.6 }
];

// Proper moneyline conversion
function calculatePayout(stake: number, odds: number): number {
  if (odds < 0) {
    // Favorite: -150 means risk $150 to win $100
    return stake + (stake * (100 / Math.abs(odds)));
  } else {
    // Underdog: +150 means risk $100 to win $150
    return stake + (stake * (odds / 100));
  }
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
        id as blowout_game_id,
        ABS(home_score - away_score) as margin
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

async function getPerfectStorm() {
  const query = `
    WITH team_recent_form AS (
      SELECT 
        team_id,
        AVG(points_scored) as avg_points,
        COUNT(CASE WHEN won THEN 1 END) as recent_wins,
        COUNT(*) as games_played
      FROM (
        SELECT 
          home_team_id as team_id,
          home_score as points_scored,
          home_score > away_score as won,
          start_time
        FROM games
        WHERE status = 'Final'
          AND start_time >= '2020-10-01'
          AND start_time <= '2021-12-31'
        UNION ALL
        SELECT 
          away_team_id as team_id,
          away_score as points_scored,
          away_score > home_score as won,
          start_time
        FROM games
        WHERE status = 'Final'
          AND start_time >= '2020-10-01'
          AND start_time <= '2021-12-31'
      ) team_games
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
      htf.avg_points as home_avg_points,
      atf.avg_points as away_avg_points,
      htf.recent_wins as home_recent_wins,
      atf.recent_wins as away_recent_wins,
      bl.home_line as home_moneyline,
      bl.away_moneyline,
      bl.over_under as total_line
    FROM games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    JOIN team_recent_form htf ON g.home_team_id = htf.team_id
    JOIN team_recent_form atf ON g.away_team_id = atf.team_id
    LEFT JOIN betting_lines bl ON g.id = bl.game_id
    WHERE g.status = 'Final'
      AND g.home_score IS NOT NULL
      AND g.away_score IS NOT NULL
      AND g.start_time >= '2021-01-01'
      AND g.start_time <= '2021-12-31'
      -- Perfect Storm criteria
      AND htf.avg_points > 105  -- High scoring home team
      AND htf.recent_wins >= 3  -- Home team on a streak
      AND atf.recent_wins <= 2  -- Away team struggling
      AND bl.over_under > 220   -- High total expected
    ORDER BY g.start_time;
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

async function getDivisionDogBite() {
  const query = `
    SELECT 
      g.id,
      g.start_time,
      g.sport,
      ht.name as home_team,
      at.name as away_team,
      ht.conference as home_conf,
      at.conference as away_conf,
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
        WHEN bl.away_moneyline < bl.home_line THEN 'away'
        ELSE NULL
      END as underdog
    FROM games g
    JOIN teams ht ON g.home_team_id = ht.id
    JOIN teams at ON g.away_team_id = at.id
    LEFT JOIN betting_lines bl ON g.id = bl.game_id
    WHERE g.status = 'Final'
      AND g.home_score IS NOT NULL
      AND g.away_score IS NOT NULL
      AND g.start_time >= '2021-01-01'
      AND g.start_time <= '2021-12-31'
      -- Division game criteria (same conference is proxy for division)
      AND ht.conference = at.conference
      AND ht.conference IS NOT NULL
      -- Underdog criteria
      AND (
        (bl.home_line > 0 AND bl.home_line <= 200) OR 
        (bl.away_moneyline > 0 AND bl.away_moneyline <= 200)
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
    byMargin: {} as any,
    byOdds: {} as any
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
    
    if (predicted && predicted === game.winner) {
      results.correct++;
    }
    
    // Calculate ROI if we have odds
    if (betOdds && !isNaN(parseFloat(betOdds))) {
      const stake = 100;
      results.totalBet += stake;
      
      if (predicted === game.winner) {
        results.totalReturn += calculatePayout(stake, parseFloat(betOdds));
      }
    }
    
    // Track by league
    const league = game.sport || 'Unknown';
    if (!results.byLeague[league]) {
      results.byLeague[league] = { total: 0, correct: 0 };
    }
    results.byLeague[league].total++;
    if (predicted === game.winner) {
      results.byLeague[league].correct++;
    }
  }
  
  results.accuracy = results.opportunities > 0 ? 
    (results.correct / results.opportunities * 100) : 0;
  
  results.roi = results.totalBet > 0 ? 
    ((results.totalReturn - results.totalBet) / results.totalBet * 100) : 0;
  
  return results;
}

async function validate2021Patterns() {
  console.log(chalk.bold.cyan('🔥 10X PATTERN VALIDATION - COMPLETE ANALYSIS\n'));
  
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
    const accuracyColor = result.accuracy >= result.expectedAccuracy ? chalk.green : chalk.red;
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
    if (Object.keys(result.byLeague).length > 0) {
      console.log(chalk.cyan(`\n${result.pattern}:`));
      for (const [league, stats] of Object.entries(result.byLeague as any)) {
        const leagueAccuracy = stats.total > 0 ? (stats.correct / stats.total * 100).toFixed(1) : '0.0';
        console.log(`  ${league}: ${leagueAccuracy}% (${stats.correct}/${stats.total})`);
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
  }
  
  // Key Insights
  console.log(chalk.bold.yellow('\n🎯 KEY INSIGHTS:'));
  
  const profitablePatterns = allResults.filter(r => r.accuracy >= 52.4);
  const bestPattern = allResults.reduce((best, current) => 
    current.accuracy > best.accuracy ? current : best
  );
  
  console.log(`  ✅ Profitable patterns (>52.4%): ${profitablePatterns.length}/5`);
  console.log(`  🏆 Best performer: ${bestPattern.pattern} (${bestPattern.accuracy.toFixed(1)}%)`);
  console.log(`  💡 Total opportunities: ${totalOpps.toLocaleString()} across all patterns`);
  
  if (profitablePatterns.length === 0) {
    console.log(chalk.red(`  ⚠️  NO PATTERNS BEATING THE BREAK-EVEN RATE!`));
    console.log(chalk.red(`  🚨 Original accuracy claims appear to be significantly overstated`));
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