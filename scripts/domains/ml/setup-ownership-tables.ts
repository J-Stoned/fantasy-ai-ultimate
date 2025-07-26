#!/usr/bin/env tsx
/**
 * 🎯 Setup Ownership Tables
 * Creates all the tables we need for ownership projections
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// Use LOCAL PostgreSQL database on Windows host
const DATABASE_URL = process.env.DATABASE_URL_LOCAL || 'postgresql://postgres:postgres@172.30.176.1:5432/fantasy_ai_local';

// Create pool
const pgPool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
import { readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

async function setupOwnershipTables() {
  console.log(chalk.cyan.bold('🎯 Setting up Ownership Tables for GPP Domination!\n'));
  
  try {
    // Read the SQL file
    const sqlPath = join(__dirname, 'sql', 'create-ownership-tables.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    
    // Execute the SQL
    await pgPool.query(sql);
    
    console.log(chalk.green('✅ Created ownership tables:'));
    console.log('  • historical_ownership - Track actual ownership data');
    console.log('  • ownership_factors - Real-time factors affecting ownership');
    console.log('  • dfs_content_mentions - Track tout/expert recommendations');
    console.log('  • social_mentions - Twitter/Reddit buzz tracking');
    console.log('  • contest_results - Store contest data for learning');
    console.log('  • player_narratives - Track revenge games, milestones, etc.');
    
    // Check what data we have
    console.log(chalk.yellow('\n📊 Checking existing data...'));
    
    const checks = [
      { table: 'historical_ownership', desc: 'Historical ownership data' },
      { table: 'ownership_factors', desc: 'Current ownership factors' },
      { table: 'dfs_content_mentions', desc: 'DFS network exposure' },
      { table: 'social_mentions', desc: 'Social media buzz' },
      { table: 'contest_results', desc: 'Contest results' },
      { table: 'player_narratives', desc: 'Player narratives' }
    ];
    
    for (const check of checks) {
      const result = await pgPool.query(
        `SELECT COUNT(*) as count FROM ${check.table}`
      );
      const count = result.rows[0].count;
      if (count > 0) {
        console.log(chalk.green(`  ✓ ${check.desc}: ${count} records`));
      } else {
        console.log(chalk.red(`  ✗ ${check.desc}: No data yet`));
      }
    }
    
    console.log(chalk.yellow('\n⚠️  We need to collect data for these tables:'));
    console.log('  1. Historical ownership from past contests');
    console.log('  2. Social media buzz (Twitter/Reddit mentions)');
    console.log('  3. DFS content site recommendations');
    console.log('  4. Player narratives (revenge games, etc.)');
    
    console.log(chalk.cyan('\n💡 For now, the ownership engine will use:'));
    console.log('  • Value-based projections (what we have)');
    console.log('  • Recent performance data (what we have)');
    console.log('  • Vegas lines (what we have)');
    console.log('  • Injury data (what we have)');
    console.log('  • Weather data (what we have)');
    
    console.log(chalk.green('\n🚀 This is enough to generate decent ownership projections!'));
    console.log(chalk.gray('   (Real data collection can be added later)'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error setting up tables:'), error);
  } finally {
    await pgPool.end();
  }
}

// Run setup
setupOwnershipTables();