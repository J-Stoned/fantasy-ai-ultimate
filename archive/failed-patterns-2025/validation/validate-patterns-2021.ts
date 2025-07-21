#!/usr/bin/env tsx
/**
 * 🎯 VALIDATE PATTERNS ON 2021 DATA
 * 
 * Runs all 5 patterns on 2021 season data only
 * Calculates actual ROI using betting lines
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Pattern API endpoints
const PATTERN_APIS = {
  local: 'http://localhost:3337', // V4 API
  unified: 'http://localhost:3336'
};

// Our 5 proven patterns
const PATTERNS = [
  { name: 'Back-to-Back Fade', expectedAccuracy: 76.8 },
  { name: 'Embarrassment Revenge', expectedAccuracy: 74.4 },
  { name: 'Altitude Advantage', expectedAccuracy: 68.3 },
  { name: 'Perfect Storm', expectedAccuracy: 67.0 },
  { name: 'Division Dog Bite', expectedAccuracy: 58.6 }
];

async function validatePattern(patternName: string) {
  try {
    // First try the pattern detection API
    // Create a dummy JWT token for testing (the API will accept any valid JWT structure)
    const dummyToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IlZhbGlkYXRpb24gU2NyaXB0IiwiaWF0IjoxNTE2MjM5MDIyLCJ0aWVyIjoicHJvZmVzc2lvbmFsIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    
    const response = await axios.get(`${PATTERN_APIS.local}/patterns/${patternName.toLowerCase().replace(/\s+/g, '-')}`, {
      params: {
        startDate: '2021-01-01',
        endDate: '2021-12-31'
      },
      headers: {
        'Authorization': `Bearer ${dummyToken}`,
        'X-API-Key': 'test-api-key'
      },
      timeout: 30000
    });
    
    return response.data;
  } catch (error: any) {
    console.error(chalk.red(`Error fetching ${patternName}:`), error.message);
    if (error.response) {
      console.error(chalk.gray(`Status: ${error.response.status}, Data:`, error.response.data));
    }
    return null;
  }
}

async function calculate2021Stats() {
  console.log(chalk.bold.cyan('🎯 VALIDATING PATTERNS ON 2021 DATA\n'));
  
  // First, check how many 2021 games we have
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .gte('start_time', '2021-01-01')
    .lte('start_time', '2021-12-31')
    .eq('status', 'Final');
    
  console.log(chalk.yellow(`Total 2021 games: ${totalGames?.toLocaleString()}\n`));
  
  // Check betting lines coverage
  // First get 2021 game IDs with pagination
  const allGameIds = [];
  let offset = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: games2021 } = await supabase
      .from('games')
      .select('id')
      .gte('start_time', '2021-01-01')
      .lte('start_time', '2021-12-31')
      .eq('status', 'Final')
      .range(offset, offset + batchSize - 1);
      
    if (!games2021 || games2021.length === 0) break;
    
    allGameIds.push(...games2021.map(g => g.id));
    
    if (games2021.length < batchSize) break;
    offset += batchSize;
  }
  
  // Count betting lines in batches
  let bettingCount = 0;
  for (let i = 0; i < allGameIds.length; i += 900) {
    const batch = allGameIds.slice(i, i + 900);
    const { count } = await supabase
      .from('betting_lines')
      .select('game_id', { count: 'exact', head: true })
      .in('game_id', batch);
    
    bettingCount += count || 0;
  }
  
  const gamesWithBetting = bettingCount;
    
  console.log(chalk.yellow(`Games with betting lines: ${gamesWithBetting?.toLocaleString()}`));
  console.log(chalk.gray(`Coverage: ${totalGames ? ((gamesWithBetting || 0) / totalGames * 100).toFixed(1) : 0}%\n`));
  
  // Validate each pattern
  console.log(chalk.bold.yellow('📊 PATTERN VALIDATION:\n'));
  
  const results = [];
  
  for (const pattern of PATTERNS) {
    console.log(chalk.cyan(`Validating ${pattern.name}...`));
    
    const patternData = await validatePattern(pattern.name);
    
    if (patternData && patternData.games) {
      const totalOpportunities = patternData.games.length;
      const correctPredictions = patternData.games.filter((g: any) => g.correct).length;
      const accuracy = totalOpportunities > 0 ? (correctPredictions / totalOpportunities * 100) : 0;
      
      // Calculate ROI if betting data available
      let totalBet = 0;
      let totalReturn = 0;
      
      for (const game of patternData.games) {
        if (game.betting_odds) {
          totalBet += 100; // Assume $100 per bet
          if (game.correct) {
            // Calculate return based on odds
            const odds = game.predicted_winner === 'home' ? 
              game.betting_odds.home_moneyline : 
              game.betting_odds.away_moneyline;
            
            if (odds < 0) {
              totalReturn += 100 + (100 / Math.abs(odds) * 100);
            } else {
              totalReturn += 100 + (odds / 100 * 100);
            }
          }
        }
      }
      
      const roi = totalBet > 0 ? ((totalReturn - totalBet) / totalBet * 100) : 0;
      
      results.push({
        pattern: pattern.name,
        opportunities: totalOpportunities,
        correct: correctPredictions,
        accuracy: accuracy.toFixed(1),
        expectedAccuracy: pattern.expectedAccuracy,
        difference: (accuracy - pattern.expectedAccuracy).toFixed(1),
        totalBet: totalBet,
        totalReturn: totalReturn.toFixed(2),
        roi: roi.toFixed(1)
      });
      
      console.log(chalk.green(`  ✅ ${totalOpportunities} opportunities found`));
      console.log(chalk.green(`  📊 Accuracy: ${accuracy.toFixed(1)}% (Expected: ${pattern.expectedAccuracy}%)`));
      if (totalBet > 0) {
        console.log(chalk.green(`  💰 ROI: ${roi.toFixed(1)}% ($${totalBet} → $${totalReturn.toFixed(2)})`));
      }
      console.log();
    } else {
      console.log(chalk.red(`  ❌ No data returned\n`));
      results.push({
        pattern: pattern.name,
        opportunities: 0,
        correct: 0,
        accuracy: '0.0',
        expectedAccuracy: pattern.expectedAccuracy,
        difference: `-${pattern.expectedAccuracy}`,
        totalBet: 0,
        totalReturn: '0.00',
        roi: '0.0'
      });
    }
  }
  
  // Summary table
  console.log(chalk.bold.cyan('\n📊 2021 PATTERN PERFORMANCE SUMMARY:\n'));
  console.log(chalk.gray('Pattern                  | Opps | Accuracy | Expected | Diff  | ROI'));
  console.log(chalk.gray('-------------------------|------|----------|----------|-------|--------'));
  
  for (const result of results) {
    const accuracyColor = parseFloat(result.accuracy) >= result.expectedAccuracy ? chalk.green : chalk.red;
    const roiColor = parseFloat(result.roi) > 0 ? chalk.green : chalk.red;
    
    console.log(
      `${result.pattern.padEnd(24)} | ${String(result.opportunities).padStart(4)} | ` +
      `${accuracyColor(result.accuracy + '%').padStart(8)} | ${String(result.expectedAccuracy + '%').padStart(8)} | ` +
      `${accuracyColor(result.difference + '%').padStart(5)} | ${roiColor(result.roi + '%').padStart(6)}`
    );
  }
  
  // Overall stats
  const totalOpps = results.reduce((sum, r) => sum + r.opportunities, 0);
  const totalCorrect = results.reduce((sum, r) => sum + r.correct, 0);
  const overallAccuracy = totalOpps > 0 ? (totalCorrect / totalOpps * 100).toFixed(1) : '0.0';
  const totalBets = results.reduce((sum, r) => sum + r.totalBet, 0);
  const totalReturns = results.reduce((sum, r) => sum + parseFloat(r.totalReturn), 0);
  const overallROI = totalBets > 0 ? ((totalReturns - totalBets) / totalBets * 100).toFixed(1) : '0.0';
  
  console.log(chalk.gray('-------------------------|------|----------|----------|-------|--------'));
  console.log(
    chalk.bold(`${'TOTAL'.padEnd(24)} | ${String(totalOpps).padStart(4)} | ` +
    `${chalk.cyan(overallAccuracy + '%').padStart(8)} | ${chalk.gray('65.2%').padStart(8)} | ` +
    `${chalk.cyan('+' + (parseFloat(overallAccuracy) - 65.2).toFixed(1) + '%').padStart(5)} | ` +
    `${chalk.cyan(overallROI + '%').padStart(6)}`)
  );
  
  if (totalBets > 0) {
    console.log(chalk.bold.green(`\n💰 2021 BETTING SUMMARY:`));
    console.log(chalk.green(`  Total Wagered: $${totalBets.toLocaleString()}`));
    console.log(chalk.green(`  Total Returns: $${totalReturns.toFixed(2)}`));
    console.log(chalk.green(`  Net Profit: $${(totalReturns - totalBets).toFixed(2)}`));
    console.log(chalk.green(`  ROI: ${overallROI}%`));
  }
}

// Check if pattern APIs are running
async function checkAPIs() {
  try {
    await axios.get(`${PATTERN_APIS.local}/health`);
    return true;
  } catch (error) {
    console.error(chalk.red('\n❌ Pattern detection API not running!'));
    console.log(chalk.yellow('Please start it with: npx tsx scripts/pattern-detection/production-pattern-api-v4.ts\n'));
    return false;
  }
}

async function main() {
  const apisRunning = await checkAPIs();
  if (!apisRunning) {
    process.exit(1);
  }
  
  await calculate2021Stats();
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });