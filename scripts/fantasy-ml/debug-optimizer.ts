#!/usr/bin/env tsx
/**
 * Debug the optimizer to see why duplicates happen
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Simple optimizer for debugging
function debugOptimizer(players: any[], constraints: any) {
  console.log(chalk.yellow('\n🔍 Debug Optimizer'));
  
  // Group by position
  const byPosition = new Map<string, any[]>();
  players.forEach(p => {
    if (!byPosition.has(p.position)) {
      byPosition.set(p.position, []);
    }
    byPosition.get(p.position)!.push(p);
  });
  
  // Sort each position by value
  byPosition.forEach(posPlayers => {
    posPlayers.sort((a, b) => (b.projected_points / b.salary) - (a.projected_points / a.salary));
  });
  
  const lineup: any[] = [];
  const usedIds = new Set<string>();
  let totalSalary = 0;
  
  // Try to fill positions
  for (const [position, required] of constraints.positions) {
    console.log(chalk.cyan(`\nFilling ${required} ${position} spots:`));
    const posPlayers = byPosition.get(position) || [];
    console.log(`  Available: ${posPlayers.length} players`);
    
    let added = 0;
    for (const player of posPlayers) {
      // Debug each selection attempt
      console.log(`  Checking: ${player.name} (ID: ${player.id})`);
      console.log(`    Salary: $${player.salary} (Total would be: $${totalSalary + player.salary})`);
      console.log(`    Already used: ${usedIds.has(player.id)}`);
      
      if (totalSalary + player.salary <= constraints.salary_cap && !usedIds.has(player.id)) {
        lineup.push(player);
        usedIds.add(player.id);
        totalSalary += player.salary;
        added++;
        console.log(chalk.green(`    ✅ Added! (${added}/${required})`));
        
        if (added >= required) break;
      } else {
        console.log(chalk.red(`    ❌ Skipped`));
      }
    }
    
    if (added < required) {
      console.log(chalk.red(`  ⚠️  Could only fill ${added}/${required} spots!`));
    }
  }
  
  return lineup;
}

async function debugDFS() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Load top 20 players
    console.log(chalk.yellow('Loading top 20 players...'));
    const query = `
      SELECT 
        player_id as id,
        player_name as name,
        position,
        team,
        salary,
        projected_points
      FROM dfs_salaries
      ORDER BY projected_points DESC
      LIMIT 20;
    `;
    
    const result = await client.query(query);
    const players = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      position: row.position,
      team: row.team,
      salary: Number(row.salary),
      projected_points: Number(row.projected_points)
    }));
    
    console.log('\nTop players:');
    players.forEach((p, i) => {
      console.log(`${i+1}. ${p.name} (${p.position}) - ID: ${p.id} - $${p.salary} - ${p.projected_points.toFixed(1)} pts`);
    });
    
    // Test with simple constraints
    const constraints = {
      salary_cap: 50000,
      positions: new Map([['UTIL', 8]])
    };
    
    const lineup = debugOptimizer(players, constraints);
    
    console.log(chalk.green('\n\nFinal Lineup:'));
    lineup.forEach(p => {
      console.log(`  ${p.name} (${p.position}) - $${p.salary} - ${p.projected_points.toFixed(1)} pts`);
    });
    console.log(`Total Salary: $${lineup.reduce((sum, p) => sum + p.salary, 0)}`);
    
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  } finally {
    await client.end();
  }
}

debugDFS().catch(console.error);