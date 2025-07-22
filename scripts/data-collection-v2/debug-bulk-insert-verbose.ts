#!/usr/bin/env tsx
/**
 * Debug bulk insert with VERY verbose logging
 */

import pgPool from './pg-config';
import chalk from 'chalk';

async function debugBulkInsertVerbose() {
  try {
    console.log(chalk.yellow('🔍 Testing bulk insert with verbose logging...\n'));
    
    // Test data
    const testData = [
      {
        game_id: 7170,
        player_id: 421,
        team_id: 1,
        sport: 'NBA',
        season: 2024,
        position: 'G',
        started: false,
        minutes_played: 25,
        stats: { points: 15, rebounds: 7, assists: 4 },
        played: true,
        data_source: 'verbose_test',
        confidence_score: 0.99
      },
      {
        game_id: 7171,
        player_id: 422,
        team_id: 1,
        sport: 'NBA',
        season: 2024,
        position: 'F',
        started: true,
        minutes_played: 30,
        stats: { points: 20, rebounds: 10, assists: 2 },
        played: true,
        data_source: 'verbose_test',
        confidence_score: 0.99
      }
    ];
    
    // Build multi-row insert
    const columns = Object.keys(testData[0]);
    console.log(chalk.cyan('Columns:'), columns);
    
    // Build values placeholders
    const valuePlaceholders = testData.map((row, i) => 
      '(' + columns.map((col, j) => `$${i * columns.length + j + 1}`).join(', ') + ')'
    ).join(', ');
    
    console.log(chalk.cyan('Value placeholders:'), valuePlaceholders);
    
    // Flatten values
    const flatValues = testData.flatMap(row => columns.map(col => row[col]));
    console.log(chalk.cyan('Flat values:'), flatValues);
    
    const query = `
      INSERT INTO player_game_stats (${columns.join(', ')})
      VALUES ${valuePlaceholders}
      ON CONFLICT (game_id, player_id) DO UPDATE 
      SET stats = EXCLUDED.stats, 
          updated_at = NOW(),
          played = EXCLUDED.played,
          started = EXCLUDED.started,
          position = EXCLUDED.position,
          minutes_played = EXCLUDED.minutes_played
      RETURNING id, game_id, player_id
    `;
    
    console.log(chalk.yellow('\nFull query:'), query);
    
    // Execute
    console.log(chalk.yellow('\nExecuting query...'));
    const result = await pgPool.query(query, flatValues);
    
    console.log(chalk.green('\n✅ Query executed successfully!'));
    console.log('Result rows:', result.rows);
    console.log('Row count:', result.rowCount);
    console.log('Command:', result.command);
    
    // Immediate check
    console.log(chalk.yellow('\nImmediate check...'));
    const check1 = await pgPool.query(`
      SELECT COUNT(*) as count 
      FROM player_game_stats 
      WHERE data_source = 'verbose_test'
    `);
    console.log(chalk.cyan(`Records found immediately: ${check1.rows[0].count}`));
    
    // Check with different query
    const check2 = await pgPool.query(`
      SELECT id, game_id, player_id, sport, data_source 
      FROM player_game_stats 
      WHERE sport = 'NBA'
      ORDER BY id DESC
      LIMIT 10
    `);
    console.log(chalk.cyan('\nLatest NBA records:'));
    check2.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Game: ${row.game_id}, Player: ${row.player_id}, Source: ${row.data_source}`);
    });
    
    // Total count
    const total = await pgPool.query('SELECT COUNT(*) as count FROM player_game_stats');
    console.log(chalk.green(`\nTotal stats in database: ${total.rows[0].count}`));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await pgPool.end();
  }
}

debugBulkInsertVerbose();