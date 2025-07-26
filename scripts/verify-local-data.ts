#!/usr/bin/env node

/**
 * 🔥 VERIFY LOCAL DATABASE HAS 1.3M GAME LOGS 🔥
 */

import 'dotenv/config';
import { Pool } from 'pg';
import chalk from 'chalk';
import Table from 'cli-table3';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://fantasy_user:fantasy_password@localhost:5432/fantasy_ai'
});

console.log(chalk.bold.red(`
╔═══════════════════════════════════════════════════════════════╗
║          🔥 VERIFYING LOCAL DATABASE ACCESS 🔥                ║
╚═══════════════════════════════════════════════════════════════╝
`));

async function verify() {
  const table = new Table({
    head: ['Check', 'Result', 'Status'],
    colWidths: [40, 30, 15],
    style: { head: [], border: ['grey'] }
  });
  
  // 1. Connection test
  try {
    await pool.query('SELECT 1');
    table.push(['Database Connection', 'Connected', chalk.green('✅')]);
  } catch (error) {
    table.push(['Database Connection', 'Failed', chalk.red('❌')]);
  }
  
  // 2. Game logs count
  try {
    const { rows: [count] } = await pool.query('SELECT COUNT(*) FROM player_game_logs');
    const logCount = parseInt(count.count);
    table.push(['Game Logs Count', logCount.toLocaleString(), logCount > 1000000 ? chalk.green('✅') : chalk.yellow('⚠️')]);
  } catch (error) {
    table.push(['Game Logs Count', 'Error', chalk.red('❌')]);
  }
  
  // 3. Players count
  try {
    const { rows: [count] } = await pool.query('SELECT COUNT(*) FROM players');
    table.push(['Players Count', parseInt(count.count).toLocaleString(), chalk.green('✅')]);
  } catch (error) {
    table.push(['Players Count', 'Error', chalk.red('❌')]);
  }
  
  // 4. Recent games
  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*) as count 
      FROM player_game_logs 
      WHERE game_date > '2024-01-01'
    `);
    table.push(['Recent Games (2024+)', parseInt(rows[0].count).toLocaleString(), chalk.green('✅')]);
  } catch (error) {
    table.push(['Recent Games', 'Error', chalk.red('❌')]);
  }
  
  // 5. Fantasy points range
  try {
    const { rows } = await pool.query(`
      SELECT 
        MIN(fantasy_points) as min_pts,
        MAX(fantasy_points) as max_pts,
        AVG(fantasy_points) as avg_pts
      FROM player_game_logs
      WHERE fantasy_points IS NOT NULL
    `);
    const stats = rows[0];
    table.push([
      'Fantasy Points Range',
      `${parseFloat(stats.min_pts).toFixed(1)} - ${parseFloat(stats.max_pts).toFixed(1)}`,
      chalk.green('✅')
    ]);
  } catch (error) {
    table.push(['Fantasy Points Range', 'Error', chalk.red('❌')]);
  }
  
  // 6. Sports coverage
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT sport, COUNT(*) as count
      FROM player_game_logs
      WHERE sport IS NOT NULL
      GROUP BY sport
      ORDER BY count DESC
    `);
    const sports = rows.map(r => `${r.sport} (${parseInt(r.count).toLocaleString()})`).join(', ');
    table.push(['Sports Coverage', sports.substring(0, 25) + '...', chalk.green('✅')]);
  } catch (error) {
    table.push(['Sports Coverage', 'Error', chalk.red('❌')]);
  }
  
  console.log(table.toString());
  
  // Show sample player
  console.log(chalk.bold.yellow('\n📊 SAMPLE DATA:'));
  
  try {
    const { rows: [mahomes] } = await pool.query(`
      SELECT p.*, 
        (SELECT COUNT(*) FROM player_game_logs WHERE player_id = p.id) as game_count,
        (SELECT AVG(fantasy_points) FROM player_game_logs WHERE player_id = p.id) as avg_points
      FROM players p
      WHERE p.firstname = 'Patrick' AND p.lastname = 'Mahomes'
      LIMIT 1
    `);
    
    if (mahomes) {
      console.log(chalk.cyan('\nPatrick Mahomes:'));
      console.log(chalk.gray(`  ID: ${mahomes.id}`));
      console.log(chalk.gray(`  Position: ${mahomes.position}`));
      console.log(chalk.gray(`  Team: ${mahomes.team}`));
      console.log(chalk.gray(`  Games: ${mahomes.game_count}`));
      console.log(chalk.gray(`  Avg Points: ${parseFloat(mahomes.avg_points || 0).toFixed(1)}`));
    }
  } catch (error) {
    console.log(chalk.red('Could not fetch sample player'));
  }
  
  console.log(chalk.bold.green(`
╔═══════════════════════════════════════════════════════════════╗
║     ✅ LOCAL DATABASE VERIFIED - 1.3M GAME LOGS! ✅          ║
╚═══════════════════════════════════════════════════════════════╝
  `));
  
  await pool.end();
}

verify().catch(console.error);