#!/usr/bin/env tsx
/**
 * 🔧 FIX DUPLICATES - Ensure unique data collection
 */

import { pgPool } from '../fantasy-ml/config/database';
import chalk from 'chalk';

async function fixDuplicates() {
  console.log(chalk.cyan.bold('\n🔧 FIXING DUPLICATE PREVENTION\n'));
  
  try {
    // 1. Check current duplicates
    console.log(chalk.yellow('📊 Checking for duplicates...'));
    
    // Check duplicate teams
    const dupTeams = await pgPool.query(`
      SELECT sport, name, COUNT(*) as count 
      FROM teams_master 
      GROUP BY sport, name 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    
    if (dupTeams.rows.length > 0) {
      console.log(chalk.red('\n❌ Duplicate teams found:'));
      dupTeams.rows.forEach(row => {
        console.log(`  ${row.sport} - ${row.name}: ${row.count} copies`);
      });
    } else {
      console.log(chalk.green('✓ No duplicate teams'));
    }
    
    // Check duplicate players
    const dupPlayers = await pgPool.query(`
      SELECT sport, name, COUNT(*) as count 
      FROM players_master 
      WHERE name IS NOT NULL
      GROUP BY sport, name 
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 10
    `);
    
    if (dupPlayers.rows.length > 0) {
      console.log(chalk.red('\n❌ Duplicate players found (top 10):'));
      dupPlayers.rows.forEach(row => {
        console.log(`  ${row.sport} - ${row.name}: ${row.count} copies`);
      });
    } else {
      console.log(chalk.green('✓ No duplicate players'));
    }
    
    // 2. Add unique constraints if missing
    console.log(chalk.yellow('\n🔒 Adding unique constraints...'));
    
    const constraints = [
      {
        table: 'teams_master',
        name: 'teams_unique_espn_sport',
        columns: '(espn_id, sport)',
        condition: 'WHERE espn_id IS NOT NULL'
      },
      {
        table: 'players_master',
        name: 'players_unique_espn_sport',
        columns: '(espn_id, sport)',
        condition: 'WHERE espn_id IS NOT NULL'
      },
      {
        table: 'games_master',
        name: 'games_unique_espn_sport',
        columns: '(espn_game_id, sport)',
        condition: 'WHERE espn_game_id IS NOT NULL'
      }
    ];
    
    for (const constraint of constraints) {
      try {
        await pgPool.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS ${constraint.name} 
          ON ${constraint.table} ${constraint.columns}
          ${constraint.condition}
        `);
        console.log(chalk.green(`✓ Added constraint: ${constraint.name}`));
      } catch (error: any) {
        if (error.code === '23505') {
          console.log(chalk.yellow(`⚠️  Duplicates exist, cleaning first: ${constraint.table}`));
          // Remove duplicates keeping the first one
          await cleanDuplicates(constraint.table, constraint.columns.replace(/[()]/g, '').split(', '));
        }
      }
    }
    
    // 3. Show final counts
    console.log(chalk.cyan('\n📊 Final database state:'));
    const stats = await pgPool.query(`
      SELECT 
        (SELECT COUNT(DISTINCT our_team_id) FROM teams_master) as unique_teams,
        (SELECT COUNT(DISTINCT our_player_id) FROM players_master) as unique_players,
        (SELECT COUNT(DISTINCT our_game_id) FROM games_master) as unique_games,
        (SELECT COUNT(*) FROM player_game_stats) as stats
    `);
    
    const row = stats.rows[0];
    console.log(`  Unique Teams: ${parseInt(row.unique_teams).toLocaleString()}`);
    console.log(`  Unique Players: ${parseInt(row.unique_players).toLocaleString()}`);
    console.log(`  Unique Games: ${parseInt(row.unique_games).toLocaleString()}`);
    console.log(`  Game Stats: ${parseInt(row.stats).toLocaleString()}`);
    
    console.log(chalk.green.bold('\n✅ Duplicate prevention complete!\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  } finally {
    await pgPool.end();
  }
}

async function cleanDuplicates(table: string, columns: string[]) {
  // Delete duplicates keeping the one with lowest ID
  const query = `
    DELETE FROM ${table} a
    USING ${table} b
    WHERE a.id > b.id
    AND ${columns.map(col => `a.${col} = b.${col}`).join(' AND ')}
  `;
  
  const result = await pgPool.query(query);
  console.log(chalk.green(`  Removed ${result.rowCount} duplicate records from ${table}`));
}

// Fix the bulk insert function in phase2-parallel-engine.ts
console.log(chalk.cyan('\n📝 To fix bulk insert duplicates:'));
console.log('1. Deduplicate data BEFORE inserting');
console.log('2. Use smaller batch sizes');
console.log('3. Handle conflicts properly');
console.log('\nThe issue is multiple records with same our_player_id in one batch!');

fixDuplicates().catch(console.error);