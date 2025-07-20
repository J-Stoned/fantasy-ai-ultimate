#!/usr/bin/env tsx
/**
 * Convert TEXT columns to JSONB for better performance
 */

import { Pool } from 'pg';
import chalk from 'chalk';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/fantasy_ai_local',
  max: 1,
});

async function convertToJsonb() {
  const client = await pool.connect();
  
  try {
    console.log(chalk.blue('\n🔄 Converting columns to JSONB...\n'));
    
    // Start transaction
    await client.query('BEGIN');
    
    // Convert stats column to JSONB
    console.log(chalk.yellow('Converting player_game_logs.stats to JSONB...'));
    try {
      await client.query(`
        ALTER TABLE player_game_logs 
        ALTER COLUMN stats TYPE jsonb 
        USING stats::jsonb
      `);
      console.log(chalk.green('✅ Successfully converted stats to JSONB'));
    } catch (error) {
      if (error.message.includes('already of type')) {
        console.log(chalk.yellow('⚠️  Stats column already JSONB'));
      } else {
        throw error;
      }
    }
    
    // Now create the JSON indexes
    console.log(chalk.yellow('\nCreating JSON indexes...'));
    
    const indexes = [
      { name: 'idx_stats_points', field: 'points', type: 'int' },
      { name: 'idx_stats_assists', field: 'assists', type: 'int' },
      { name: 'idx_stats_rebounds', field: 'rebounds', type: 'int' },
      { name: 'idx_stats_goals', field: 'goals', type: 'int' },
      { name: 'idx_stats_fantasy_points', field: 'fantasyPoints', type: 'float' },
    ];
    
    for (const idx of indexes) {
      try {
        console.log(chalk.gray(`Creating ${idx.name}...`));
        await client.query(`
          CREATE INDEX IF NOT EXISTS ${idx.name}
          ON player_game_logs (((stats->>'${idx.field}')::${idx.type}))
          WHERE stats IS NOT NULL AND stats->>'${idx.field}' IS NOT NULL
        `);
        console.log(chalk.green(`✅ Created ${idx.name}`));
      } catch (error) {
        console.log(chalk.red(`❌ Failed to create ${idx.name}: ${error.message}`));
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log(chalk.green('\n✅ All conversions completed successfully!'));
    
    // Test the performance
    console.log(chalk.cyan('\n🧪 Testing JSON query performance...'));
    
    const start = Date.now();
    const result = await client.query(`
      SELECT COUNT(*) as count
      FROM player_game_logs
      WHERE (stats->>'points')::int > 20
        AND stats IS NOT NULL
    `);
    const duration = Date.now() - start;
    
    console.log(chalk.green(`✅ Query completed in ${duration}ms`));
    console.log(chalk.gray(`   Found ${result.rows[0].count} players with 20+ points`));
    
    // Show index usage
    const indexUsage = await client.query(`
      SELECT 
        indexname,
        idx_scan,
        idx_tup_read
      FROM pg_stat_user_indexes
      WHERE tablename = 'player_game_logs'
        AND indexname LIKE 'idx_stats%'
      ORDER BY idx_scan DESC
    `);
    
    if (indexUsage.rows.length > 0) {
      console.log(chalk.cyan('\n📊 Index Usage Stats:'));
      indexUsage.rows.forEach(row => {
        console.log(chalk.gray(`   ${row.indexname}: ${row.idx_scan} scans`));
      });
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(chalk.red('\n❌ Error:'), error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

convertToJsonb().catch(console.error);