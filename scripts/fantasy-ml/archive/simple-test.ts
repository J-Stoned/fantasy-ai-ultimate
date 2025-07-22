#!/usr/bin/env tsx
/**
 * Simple test for Fantasy ML models - no database required
 */

import chalk from 'chalk';
import { dfsOptimizer } from './models/dfs-lineup-optimizer';
import type { DFSPlayer } from './models/dfs-lineup-optimizer';

async function simpleTest() {
  console.log(chalk.cyan('🧪 Simple Fantasy ML Test\n'));
  console.log('=' .repeat(50));

  // Test DFS Lineup Optimizer with correct interface
  console.log(chalk.yellow('\n💰 Testing DFS Lineup Optimizer...'));
  
  // Create sample players with CORRECT property names
  const samplePlayers: DFSPlayer[] = [
    {
      id: '1',
      name: 'LeBron James',
      position: 'SF',
      team: 'LAL',
      opponent: 'BOS',
      salary: 11000,
      projected_points: 55,
      projected_ownership: 25,
      floor: 45,
      ceiling: 65,
      boom_probability: 0.3
    },
    {
      id: '2',
      name: 'Giannis Antetokounmpo',
      position: 'PF',
      team: 'MIL',
      opponent: 'PHI',
      salary: 12000,
      projected_points: 60,
      projected_ownership: 30,
      floor: 48,
      ceiling: 72,
      boom_probability: 0.35
    },
    {
      id: '3',
      name: 'Stephen Curry',
      position: 'PG',
      team: 'GSW',
      opponent: 'LAL',
      salary: 10000,
      projected_points: 48,
      projected_ownership: 20,
      floor: 38,
      ceiling: 58,
      boom_probability: 0.25
    },
    {
      id: '4',
      name: 'Nikola Jokic',
      position: 'C',
      team: 'DEN',
      opponent: 'PHX',
      salary: 11500,
      projected_points: 58,
      projected_ownership: 22,
      floor: 48,
      ceiling: 68,
      boom_probability: 0.3
    },
    {
      id: '5',
      name: 'Damian Lillard',
      position: 'PG',
      team: 'MIL',
      opponent: 'PHI',
      salary: 8500,
      projected_points: 42,
      projected_ownership: 15,
      floor: 32,
      ceiling: 52,
      boom_probability: 0.2
    },
    {
      id: '6',
      name: 'Devin Booker',
      position: 'SG',
      team: 'PHX',
      opponent: 'DEN',
      salary: 8000,
      projected_points: 40,
      projected_ownership: 12,
      floor: 30,
      ceiling: 50,
      boom_probability: 0.18
    },
    {
      id: '7',
      name: 'Anthony Davis',
      position: 'PF',
      team: 'LAL',
      opponent: 'BOS',
      salary: 9500,
      projected_points: 48,
      projected_ownership: 16,
      floor: 38,
      ceiling: 58,
      boom_probability: 0.22,
      correlation_partners: ['1'] // Correlated with LeBron
    },
    {
      id: '8',
      name: 'Jayson Tatum',
      position: 'SF',
      team: 'BOS',
      opponent: 'LAL',
      salary: 9000,
      projected_points: 45,
      projected_ownership: 18,
      floor: 35,
      ceiling: 55,
      boom_probability: 0.2
    },
    {
      id: '9',
      name: 'Tyler Herro',
      position: 'SG',
      team: 'MIA',
      opponent: 'ORL',
      salary: 6500,
      projected_points: 32,
      projected_ownership: 8,
      floor: 22,
      ceiling: 42,
      boom_probability: 0.15
    },
    {
      id: '10',
      name: 'Jarrett Allen',
      position: 'C',
      team: 'CLE',
      opponent: 'DET',
      salary: 7000,
      projected_points: 35,
      projected_ownership: 10,
      floor: 25,
      ceiling: 45,
      boom_probability: 0.18
    },
    // Add more players to meet position requirements
    {
      id: '11',
      name: 'Jalen Brunson',
      position: 'PG',
      team: 'NYK',
      opponent: 'BKN',
      salary: 7500,
      projected_points: 38,
      projected_ownership: 12,
      floor: 28,
      ceiling: 48,
      boom_probability: 0.18
    },
    {
      id: '12',
      name: 'CJ McCollum',
      position: 'SG',
      team: 'NOP',
      opponent: 'MEM',
      salary: 7000,
      projected_points: 36,
      projected_ownership: 10,
      floor: 26,
      ceiling: 46,
      boom_probability: 0.17
    },
    {
      id: '13',
      name: 'Jimmy Butler',
      position: 'SF',
      team: 'MIA',
      opponent: 'ORL',
      salary: 8500,
      projected_points: 44,
      projected_ownership: 14,
      floor: 34,
      ceiling: 54,
      boom_probability: 0.2
    },
    {
      id: '14',
      name: 'Zion Williamson',
      position: 'PF',
      team: 'NOP',
      opponent: 'MEM',
      salary: 9000,
      projected_points: 46,
      projected_ownership: 16,
      floor: 36,
      ceiling: 56,
      boom_probability: 0.22
    }
  ];

  try {
    // Count players by position for debugging
    const positionCounts = new Map<string, number>();
    samplePlayers.forEach(p => {
      positionCounts.set(p.position, (positionCounts.get(p.position) || 0) + 1);
    });
    
    console.log(chalk.yellow('\nPlayer pool by position:'));
    positionCounts.forEach((count, pos) => {
      console.log(chalk.cyan(`  ${pos}: ${count} players`));
    });
    console.log(chalk.cyan(`  Total: ${samplePlayers.length} players\n`));

    // NBA DraftKings lineup constraints (8 players)
    const nbaConstraints = {
      salary_cap: 50000,
      positions: new Map([
        ['PG', 1],  // 1 PG minimum
        ['SG', 1],  // 1 SG minimum  
        ['SF', 1],  // 1 SF minimum
        ['PF', 1],  // 1 PF minimum
        ['C', 1]    // 1 C minimum
        // Plus 3 UTIL (any position) = 8 total
      ]),
      min_teams: 3,
      max_from_team: 4
    };

    // Generate optimal lineups with correct parameters
    const lineups = await dfsOptimizer.optimizeLineups(
      samplePlayers,
      nbaConstraints,
      3,  // numLineups
      'balanced'  // strategy
    );

    console.log(chalk.green(`\n✅ Generated ${lineups.length} optimal lineups!\n`));

    // Display lineups
    lineups.forEach((lineup, i) => {
      console.log(chalk.cyan(`Lineup ${i + 1}:`));
      console.log(chalk.cyan(`─────────────────────────────────────`));
      
      // Sort by position for display
      const sortedPlayers = [...lineup.players].sort((a, b) => {
        const posOrder = ['PG', 'SG', 'SF', 'PF', 'C'];
        return posOrder.indexOf(a.position) - posOrder.indexOf(b.position);
      });

      sortedPlayers.forEach(player => {
        console.log(chalk.white(
          `${player.position.padEnd(3)} ${player.name.padEnd(20)} ` +
          `$${player.salary.toString().padStart(5)} ` +
          `${player.projected_points.toFixed(1).padStart(5)} pts`
        ));
      });

      console.log(chalk.yellow(`─────────────────────────────────────`));
      console.log(chalk.yellow(
        `Total: $${lineup.total_salary.toString().padStart(5)}/50000  ` +
        `${lineup.projected_points.toFixed(1)} pts`
      ));
      console.log(chalk.green(
        `Ownership: ${lineup.projected_ownership.toFixed(1)}%  ` +
        `Leverage: ${lineup.leverage_score.toFixed(2)}`
      ));
      console.log();
    });

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }

  console.log(chalk.green('\n✅ Test complete!'));
  console.log(chalk.yellow('\nNext steps:'));
  console.log('1. Connect to your database for real data');
  console.log('2. Train ML models with: tsx scripts/fantasy-ml/train-models.ts');
  console.log('3. Start API with: tsx scripts/fantasy-ml/services/fantasy-api-service.ts');
}

// Run test
simpleTest().then(() => {
  process.exit(0);
}).catch(error => {
  console.error(chalk.red('💥 Fatal error:'), error);
  process.exit(1);
});