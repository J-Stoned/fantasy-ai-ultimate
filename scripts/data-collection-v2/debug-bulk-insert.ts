#!/usr/bin/env tsx
/**
 * Debug bulk insert with detailed logging
 */

import pgPool from './pg-config';
import chalk from 'chalk';

async function debugBulkInsert() {
  try {
    console.log(chalk.yellow('🔍 Debugging bulk insert with detailed logging...\n'));
    
    // Create test data
    const testData = [{
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
      data_source: 'debug_test',
      confidence_score: 0.99
    }];
    
    console.log(chalk.cyan('Test data:'), testData);
    
    // Build query manually
    const columns = Object.keys(testData[0]);
    const values = columns.map((col, i) => `$${i + 1}`).join(', ');
    const flatValues = columns.map(col => testData[0][col]);
    
    const query = `
      INSERT INTO player_game_stats (${columns.join(', ')})
      VALUES (${values})
      ON CONFLICT (game_id, player_id) DO UPDATE 
      SET stats = EXCLUDED.stats, updated_at = NOW()
      RETURNING id
    `;
    
    console.log(chalk.yellow('\nQuery:'), query);
    console.log(chalk.yellow('Values:'), flatValues);
    
    try {
      const result = await pgPool.query(query, flatValues);
      console.log(chalk.green('\n✅ Insert successful!'));
      console.log('Result:', result.rows);
      console.log('Row count:', result.rowCount);
    } catch (insertError: any) {
      console.error(chalk.red('\n❌ Insert failed:'));
      console.error('Code:', insertError.code);
      console.error('Message:', insertError.message);
      console.error('Detail:', insertError.detail);
      console.error('Hint:', insertError.hint);
    }
    
    // Check if it's in the database
    const check = await pgPool.query(`
      SELECT COUNT(*) as count 
      FROM player_game_stats 
      WHERE data_source = 'debug_test'
    `);
    
    console.log(chalk.cyan(`\nRecords with data_source='debug_test': ${check.rows[0].count}`));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await pgPool.end();
  }
}

debugBulkInsert();