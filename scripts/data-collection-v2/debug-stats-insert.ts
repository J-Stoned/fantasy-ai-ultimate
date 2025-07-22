#!/usr/bin/env tsx
/**
 * Debug why stats aren't being inserted
 */

import pgPool from './pg-config';
import chalk from 'chalk';

async function debugStatsInsert() {
  try {
    console.log(chalk.yellow('🔍 Debugging stats insertion...\n'));
    
    // Check table structure
    const columns = await pgPool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'player_game_stats'
      ORDER BY ordinal_position
    `);
    
    console.log(chalk.cyan('Table structure:'));
    columns.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check constraints
    const constraints = await pgPool.query(`
      SELECT conname, contype, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'player_game_stats'::regclass
    `);
    
    console.log(chalk.cyan('\nConstraints:'));
    constraints.rows.forEach(con => {
      console.log(`  ${con.conname} (${con.contype}): ${con.definition}`);
    });
    
    // Try a simple insert
    console.log(chalk.yellow('\n🧪 Testing simple insert...'));
    
    // Get a sample player and game
    const player = await pgPool.query(`
      SELECT id FROM players_master WHERE sport = 'NBA' LIMIT 1
    `);
    
    const game = await pgPool.query(`
      SELECT id FROM games_master WHERE sport = 'NBA' AND status = 'STATUS_FINAL' LIMIT 1
    `);
    
    if (player.rows.length && game.rows.length) {
      const testStats = {
        player_id: player.rows[0].id,
        game_id: game.rows[0].id,
        team_id: 1,
        sport: 'NBA',
        season: 2024,
        position: 'G',
        played: true,
        started: false,
        minutes_played: 20,
        stats: { points: 10, rebounds: 5, assists: 3 },
        data_source: 'test',
        confidence_score: 0.99
      };
      
      console.log('Test data:', testStats);
      
      try {
        const result = await pgPool.query(
          `INSERT INTO player_game_stats (
            player_id, game_id, team_id, sport, season, 
            position, played, started, minutes_played, stats,
            data_source, confidence_score
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (player_id, game_id) DO UPDATE 
          SET stats = $10, updated_at = NOW()
          RETURNING id`,
          [
            testStats.player_id,
            testStats.game_id,
            testStats.team_id,
            testStats.sport,
            testStats.season,
            testStats.position,
            testStats.played,
            testStats.started,
            testStats.minutes_played,
            testStats.stats,
            testStats.data_source,
            testStats.confidence_score
          ]
        );
        
        console.log(chalk.green('✅ Insert successful! ID:', result.rows[0].id));
        
        // Verify it's in the database
        const verify = await pgPool.query(`
          SELECT COUNT(*) as count FROM player_game_stats WHERE sport = 'NBA'
        `);
        
        console.log(chalk.cyan(`Total NBA stats now: ${verify.rows[0].count}`));
        
      } catch (insertError) {
        console.error(chalk.red('❌ Insert failed:'), insertError);
      }
    } else {
      console.log(chalk.red('No NBA players or games found!'));
    }
    
    // Check if there are any stats at all
    const totalStats = await pgPool.query(`
      SELECT sport, COUNT(*) as count 
      FROM player_game_stats 
      GROUP BY sport
    `);
    
    console.log(chalk.cyan('\nTotal stats by sport:'));
    if (totalStats.rows.length === 0) {
      console.log(chalk.red('  No stats in database!'));
    } else {
      totalStats.rows.forEach(row => {
        console.log(`  ${row.sport}: ${row.count}`);
      });
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await pgPool.end();
  }
}

debugStatsInsert();