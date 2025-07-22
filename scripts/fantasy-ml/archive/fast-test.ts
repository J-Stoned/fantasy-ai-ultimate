#!/usr/bin/env tsx
/**
 * Optimized Fantasy ML Test - Fast and efficient
 */

import chalk from 'chalk';

// Simple inline DFS optimizer for testing
interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  salary: number;
  points: number;
}

function optimizeLineup(players: Player[], salaryCap: number): Player[] {
  // Simple greedy algorithm - much faster than complex optimization
  const sortedPlayers = [...players].sort((a, b) => 
    (b.points / b.salary) - (a.points / a.salary)
  );
  
  const lineup: Player[] = [];
  const positions = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
  let totalSalary = 0;
  
  // Fill required positions first
  for (const player of sortedPlayers) {
    if (positions[player.position] < 1 && totalSalary + player.salary <= salaryCap) {
      lineup.push(player);
      positions[player.position]++;
      totalSalary += player.salary;
    }
  }
  
  // Fill remaining spots (utility)
  for (const player of sortedPlayers) {
    if (lineup.length >= 8) break;
    if (!lineup.includes(player) && totalSalary + player.salary <= salaryCap) {
      lineup.push(player);
      totalSalary += player.salary;
    }
  }
  
  return lineup;
}

async function fastTest() {
  console.log(chalk.cyan('⚡ Fast Fantasy ML Test\n'));
  console.log('=' .repeat(50));

  // Simplified player pool
  const players: Player[] = [
    { id: '1', name: 'LeBron James', position: 'SF', team: 'LAL', salary: 11000, points: 55 },
    { id: '2', name: 'Giannis', position: 'PF', team: 'MIL', salary: 12000, points: 60 },
    { id: '3', name: 'Curry', position: 'PG', team: 'GSW', salary: 10000, points: 48 },
    { id: '4', name: 'Jokic', position: 'C', team: 'DEN', salary: 11500, points: 58 },
    { id: '5', name: 'Lillard', position: 'PG', team: 'MIL', salary: 8500, points: 42 },
    { id: '6', name: 'Booker', position: 'SG', team: 'PHX', salary: 8000, points: 40 },
    { id: '7', name: 'Davis', position: 'PF', team: 'LAL', salary: 9500, points: 48 },
    { id: '8', name: 'Tatum', position: 'SF', team: 'BOS', salary: 9000, points: 45 },
    { id: '9', name: 'Herro', position: 'SG', team: 'MIA', salary: 6500, points: 32 },
    { id: '10', name: 'Allen', position: 'C', team: 'CLE', salary: 7000, points: 35 },
    { id: '11', name: 'Brunson', position: 'PG', team: 'NYK', salary: 7500, points: 38 },
    { id: '12', name: 'McCollum', position: 'SG', team: 'NOP', salary: 7000, points: 36 },
    { id: '13', name: 'Butler', position: 'SF', team: 'MIA', salary: 8500, points: 44 },
    { id: '14', name: 'Zion', position: 'PF', team: 'NOP', salary: 9000, points: 46 }
  ];

  console.log(chalk.yellow('🏀 Optimizing DFS Lineup...\n'));
  
  const startTime = Date.now();
  const lineup = optimizeLineup(players, 50000);
  const endTime = Date.now();
  
  // Display results
  console.log(chalk.green('✅ Optimal Lineup:\n'));
  
  let totalSalary = 0;
  let totalPoints = 0;
  
  lineup.forEach(player => {
    console.log(
      `${player.position.padEnd(3)} ${player.name.padEnd(15)} ` +
      `$${player.salary.toString().padStart(5)} ${player.points.toFixed(0).padStart(3)} pts`
    );
    totalSalary += player.salary;
    totalPoints += player.points;
  });
  
  console.log(chalk.yellow('\n' + '─'.repeat(40)));
  console.log(chalk.yellow(
    `Total: $${totalSalary}/50000  ${totalPoints.toFixed(0)} pts`
  ));
  console.log(chalk.green(
    `\n⚡ Optimization time: ${endTime - startTime}ms`
  ));
  
  // Test TensorFlow loading (but don't actually use it yet)
  console.log(chalk.yellow('\n🧠 Testing TensorFlow...'));
  try {
    const tf = await import('@tensorflow/tfjs-node');
    console.log(chalk.green('✅ TensorFlow ready'));
    console.log(chalk.cyan(`   Version: ${tf.version.tfjs}`));
  } catch (error) {
    console.log(chalk.red('❌ TensorFlow not available'));
  }
  
  console.log(chalk.green('\n✅ Test complete!'));
  console.log(chalk.yellow('\nPerformance tips:'));
  console.log('1. Use --max-old-space-size=4096 for more memory');
  console.log('2. Close other applications to free up RAM');
  console.log('3. Use production builds for better performance');
  console.log('4. Consider using Redis for caching');
}

// Run with error handling
fastTest().then(() => {
  process.exit(0);
}).catch(error => {
  console.error(chalk.red('💥 Error:'), error);
  process.exit(1);
});