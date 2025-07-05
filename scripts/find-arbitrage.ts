#!/usr/bin/env tsx
/**
 * 💰 FIND ARBITRAGE OPPORTUNITIES
 * Demonstrates arbitrage detection with real examples
 */

import chalk from 'chalk';
import { ArbitrageDetector } from '../lib/betting/arbitrage-detector';

async function findArbitrage() {
  console.log(chalk.bold.cyan('💰 ARBITRAGE OPPORTUNITY FINDER\n'));
  
  const detector = new ArbitrageDetector();
  
  // Example 1: Clear arbitrage opportunity
  console.log(chalk.bold.yellow('Example 1: Lakers vs Celtics\n'));
  
  const lakersVsCeltics = [
    {
      bookmaker: 'DraftKings',
      markets: {
        h2h: {
          home: 120,  // Lakers +120
          away: -105  // Celtics -105
        }
      }
    },
    {
      bookmaker: 'FanDuel',
      markets: {
        h2h: {
          home: 110,  // Lakers +110
          away: -102  // Celtics -102
        }
      }
    },
    {
      bookmaker: 'BetMGM',
      markets: {
        h2h: {
          home: 115,  // Lakers +115
          away: -110  // Celtics -110
        }
      }
    }
  ];
  
  const opportunity1 = detector.analyzeOdds(lakersVsCeltics);
  
  if (opportunity1) {
    displayOpportunity(opportunity1, 'Lakers', 'Celtics');
  } else {
    console.log(chalk.gray('No arbitrage opportunity found\n'));
  }
  
  // Example 2: 3-way market (soccer)
  console.log(chalk.bold.yellow('Example 2: Real Madrid vs Barcelona (with Draw)\n'));
  
  const realVsBarca = [
    {
      bookmaker: 'Bet365',
      markets: {
        h2h: {
          home: 150,   // Real Madrid +150
          away: 180,   // Barcelona +180
          draw: 220    // Draw +220
        }
      }
    },
    {
      bookmaker: 'William Hill',
      markets: {
        h2h: {
          home: 160,   // Real Madrid +160
          away: 170,   // Barcelona +170
          draw: 210    // Draw +210
        }
      }
    },
    {
      bookmaker: 'Pinnacle',
      markets: {
        h2h: {
          home: 155,   // Real Madrid +155
          away: 175,   // Barcelona +175
          draw: 225    // Draw +225
        }
      }
    }
  ];
  
  const opportunity2 = detector.analyzeOdds(realVsBarca);
  
  if (opportunity2) {
    displayOpportunity(opportunity2, 'Real Madrid', 'Barcelona');
  } else {
    console.log(chalk.gray('No arbitrage opportunity found\n'));
  }
  
  // Example 3: Significant arbitrage (rare but real)
  console.log(chalk.bold.yellow('Example 3: Warriors vs Nets (Market Inefficiency)\n'));
  
  const warriorsVsNets = [
    {
      bookmaker: 'New Sportsbook',
      markets: {
        h2h: {
          home: -105,  // Warriors -105 (mistake by bookmaker)
          away: 200    // Nets +200
        }
      }
    },
    {
      bookmaker: 'Caesars',
      markets: {
        h2h: {
          home: -180,  // Warriors -180
          away: 220    // Nets +220 (generous odds)
        }
      }
    }
  ];
  
  const opportunity3 = detector.analyzeOdds(warriorsVsNets);
  
  if (opportunity3) {
    displayOpportunity(opportunity3, 'Warriors', 'Nets');
    console.log(chalk.bold.red('⚡ RARE OPPORTUNITY - Act fast before odds adjust!'));
  }
  
  // Start monitoring (demo mode)
  console.log(chalk.bold.cyan('\n🔍 Starting Arbitrage Monitor (Demo Mode)...\n'));
  
  // Simulate finding opportunities
  let checkCount = 0;
  const demoInterval = setInterval(() => {
    checkCount++;
    const time = new Date().toLocaleTimeString();
    
    if (checkCount % 5 === 0) {
      // Simulate finding an opportunity every 5 checks
      console.log(chalk.bold.green(`\n[${time}] 🎯 ARBITRAGE ALERT!`));
      console.log(chalk.yellow('Heat vs Knicks - 2.3% profit opportunity'));
      console.log(chalk.cyan('Bet $1000 across 2 bookmakers → Guaranteed $1023'));
      console.log(chalk.gray('Window: ~10 minutes\n'));
    } else {
      console.log(chalk.gray(`[${time}] Scanning odds... No opportunities found`));
    }
    
    if (checkCount >= 10) {
      clearInterval(demoInterval);
      console.log(chalk.bold.green('\n✅ Demo complete!'));
      console.log(chalk.cyan('\nTo monitor real odds:'));
      console.log(chalk.gray('1. Get API key from the-odds-api.com'));
      console.log(chalk.gray('2. Run: npx tsx scripts/monitor-arbitrage.ts'));
    }
  }, 2000); // Check every 2 seconds in demo
}

function displayOpportunity(opp: any, homeTeam: string, awayTeam: string) {
  console.log(chalk.bold.green('✅ Arbitrage Opportunity Found!\n'));
  
  console.log(chalk.bold(`${homeTeam} vs ${awayTeam}`));
  console.log(chalk.green(`💰 Guaranteed Profit: ${opp.profit.toFixed(2)}%`));
  console.log(chalk.yellow(`💵 Invest: $${opp.investment.toFixed(2)} → Get: $${opp.returns.toFixed(2)}`));
  console.log(chalk.cyan(`📈 Profit: $${(opp.returns - opp.investment).toFixed(2)}`));
  
  console.log(chalk.bold('\n🎲 Betting Instructions:'));
  opp.bets.forEach((bet: any) => {
    const team = bet.outcome === 'home' ? homeTeam : 
                 bet.outcome === 'away' ? awayTeam : 'Draw';
    console.log(`  ${team}: Bet $${bet.stake.toFixed(2)} @ ${bet.odds} on ${bet.bookmaker}`);
    console.log(`    → Returns $${bet.payout.toFixed(2)} if ${team} wins`);
  });
  
  console.log(chalk.gray(`\n⚠️  Risk Level: ${opp.riskLevel}`));
  console.log(chalk.gray(`⏱️  Act within ${opp.timeWindow} minutes before odds change`));
  console.log(chalk.gray(`📊 Market Inefficiency: ${(opp.marketInefficiency * 100).toFixed(1)}%`));
  console.log('');
}

findArbitrage().catch(console.error);