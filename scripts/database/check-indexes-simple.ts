#!/usr/bin/env tsx
/**
 * 🚀 CHECK CURRENT INDEXES
 * 
 * Simple script to see what indexes exist and test performance
 */

import { Client } from 'pg';
import chalk from 'chalk';

async function checkIndexes() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'fantasy_ai_local',
    user: 'postgres',
    password: 'postgres'
  });

  try {
    console.log(chalk.blue('🚀 Checking indexes and performance...'));
    await client.connect();

    // 1. Show all indexes on player_game_logs
    console.log(chalk.blue('\n📊 Current indexes:'));
    const indexes = await client.query(`
      SELECT 
        i.relname as index_name,
        pg_size_pretty(pg_relation_size(i.oid)) as size
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      WHERE t.relname = 'player_game_logs'
        AND t.relkind = 'r'
      ORDER BY pg_relation_size(i.oid) DESC
    `);

    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.gray('Index Name'.padEnd(40) + 'Size'.padStart(20)));
    console.log(chalk.gray('─'.repeat(60)));
    
    indexes.rows.forEach(row => {
      console.log(row.index_name.padEnd(40) + row.size.padStart(20));
    });

    // 2. Test query performance
    console.log(chalk.blue('\n🚀 Testing query performance...'));
    
    // Test 1: Points query (should use idx_stats_points)
    const start1 = Date.now();
    const pointsResult = await client.query(`
      SELECT COUNT(*) 
      FROM player_game_logs 
      WHERE (stats::json->>'points')::int > 30
    `);
    const time1 = Date.now() - start1;
    console.log(chalk.green(`\n✅ Points > 30: ${time1}ms`));
    console.log(chalk.gray(`   Found: ${pointsResult.rows[0].count} players`));

    // Test 2: Fantasy points query (should use idx_pattern_elite_fantasy)
    const start2 = Date.now();
    const fantasyResult = await client.query(`
      SELECT COUNT(*) 
      FROM player_game_logs 
      WHERE fantasy_points > 50
    `);
    const time2 = Date.now() - start2;
    console.log(chalk.green(`\n✅ Fantasy > 50: ${time2}ms`));
    console.log(chalk.gray(`   Found: ${fantasyResult.rows[0].count} performances`));

    // Test 3: Combined pattern query
    const start3 = Date.now();
    const patternResult = await client.query(`
      SELECT COUNT(*) 
      FROM player_game_logs 
      WHERE game_id IN (
        SELECT id FROM games 
        WHERE home_score > away_score 
        LIMIT 1000
      )
    `);
    const time3 = Date.now() - start3;
    console.log(chalk.green(`\n✅ Pattern query: ${time3}ms`));
    console.log(chalk.gray(`   Found: ${patternResult.rows[0].count} records`));

    // Test 4: Assists query (should use idx_stats_assists)
    const start4 = Date.now();
    const assistsResult = await client.query(`
      SELECT COUNT(*) 
      FROM player_game_logs 
      WHERE (stats::json->>'assists')::int > 10
    `);
    const time4 = Date.now() - start4;
    console.log(chalk.green(`\n✅ Assists > 10: ${time4}ms`));
    console.log(chalk.gray(`   Found: ${assistsResult.rows[0].count} players`));

    // Summary
    console.log(chalk.blue('\n📈 Performance Summary:'));
    console.log(chalk.gray('─'.repeat(40)));
    const avgTime = (time1 + time2 + time3 + time4) / 4;
    console.log(chalk.yellow(`Average query time: ${avgTime.toFixed(1)}ms`));
    
    if (avgTime < 100) {
      console.log(chalk.green('🚀 Excellent! Sub-100ms performance achieved!'));
    } else if (avgTime < 500) {
      console.log(chalk.yellow('⚡ Good performance, but could be better'));
    } else {
      console.log(chalk.red('⚠️  Performance needs improvement'));
    }

    // Table stats
    const tableStats = await client.query(`
      SELECT 
        pg_size_pretty(pg_total_relation_size('player_game_logs')) as total_size,
        pg_size_pretty(pg_relation_size('player_game_logs')) as table_size,
        pg_size_pretty(pg_indexes_size('player_game_logs')) as indexes_size,
        (SELECT COUNT(*) FROM player_game_logs) as row_count
    `);

    const stats = tableStats.rows[0];
    console.log(chalk.blue('\n📊 Table Statistics:'));
    console.log(chalk.gray(`Total size: ${stats.total_size}`));
    console.log(chalk.gray(`Table only: ${stats.table_size}`));
    console.log(chalk.gray(`Indexes: ${stats.indexes_size}`));
    console.log(chalk.gray(`Rows: ${parseInt(stats.row_count).toLocaleString()}`));

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await client.end();
  }
}

checkIndexes().catch(console.error);