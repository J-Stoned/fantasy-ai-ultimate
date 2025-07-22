#!/usr/bin/env tsx
/**
 * Fix stats collectors to match actual database schema
 */

import pgPool from './pg-config';
import chalk from 'chalk';

async function fixStatsCollectors() {
  try {
    console.log(chalk.yellow('🔧 Fixing stats collectors to match database schema...\n'));
    
    // First, let's see what columns we actually have
    const columns = await pgPool.query(`
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_name = 'player_game_stats'
      ORDER BY ordinal_position
    `);
    
    console.log(chalk.cyan('Available columns in player_game_stats:'));
    const columnNames = columns.rows.map(col => col.column_name);
    columnNames.forEach(col => console.log(`  - ${col}`));
    
    // Check if we need to add missing columns
    const missingColumns = ['played', 'data_source', 'confidence_score'];
    const toAdd = missingColumns.filter(col => !columnNames.includes(col));
    
    if (toAdd.length > 0) {
      console.log(chalk.yellow('\n📝 Adding missing columns...'));
      
      for (const col of toAdd) {
        try {
          if (col === 'played') {
            await pgPool.query(`ALTER TABLE player_game_stats ADD COLUMN played BOOLEAN DEFAULT true`);
            console.log(chalk.green(`  ✅ Added column: ${col}`));
          } else if (col === 'data_source') {
            await pgPool.query(`ALTER TABLE player_game_stats ADD COLUMN data_source VARCHAR(50)`);
            console.log(chalk.green(`  ✅ Added column: ${col}`));
          } else if (col === 'confidence_score') {
            await pgPool.query(`ALTER TABLE player_game_stats ADD COLUMN confidence_score NUMERIC(3,2) DEFAULT 0.95`);
            console.log(chalk.green(`  ✅ Added column: ${col}`));
          }
        } catch (err: any) {
          if (err.code === '42701') { // column already exists
            console.log(chalk.gray(`  ⏭️  Column ${col} already exists`));
          } else {
            throw err;
          }
        }
      }
    }
    
    // Now let's create a proper test insert
    console.log(chalk.yellow('\n🧪 Testing insert with correct schema...'));
    
    const player = await pgPool.query(`
      SELECT id FROM players_master WHERE sport = 'NBA' LIMIT 1
    `);
    
    const game = await pgPool.query(`
      SELECT id FROM games_master WHERE sport = 'NBA' AND status = 'STATUS_FINAL' LIMIT 1
    `);
    
    if (player.rows.length && game.rows.length) {
      // Delete any existing record first
      await pgPool.query(
        `DELETE FROM player_game_stats WHERE game_id = $1 AND player_id = $2`,
        [game.rows[0].id, player.rows[0].id]
      );
      
      const testInsert = await pgPool.query(
        `INSERT INTO player_game_stats (
          game_id, player_id, team_id, sport, season, 
          position, started, minutes_played, stats,
          played, data_source, confidence_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (game_id, player_id) DO UPDATE 
        SET stats = EXCLUDED.stats, updated_at = NOW()
        RETURNING id`,
        [
          game.rows[0].id,    // game_id FIRST
          player.rows[0].id,  // player_id SECOND
          1,                  // team_id
          'NBA',              // sport
          2024,               // season
          'G',                // position
          false,              // started
          20,                 // minutes_played
          { points: 10, rebounds: 5, assists: 3 }, // stats
          true,               // played
          'test',             // data_source
          0.99                // confidence_score
        ]
      );
      
      console.log(chalk.green('✅ Test insert successful! ID:', testInsert.rows[0].id));
      
      // Verify
      const verify = await pgPool.query(`
        SELECT COUNT(*) as count FROM player_game_stats WHERE sport = 'NBA'
      `);
      
      console.log(chalk.cyan(`Total NBA stats now: ${verify.rows[0].count}`));
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await pgPool.end();
  }
}

fixStatsCollectors();