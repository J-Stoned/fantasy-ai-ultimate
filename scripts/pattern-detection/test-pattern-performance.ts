#!/usr/bin/env tsx
/**
 * 🚀 PATTERN DETECTION PERFORMANCE TEST
 * 
 * Compare local PostgreSQL vs Supabase performance
 * for pattern detection queries
 */

import { createClient } from '@supabase/supabase-js';
import { getPool, query, queryMany } from '../utils/local-db-pool';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Test queries
const testQueries = {
  simpleCount: {
    name: 'Simple COUNT',
    sql: 'SELECT COUNT(*) as count FROM games WHERE status = \'final\'',
    supabase: async () => {
      const { count } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'final');
      return count;
    }
  },
  
  jsonQuery: {
    name: 'JSON Stats Query (30+ points)',
    sql: `SELECT COUNT(*) as count 
          FROM player_game_logs 
          WHERE (stats::json->>'points')::int > 30`,
    supabase: async () => {
      // Supabase doesn't support JSON operators easily, so we'll approximate
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true });
      return count; // This is just for comparison timing
    }
  },
  
  patternQuery: {
    name: 'Back-to-Back Pattern',
    sql: `
      WITH team_games AS (
        SELECT 
          g.id,
          g.away_team_id,
          g.start_time,
          LAG(g.start_time) OVER (PARTITION BY g.away_team_id ORDER BY g.start_time) as prev_game_time
        FROM games g
        WHERE g.status = 'final'
        LIMIT 1000
      )
      SELECT COUNT(*) as count
      FROM team_games
      WHERE EXTRACT(EPOCH FROM (start_time - prev_game_time))/3600 < 30
        AND prev_game_time IS NOT NULL
    `,
    supabase: null // Too complex for Supabase
  },
  
  fantasyElite: {
    name: 'Elite Fantasy Performances',
    sql: `SELECT COUNT(*) as count 
          FROM player_game_logs 
          WHERE fantasy_points > 50`,
    supabase: async () => {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .gt('fantasy_points', 50);
      return count;
    }
  }
};

async function runPerformanceTests() {
  console.log(chalk.blue('\n🚀 PATTERN DETECTION PERFORMANCE TEST'));
  console.log(chalk.gray('='.repeat(70)));
  
  const results = [];
  
  for (const [key, test] of Object.entries(testQueries)) {
    console.log(chalk.yellow(`\n📊 Testing: ${test.name}`));
    console.log(chalk.gray('-'.repeat(50)));
    
    // Test local PostgreSQL
    try {
      const localStart = performance.now();
      const localResult = await query(test.sql);
      const localTime = performance.now() - localStart;
      
      console.log(chalk.green(`✅ Local PostgreSQL: ${localTime.toFixed(2)}ms`));
      console.log(chalk.gray(`   Result: ${localResult.rows[0]?.count || 'N/A'} rows`));
      
      // Test Supabase (if query is available)
      let supabaseTime = null;
      if (test.supabase) {
        const supabaseStart = performance.now();
        const supabaseResult = await test.supabase();
        supabaseTime = performance.now() - supabaseStart;
        
        console.log(chalk.blue(`☁️  Supabase: ${supabaseTime.toFixed(2)}ms`));
        console.log(chalk.gray(`   Result: ${supabaseResult} rows`));
        
        const speedup = (supabaseTime / localTime).toFixed(1);
        console.log(chalk.yellow(`⚡ Local is ${speedup}x faster!`));
      } else {
        console.log(chalk.gray('☁️  Supabase: Query too complex'));
      }
      
      results.push({
        test: test.name,
        local: localTime,
        supabase: supabaseTime,
        speedup: supabaseTime ? (supabaseTime / localTime).toFixed(1) : 'N/A'
      });
      
    } catch (error) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
    }
  }
  
  // Summary
  console.log(chalk.blue('\n📈 PERFORMANCE SUMMARY'));
  console.log(chalk.gray('='.repeat(70)));
  console.log(chalk.gray('Test'.padEnd(30) + 'Local'.padEnd(15) + 'Supabase'.padEnd(15) + 'Speedup'));
  console.log(chalk.gray('-'.repeat(70)));
  
  results.forEach(r => {
    console.log(
      r.test.padEnd(30) +
      `${r.local.toFixed(0)}ms`.padEnd(15) +
      (r.supabase ? `${r.supabase.toFixed(0)}ms` : 'N/A').padEnd(15) +
      r.speedup + 'x'
    );
  });
  
  // Average speedup
  const validSpeedups = results
    .filter(r => r.speedup !== 'N/A')
    .map(r => parseFloat(r.speedup));
  
  if (validSpeedups.length > 0) {
    const avgSpeedup = (validSpeedups.reduce((a, b) => a + b, 0) / validSpeedups.length).toFixed(1);
    console.log(chalk.gray('-'.repeat(70)));
    console.log(chalk.green(`\n🎯 Average speedup: ${avgSpeedup}x faster with local PostgreSQL!`));
  }
  
  // Connection pool stats
  const pool = getPool();
  console.log(chalk.blue('\n🔌 Connection Pool Stats:'));
  console.log(chalk.gray(`   Total connections: ${pool.totalCount}`));
  console.log(chalk.gray(`   Idle connections: ${pool.idleCount}`));
  console.log(chalk.gray(`   Waiting requests: ${pool.waitingCount}`));
  
  console.log(chalk.green('\n✅ Performance test complete!'));
  
  // Close connections
  await pool.end();
}

// Run the tests
runPerformanceTests().catch(console.error);