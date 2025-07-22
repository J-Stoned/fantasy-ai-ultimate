#!/usr/bin/env tsx
/**
 * Ultra-optimized Fantasy ML Test - Maximum efficiency
 * Designed for low CPU and RAM usage
 */

import chalk from 'chalk';

// Minimal player data structure
interface P {
  n: string;  // name
  p: string;  // position
  t: string;  // team
  s: number;  // salary
  v: number;  // value (points)
}

// Ultra-fast lineup optimizer - O(n) complexity
function optimize(players: P[], cap: number): P[] {
  // Pre-calculate value ratios
  const sorted = players.map(p => ({
    ...p,
    r: p.v / p.s  // ratio
  })).sort((a, b) => b.r - a.r);
  
  const lineup: P[] = [];
  const pos: Record<string, number> = {};
  let spent = 0;
  
  // Single pass - no backtracking
  for (const p of sorted) {
    if (spent + p.s > cap) continue;
    if (lineup.length >= 8) break;
    
    // Position limit check
    const count = pos[p.p] || 0;
    if (count >= (p.p === 'UTIL' ? 3 : 1)) continue;
    
    lineup.push(p);
    pos[p.p] = count + 1;
    spent += p.s;
  }
  
  return lineup;
}

// Main test function
async function test() {
  const start = process.hrtime.bigint();
  
  console.log(chalk.cyan('⚡ Ultra-Fast Fantasy ML Test\n'));
  
  // Minimal test data (DraftKings format: PG,SG,SF,PF,C,G,F,UTIL)
  const players: P[] = [
    { n: 'LeBron', p: 'SF', t: 'LAL', s: 11000, v: 55 },
    { n: 'Giannis', p: 'PF', t: 'MIL', s: 12000, v: 60 },
    { n: 'Curry', p: 'PG', t: 'GSW', s: 10000, v: 48 },
    { n: 'Jokic', p: 'C', t: 'DEN', s: 11500, v: 58 },
    { n: 'Lillard', p: 'PG', t: 'MIL', s: 8500, v: 42 },
    { n: 'Booker', p: 'SG', t: 'PHX', s: 8000, v: 40 },
    { n: 'Davis', p: 'PF', t: 'LAL', s: 9500, v: 48 },
    { n: 'Tatum', p: 'SF', t: 'BOS', s: 9000, v: 45 },
    { n: 'Herro', p: 'SG', t: 'MIA', s: 6500, v: 32 },
    { n: 'Allen', p: 'C', t: 'CLE', s: 7000, v: 35 },
    { n: 'Brunson', p: 'G', t: 'NYK', s: 7500, v: 38 },
    { n: 'Butler', p: 'F', t: 'MIA', s: 8500, v: 44 },
    { n: 'Zion', p: 'F', t: 'NOP', s: 9000, v: 46 },
    { n: 'Mitchell', p: 'G', t: 'CLE', s: 7800, v: 41 },
    { n: 'Brown', p: 'F', t: 'BOS', s: 8200, v: 42 },
    { n: 'Bam', p: 'UTIL', t: 'MIA', s: 8000, v: 40 },
    { n: 'Fox', p: 'UTIL', t: 'SAC', s: 7700, v: 39 },
    { n: 'Turner', p: 'UTIL', t: 'IND', s: 6800, v: 34 }
  ];
  
  // Run optimizer
  const lineup = optimize(players, 50000);
  
  // Display results (minimal formatting)
  console.log(chalk.green('Lineup:\n'));
  let total = 0, points = 0;
  
  lineup.forEach(p => {
    console.log(`${p.p} ${p.n} $${p.s} ${p.v}pts`);
    total += p.s;
    points += p.v;
  });
  
  console.log(chalk.yellow(`\nTotal: $${total}/50000 ${points}pts`));
  
  // Performance metrics
  const end = process.hrtime.bigint();
  const ms = Number(end - start) / 1_000_000;
  
  console.log(chalk.green(`\nTime: ${ms.toFixed(2)}ms`));
  
  // Memory usage
  const mem = process.memoryUsage();
  console.log(chalk.cyan(`Memory: ${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB`));
  
  console.log(chalk.green('\n✅ Done!'));
}

// Execute
test().catch(e => {
  console.error(chalk.red('Error:'), e.message);
  process.exit(1);
});