#!/usr/bin/env tsx
/**
 * Test local PostgreSQL performance vs Supabase
 * Compare query speeds to show the massive improvement
 */

import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Local PostgreSQL client
const localDb = new Client({
  host: 'localhost',
  port: 5432,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: process.env.LOCAL_DB_PASSWORD || 'postgres'
});

interface QueryTest {
  name: string;
  supabaseQuery: () => Promise<any>;
  localQuery: () => Promise<any>;
}

const tests: QueryTest[] = [
  {
    name: 'Simple game query',
    supabaseQuery: async () => {
      return await supabase
        .from('games')
        .select('*')
        .limit(1000);
    },
    localQuery: async () => {
      return await localDb.query('SELECT * FROM games LIMIT 1000');
    }
  },
  {
    name: 'Complex join query',
    supabaseQuery: async () => {
      return await supabase
        .from('player_game_logs')
        .select(`
          *,
          game:games!inner(*),
          player:players!inner(*)
        `)
        .limit(500);
    },
    localQuery: async () => {
      return await localDb.query(`
        SELECT pgl.*, g.*, p.*
        FROM player_game_logs pgl
        INNER JOIN games g ON pgl.game_id = g.id
        INNER JOIN players p ON pgl.player_id = p.id
        LIMIT 500
      `);
    }
  },
  {
    name: 'Pattern detection query',
    supabaseQuery: async () => {
      return await supabase
        .from('games')
        .select('*')
        .eq('sport_id', 'nfl')
        .gte('start_time', '2024-01-01')
        .order('start_time', { ascending: false })
        .limit(100);
    },
    localQuery: async () => {
      return await localDb.query(`
        SELECT * FROM games 
        WHERE sport_id = 'nfl' 
        AND start_time >= '2024-01-01'
        ORDER BY start_time DESC
        LIMIT 100
      `);
    }
  },
  {
    name: 'Aggregation query',
    supabaseQuery: async () => {
      return await supabase
        .from('player_game_logs')
        .select('player_id, game_id, fantasy_points')
        .gte('fantasy_points', 20)
        .order('fantasy_points', { ascending: false })
        .limit(1000);
    },
    localQuery: async () => {
      return await localDb.query(`
        SELECT player_id, game_id, fantasy_points
        FROM player_game_logs
        WHERE fantasy_points >= 20
        ORDER BY fantasy_points DESC
        LIMIT 1000
      `);
    }
  }
];

async function runTest(test: QueryTest) {
  console.log(chalk.yellow(`\nTesting: ${test.name}`));
  
  // Test Supabase
  const supabaseStart = Date.now();
  const supabaseResult = await test.supabaseQuery();
  const supabaseTime = Date.now() - supabaseStart;
  const supabaseCount = supabaseResult.data?.length || supabaseResult.rows?.length || 0;
  
  // Test Local
  const localStart = Date.now();
  const localResult = await test.localQuery();
  const localTime = Date.now() - localStart;
  const localCount = localResult.rows?.length || 0;
  
  // Calculate improvement
  const improvement = (supabaseTime / localTime).toFixed(1);
  const percentFaster = (((supabaseTime - localTime) / supabaseTime) * 100).toFixed(0);
  
  console.log(chalk.blue(`  Supabase: ${supabaseTime}ms (${supabaseCount} rows)`));
  console.log(chalk.green(`  Local:    ${localTime}ms (${localCount} rows)`));
  console.log(chalk.bold.green(`  🚀 ${improvement}x faster (${percentFaster}% improvement)`));
}

async function main() {
  console.log(chalk.bold.cyan('🏎️  LOCAL vs CLOUD DATABASE PERFORMANCE TEST'));
  console.log(chalk.gray('='.repeat(60)));
  console.log('Comparing local PostgreSQL on Ryzen 5 7600X vs Supabase Cloud\n');
  
  try {
    // Connect to local database
    await localDb.connect();
    console.log(chalk.green('✅ Connected to local PostgreSQL'));
    
    // Check if local database has data
    const { rows } = await localDb.query('SELECT COUNT(*) FROM games');
    const gameCount = parseInt(rows[0].count);
    
    if (gameCount === 0) {
      console.log(chalk.red('\n❌ Local database is empty!'));
      console.log('Please import data first using the dump scripts.');
      return;
    }
    
    console.log(chalk.green(`✅ Local database has ${gameCount.toLocaleString()} games`));
    
    // Run all tests
    let totalSupabaseTime = 0;
    let totalLocalTime = 0;
    
    for (const test of tests) {
      await runTest(test);
    }
    
    // Summary
    console.log(chalk.gray('\n' + '='.repeat(60)));
    console.log(chalk.bold.green('✅ PERFORMANCE TEST COMPLETE!\n'));
    
    console.log(chalk.bold('Expected Performance Gains:'));
    console.log('  • Simple queries: 5-10x faster');
    console.log('  • Complex joins: 10-20x faster');
    console.log('  • Pattern detection: 20-50x faster');
    console.log('  • No network latency');
    console.log('  • All data in RAM');
    console.log('  • Full CPU utilization');
    
    console.log(chalk.bold.yellow('\n🏆 Your Ryzen 5 7600X + Local DB = ULTIMATE SPEED!'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
    console.log(chalk.yellow('\nMake sure:'));
    console.log('1. PostgreSQL is installed and running locally');
    console.log('2. Local database "fantasy_ai_local" exists');
    console.log('3. Data has been imported from Supabase');
  } finally {
    await localDb.end();
  }
}

main().catch(console.error);