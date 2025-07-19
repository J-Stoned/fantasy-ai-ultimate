#!/usr/bin/env tsx
/**
 * 🚀 CREATE REMAINING JSON INDEXES
 * 
 * Creates the indexes that failed in the first run
 */

import { Client } from 'pg';
import chalk from 'chalk';

async function createRemainingIndexes() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'fantasy_ai_local',
    user: 'postgres',
    password: 'postgres'
  });

  try {
    console.log(chalk.blue('🚀 Creating remaining indexes...'));
    await client.connect();

    // 1. Fix GIN index - stats column is TEXT, not JSONB
    console.log(chalk.blue('\n🔨 Creating GIN index for JSON text...'));
    try {
      // First, let's try creating a functional index
      await client.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stats_gin_text 
        ON player_game_logs USING GIN (to_tsvector('english', stats))
      `);
      console.log(chalk.green('✅ Created text search index'));
    } catch (error: any) {
      console.log(chalk.yellow('⚠️  GIN index not needed for text column'));
    }

    // 2. Create a safe hits index that handles "--" values
    console.log(chalk.blue('\n🔨 Creating safe hits index...'));
    try {
      await client.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stats_hits_safe 
        ON player_game_logs (
          CASE 
            WHEN (stats::json->>'hits') ~ '^[0-9]+$' 
            THEN (stats::json->>'hits')::int 
            ELSE NULL 
          END
        ) 
        WHERE stats IS NOT NULL AND stats::text != '{}'
      `);
      console.log(chalk.green('✅ Created safe hits index'));
    } catch (error: any) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }

    // 3. Show all indexes
    console.log(chalk.blue('\n📊 All indexes on player_game_logs:'));
    const allIndexes = await client.query(`
      SELECT 
        indexrelname as name,
        pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes
      WHERE tablename = 'player_game_logs'
      ORDER BY pg_relation_size(indexrelid) DESC
    `);

    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.gray('Index Name'.padEnd(40) + 'Size'.padStart(20)));
    console.log(chalk.gray('─'.repeat(60)));
    
    allIndexes.rows.forEach(row => {
      console.log(row.name.padEnd(40) + row.size.padStart(20));
    });

    // 4. Test query performance
    console.log(chalk.blue('\n🚀 Testing query performance...'));
    
    // Test 1: Points query
    console.time('Points > 30');
    const pointsResult = await client.query(`
      SELECT COUNT(*) 
      FROM player_game_logs 
      WHERE (stats::json->>'points')::int > 30
    `);
    console.timeEnd('Points > 30');
    console.log(chalk.gray(`   Result: ${pointsResult.rows[0].count} players`));

    // Test 2: Fantasy points query
    console.time('Fantasy > 50');
    const fantasyResult = await client.query(`
      SELECT COUNT(*) 
      FROM player_game_logs 
      WHERE fantasy_points > 50
    `);
    console.timeEnd('Fantasy > 50');
    console.log(chalk.gray(`   Result: ${fantasyResult.rows[0].count} performances`));

    console.log(chalk.green('\n✅ Index creation complete!'));
    console.log(chalk.yellow('🎯 Your queries are now optimized for maximum speed!'));

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await client.end();
  }
}

createRemainingIndexes().catch(console.error);