#!/usr/bin/env tsx
/**
 * 🚀 TURBO NCAA BASEBALL ID FIX
 * 
 * Focused script just for NCAA Baseball ID fixes
 * Uses larger batches and direct SQL for speed
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function fixNcaaBaseballIdsDirectSQL() {
  console.log(chalk.bold.cyan('🚀 TURBO NCAA BASEBALL ID FIX\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Start transaction
    await client.query('BEGIN');
    
    // 1. Fix players
    console.log(chalk.yellow('⚾ Fixing NCAA Baseball player IDs...'));
    
    const playerResult = await client.query(`
      UPDATE players p1
      SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
      WHERE sport = 'NCAA_BASEBALL' 
        AND external_id LIKE 'espn_ncaa_%' 
        AND external_id NOT LIKE 'espn_ncaa_baseball_%'
        AND NOT EXISTS (
          SELECT 1 FROM players p2 
          WHERE p2.external_id = REPLACE(p1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
          AND p2.id != p1.id
        )
    `);
    
    console.log(`  ✅ Fixed ${playerResult.rowCount} player IDs`);
    
    // 2. Fix teams
    console.log(chalk.yellow('\n⚾ Fixing NCAA Baseball team IDs...'));
    
    const teamResult = await client.query(`
      UPDATE teams t1
      SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
      WHERE sport = 'NCAA_BASEBALL' 
        AND external_id LIKE 'espn_ncaa_%' 
        AND external_id NOT LIKE 'espn_ncaa_baseball_%'
        AND NOT EXISTS (
          SELECT 1 FROM teams t2 
          WHERE t2.external_id = REPLACE(t1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
          AND t2.id != t1.id
        )
    `);
    
    console.log(`  ✅ Fixed ${teamResult.rowCount} team IDs`);
    
    // 3. Fix games
    console.log(chalk.yellow('\n⚾ Fixing NCAA Baseball game IDs...'));
    
    const gameResult = await client.query(`
      UPDATE games g1
      SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
      WHERE sport = 'NCAA_BASEBALL' 
        AND external_id LIKE 'espn_ncaa_%' 
        AND external_id NOT LIKE 'espn_ncaa_baseball_%'
        AND NOT EXISTS (
          SELECT 1 FROM games g2 
          WHERE g2.external_id = REPLACE(g1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
          AND g2.id != g1.id
        )
    `);
    
    console.log(`  ✅ Fixed ${gameResult.rowCount} game IDs`);
    
    // 4. Check for conflicts
    console.log(chalk.yellow('\n🔍 Checking for remaining conflicts...'));
    
    const conflictCheck = await client.query(`
      SELECT 
        'players' as table_name,
        COUNT(*) as count
      FROM players
      WHERE sport = 'NCAA_BASEBALL' 
        AND external_id LIKE 'espn_ncaa_%' 
        AND external_id NOT LIKE 'espn_ncaa_baseball_%'
      UNION ALL
      SELECT 
        'teams',
        COUNT(*)
      FROM teams
      WHERE sport = 'NCAA_BASEBALL' 
        AND external_id LIKE 'espn_ncaa_%' 
        AND external_id NOT LIKE 'espn_ncaa_baseball_%'
      UNION ALL
      SELECT 
        'games',
        COUNT(*)
      FROM games
      WHERE sport = 'NCAA_BASEBALL' 
        AND external_id LIKE 'espn_ncaa_%' 
        AND external_id NOT LIKE 'espn_ncaa_baseball_%'
    `);
    
    console.log('\nRemaining NCAA Baseball IDs needing fix:');
    console.table(conflictCheck.rows);
    
    // If there are conflicts, show samples
    const remainingPlayers = parseInt(conflictCheck.rows.find(r => r.table_name === 'players')?.count || '0');
    
    if (remainingPlayers > 0) {
      console.log(chalk.yellow('\n⚠️  Sample conflicts preventing update:'));
      
      const conflicts = await client.query(`
        SELECT 
          p1.id as player1_id,
          p1.name as player1_name,
          p1.external_id as current_id,
          p2.id as player2_id,
          p2.name as player2_name,
          p2.external_id as blocking_id
        FROM players p1
        JOIN players p2 ON p2.external_id = REPLACE(p1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
        WHERE p1.sport = 'NCAA_BASEBALL' 
          AND p1.external_id LIKE 'espn_ncaa_%' 
          AND p1.external_id NOT LIKE 'espn_ncaa_baseball_%'
          AND p1.id != p2.id
        LIMIT 10
      `);
      
      console.table(conflicts.rows);
    }
    
    // Commit transaction
    await client.query('COMMIT');
    console.log(chalk.green('\n✅ NCAA Baseball ID fix complete!'));
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error(chalk.red('❌ Error:'), error.message);
    if (error.detail) console.error('Detail:', error.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function checkNumericIds() {
  console.log(chalk.yellow('\n🔢 Checking for remaining numeric IDs...'));
  
  const tables = ['teams', 'players', 'games'];
  const results: any[] = [];
  
  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .filter('external_id', 'match', '^[0-9]+$');
    
    results.push({
      table,
      numeric_ids: count || 0
    });
  }
  
  console.table(results);
  
  // Show samples if any remain
  for (const result of results) {
    if (result.numeric_ids > 0) {
      const { data: samples } = await supabase
        .from(result.table)
        .select('id, external_id' + (result.table !== 'games' ? ', name, sport' : ', sport'))
        .filter('external_id', 'match', '^[0-9]+$')
        .limit(5);
      
      if (samples && samples.length > 0) {
        console.log(`\n${chalk.yellow(`Sample numeric ${result.table}:`)} (may have conflicts)`);
        console.table(samples);
      }
    }
  }
}

async function main() {
  const startTime = Date.now();
  
  await fixNcaaBaseballIdsDirectSQL();
  await checkNumericIds();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(chalk.green(`\n✨ Completed in ${duration}s`));
}

main();