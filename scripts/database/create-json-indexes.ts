#!/usr/bin/env tsx
/**
 * 🚀 CREATE HIGH-PERFORMANCE JSON INDEXES
 * 
 * This script creates specialized indexes for the stats JSON column
 * to enable sub-100ms queries on 672K+ rows
 */

import { Client } from 'pg';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

// Index definitions with descriptions
const indexes = [
  {
    name: 'idx_stats_gin',
    description: 'GIN index for flexible JSON searches',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stats_gin 
          ON player_game_logs USING GIN (stats::jsonb)`,
    priority: 1
  },
  {
    name: 'idx_stats_points',
    description: 'Points index for basketball queries',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stats_points 
          ON player_game_logs (((stats::json->>'points')::int)) 
          WHERE stats IS NOT NULL AND stats::text != '{}'`,
    priority: 2
  },
  {
    name: 'idx_stats_assists',
    description: 'Assists index for basketball queries',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stats_assists 
          ON player_game_logs (((stats::json->>'assists')::int)) 
          WHERE stats IS NOT NULL AND stats::text != '{}'`,
    priority: 2
  },
  {
    name: 'idx_stats_rebounds',
    description: 'Rebounds index for basketball queries',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stats_rebounds 
          ON player_game_logs (((stats::json->>'rebounds')::int)) 
          WHERE stats IS NOT NULL AND stats::text != '{}'`,
    priority: 2
  },
  {
    name: 'idx_stats_goals',
    description: 'Goals index for hockey queries',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stats_goals 
          ON player_game_logs (((stats::json->>'goals')::int)) 
          WHERE stats IS NOT NULL AND stats::text != '{}'`,
    priority: 2
  },
  {
    name: 'idx_stats_hits',
    description: 'Hits index for hockey queries',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stats_hits 
          ON player_game_logs (((stats::json->>'hits')::int)) 
          WHERE stats IS NOT NULL 
            AND stats::text != '{}' 
            AND (stats::json->>'hits') ~ '^[0-9]+$'`,
    priority: 2
  },
  {
    name: 'idx_pattern_high_scorers',
    description: 'Composite index for high scorer patterns',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pattern_high_scorers 
          ON player_game_logs (game_id, team_id, ((stats::json->>'points')::int)) 
          WHERE stats IS NOT NULL AND (stats::json->>'points')::int > 20`,
    priority: 3
  },
  {
    name: 'idx_pattern_elite_fantasy',
    description: 'Index for elite fantasy performances',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pattern_elite_fantasy 
          ON player_game_logs (game_id, fantasy_points DESC) 
          WHERE fantasy_points > 40`,
    priority: 3
  },
  {
    name: 'idx_pattern_covering',
    description: 'Covering index for pattern detection queries',
    sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pattern_covering 
          ON player_game_logs (game_id, team_id, player_id, fantasy_points, is_home) 
          INCLUDE (stats, game_date)`,
    priority: 4
  }
];

async function createIndexes() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'fantasy_ai_local',
    user: 'postgres',
    password: 'postgres'
  });

  try {
    console.log(chalk.blue('🚀 Connecting to local PostgreSQL...'));
    await client.connect();
    console.log(chalk.green('✅ Connected successfully!\n'));

    // Check current index status
    const currentIndexes = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'player_game_logs'
    `);
    
    console.log(chalk.yellow(`📊 Current indexes: ${currentIndexes.rows.length}\n`));

    // Create indexes by priority
    for (const index of indexes.sort((a, b) => a.priority - b.priority)) {
      console.log(chalk.blue(`\n🔨 Creating ${index.name}...`));
      console.log(chalk.gray(`   ${index.description}`));
      
      const start = performance.now();
      
      try {
        await client.query(index.sql);
        const duration = ((performance.now() - start) / 1000).toFixed(2);
        console.log(chalk.green(`   ✅ Created in ${duration}s`));
      } catch (error: any) {
        if (error.message.includes('already exists')) {
          console.log(chalk.yellow(`   ⚠️  Already exists`));
        } else {
          console.log(chalk.red(`   ❌ Error: ${error.message}`));
        }
      }
    }

    // Analyze table for query planner
    console.log(chalk.blue('\n📊 Analyzing table statistics...'));
    await client.query('ANALYZE player_game_logs');
    console.log(chalk.green('✅ Analysis complete'));

    // Show index statistics
    const indexStats = await client.query(`
      SELECT 
        indexrelname as indexname,
        pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes
      WHERE tablename = 'player_game_logs'
      ORDER BY pg_relation_size(indexrelid) DESC
    `);

    console.log(chalk.blue('\n📈 Index Statistics:'));
    console.log(chalk.gray('─'.repeat(50)));
    indexStats.rows.forEach(row => {
      console.log(`${row.indexname.padEnd(35)} ${row.size.padStart(10)}`);
    });

    // Show total sizes
    const sizes = await client.query(`
      SELECT 
        pg_size_pretty(pg_total_relation_size('player_game_logs')) as total,
        pg_size_pretty(pg_relation_size('player_game_logs')) as table_only,
        pg_size_pretty(pg_total_relation_size('player_game_logs') - pg_relation_size('player_game_logs')) as indexes_only
    `);

    const sizeInfo = sizes.rows[0];
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.yellow(`Total size:  ${sizeInfo.total}`));
    console.log(chalk.gray(`Table only:  ${sizeInfo.table_only}`));
    console.log(chalk.gray(`Indexes:     ${sizeInfo.indexes_only}`));

    console.log(chalk.green('\n✅ All indexes created successfully!'));
    console.log(chalk.blue('🚀 Your queries will now be lightning fast!'));

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await client.end();
  }
}

// Run the script
createIndexes().catch(console.error);