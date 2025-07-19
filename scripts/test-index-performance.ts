#!/usr/bin/env tsx
/**
 * Test database performance after index creation
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function timeQuery(name: string, queryFn: () => Promise<any>): Promise<void> {
  console.log(chalk.yellow(`\nTesting: ${name}`));
  
  const start = Date.now();
  const result = await queryFn();
  const duration = Date.now() - start;
  
  const count = Array.isArray(result.data) ? result.data.length : 0;
  const status = result.error ? chalk.red('❌ ERROR') : chalk.green('✅ SUCCESS');
  
  console.log(`  ${status} - ${duration}ms - ${count} records`);
  
  if (result.error) {
    console.log(chalk.red(`  Error: ${result.error.message}`));
  }
}

async function runPerformanceTests() {
  console.log(chalk.bold.cyan('🔥 DATABASE PERFORMANCE TEST - POST-INDEX'));
  console.log(chalk.gray('='.repeat(60)));
  console.log('Testing query performance with new indexes...\n');

  // Test 1: Player game logs by game
  await timeQuery('Player game logs by game_id', async () => {
    return await supabase
      .from('player_game_logs')
      .select('*')
      .eq('game_id', 1000)
      .limit(50);
  });

  // Test 2: Games with team joins
  await timeQuery('Games with team information', async () => {
    return await supabase
      .from('games')
      .select(`
        *,
        home_team:teams!games_home_team_id_fkey(name, abbreviation),
        away_team:teams!games_away_team_id_fkey(name, abbreviation)
      `)
      .gte('start_time', '2024-01-01')
      .order('start_time', { ascending: false })
      .limit(100);
  });

  // Test 3: Player stats with complex filtering
  await timeQuery('Player stats with fantasy points', async () => {
    return await supabase
      .from('player_game_logs')
      .select('player_id, game_id, fantasy_points')
      .gte('fantasy_points', 20)
      .order('fantasy_points', { ascending: false })
      .limit(500);
  });

  // Test 4: Pattern detection query
  await timeQuery('Games by sport and date range', async () => {
    return await supabase
      .from('games')
      .select('*')
      .eq('sport_id', 'nfl')
      .gte('start_time', '2024-01-01')
      .lte('start_time', '2024-12-31')
      .order('start_time', { ascending: false });
  });

  // Test 5: Complex join query
  await timeQuery('Player game logs with full game context', async () => {
    return await supabase
      .from('player_game_logs')
      .select(`
        *,
        game:games!inner(
          id,
          start_time,
          home_team_id,
          away_team_id,
          sport_id
        ),
        player:players!inner(
          id,
          firstname,
          lastname,
          position
        )
      `)
      .gte('game_date', '2024-10-01')
      .limit(200);
  });

  // Test 6: Betting lines lookup
  await timeQuery('Recent betting lines', async () => {
    return await supabase
      .from('betting_lines')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
  });

  // Test 7: JSONB query on stats
  await timeQuery('Players with specific stat values (JSONB)', async () => {
    return await supabase
      .from('player_game_logs')
      .select('*')
      .not('stats', 'is', null)
      .limit(50);
  });

  // Test 8: Count query performance
  await timeQuery('Count total games', async () => {
    return await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
  });

  console.log(chalk.gray('\n' + '='.repeat(60)));
  console.log(chalk.bold.green('✅ Performance test complete!\n'));
  console.log(chalk.yellow('Expected improvements with indexes:'));
  console.log('  • Queries on indexed columns: 10-100x faster');
  console.log('  • Complex joins: 5-20x faster');
  console.log('  • JSONB queries: 3-10x faster');
  console.log('  • Count queries: 2-5x faster');
  console.log('\nCompare these times with pre-index performance!');
}

runPerformanceTests().catch(console.error);