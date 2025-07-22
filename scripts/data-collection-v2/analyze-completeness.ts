#!/usr/bin/env tsx
/**
 * 🔍 ANALYZE COLLECTION COMPLETENESS
 * Check if we have all expected games
 */

import { pgPool } from '../fantasy-ml/config/database';
import chalk from 'chalk';

async function analyzeCompleteness() {
  console.log(chalk.cyan.bold('\n🔍 COLLECTION COMPLETENESS ANALYSIS\n'));
  
  try {
    // Get our actual collection
    const actual = await pgPool.query(`
      SELECT sport, season, COUNT(*) as games
      FROM games_master 
      GROUP BY sport, season 
      ORDER BY sport, season
    `);
    
    console.log(chalk.yellow('📊 Our Current Collection:'));
    let totalActual = 0;
    actual.rows.forEach(row => {
      const count = parseInt(row.games);
      totalActual += count;
      console.log(`  ${row.sport} ${row.season}: ${count.toLocaleString()} games`);
    });
    console.log(chalk.cyan(`  TOTAL: ${totalActual.toLocaleString()} games\n`));
    
    // Expected games per sport/season
    const expected = {
      'NFL': {
        2020: 269, // COVID shortened
        2021: 285, // 17-game season
        2022: 285,
        2023: 285,
        2024: 285,
        total: 1409
      },
      'NBA': {
        2020: 1059, // Bubble season
        2021: 1230, // 72-game season  
        2022: 1312, // Full season
        2023: 1312,
        2024: 1312,
        total: 6225
      },
      'NHL': {
        2020: 868, // Shortened
        2021: 1312,
        2022: 1312, 
        2023: 1312,
        2024: 1312,
        total: 6116
      },
      'MLB': {
        2020: 900, // 60-game season
        2021: 2430,
        2022: 2430,
        2023: 2430, 
        2024: 2430,
        total: 10620
      },
      'NCAAB': {
        '2022-23': 5500, // ~350 teams x ~30 games
        '2023-24': 5500,
        '2024-25': 3000, // Partial season
        total: 14000
      },
      'NCAAF': {
        2022: 900, // ~130 FBS teams x ~12 games
        2023: 900,
        2024: 900,
        total: 2700
      }
    };
    
    console.log(chalk.yellow('📈 Expected vs Actual Analysis:\n'));
    
    let totalExpected = 0;
    let analysis: any = {};
    
    // Analyze each sport
    for (const [sport, seasons] of Object.entries(expected)) {
      const sportActual = actual.rows.filter(row => row.sport === sport);
      const actualTotal = sportActual.reduce((sum, row) => sum + parseInt(row.games), 0);
      
      totalExpected += seasons.total;
      analysis[sport] = {
        expected: seasons.total,
        actual: actualTotal,
        percentage: (actualTotal / seasons.total * 100).toFixed(1),
        missing: seasons.total - actualTotal
      };
      
      const status = actualTotal > seasons.total * 0.8 ? '✅' : 
                    actualTotal > seasons.total * 0.5 ? '⚠️' : '❌';
      
      console.log(`${status} ${sport}:`);
      console.log(`    Expected: ${seasons.total.toLocaleString()}`);
      console.log(`    Actual: ${actualTotal.toLocaleString()}`);
      console.log(`    Coverage: ${analysis[sport].percentage}%`);
      console.log(`    Missing: ${analysis[sport].missing.toLocaleString()}\n`);
    }
    
    console.log(chalk.cyan.bold('📊 OVERALL SUMMARY:'));
    console.log(`  Expected Total: ${totalExpected.toLocaleString()} games`);
    console.log(`  Actual Total: ${totalActual.toLocaleString()} games`);
    console.log(`  Overall Coverage: ${(totalActual / totalExpected * 100).toFixed(1)}%`);
    console.log(`  Missing: ${(totalExpected - totalActual).toLocaleString()} games\n`);
    
    // Issues to investigate
    console.log(chalk.red.bold('🔍 ISSUES TO INVESTIGATE:\n'));
    
    if (analysis.MLB.actual === 0) {
      console.log('❌ MLB: 0 games collected - API endpoint issue');
    }
    
    if (analysis.NHL.percentage < 50) {
      console.log('❌ NHL: Low collection - may need more seasons');
    }
    
    if (analysis.NBA.percentage < 80) {
      console.log('⚠️ NBA: Missing some seasons or games');
    }
    
    if (analysis.NFL.percentage < 80) {
      console.log('⚠️ NFL: Missing some seasons');
    }
    
    console.log(chalk.green.bold('\n✅ NEXT STEPS:'));
    console.log('1. Fix MLB API endpoint (10K+ games missing)');
    console.log('2. Add missing NHL/NBA seasons');
    console.log('3. Add Minor League Baseball (20K+ games)');
    console.log('4. Add NCAA Baseball/Hockey (15K+ games)');
    console.log('5. Target: 50K+ total games\n');
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  } finally {
    await pgPool.end();
  }
}

analyzeCompleteness();