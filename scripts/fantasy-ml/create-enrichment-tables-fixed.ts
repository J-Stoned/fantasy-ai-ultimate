#!/usr/bin/env tsx
/**
 * Create missing enrichment tables - FIXED version
 */

import chalk from 'chalk';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL,
});

async function createEnrichmentTables() {
  console.log(chalk.cyan.bold('\n🏗️ Creating Missing Enrichment Tables\n'));
  
  try {
    // 1. First add id column to referee_profiles if missing
    console.log(chalk.yellow('Adding id column to referee_profiles...'));
    await pool.query(`
      ALTER TABLE referee_profiles 
      ADD COLUMN IF NOT EXISTS id SERIAL PRIMARY KEY
    `);
    console.log(chalk.green('✅ referee_profiles id column added'));
    
    // 2. Create referee_game_assignments table
    console.log(chalk.yellow('\nCreating referee_game_assignments table...'));
    await pool.query(`
      CREATE TABLE IF NOT EXISTS referee_game_assignments (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES games_master(id),
        referee_id INTEGER REFERENCES referee_profiles(id),
        position VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(game_id, referee_id)
      )
    `);
    console.log(chalk.green('✅ referee_game_assignments table created'));
    
    // 3. Create umpire_game_assignments table (umpire_profiles already has id)
    console.log(chalk.yellow('\nCreating umpire_game_assignments table...'));
    await pool.query(`
      CREATE TABLE IF NOT EXISTS umpire_game_assignments (
        id SERIAL PRIMARY KEY,
        game_id INTEGER REFERENCES games_master(id),
        umpire_id VARCHAR(50) REFERENCES umpire_profiles(id),
        position VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(game_id, umpire_id)
      )
    `);
    console.log(chalk.green('✅ umpire_game_assignments table created'));
    
    // Add indexes for performance
    console.log(chalk.yellow('\nAdding indexes...'));
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_weather_game_id ON weather_data(game_id);
      CREATE INDEX IF NOT EXISTS idx_referee_assignments_game ON referee_game_assignments(game_id);
      CREATE INDEX IF NOT EXISTS idx_referee_assignments_ref ON referee_game_assignments(referee_id);
      CREATE INDEX IF NOT EXISTS idx_umpire_assignments_game ON umpire_game_assignments(game_id);
      CREATE INDEX IF NOT EXISTS idx_umpire_assignments_ump ON umpire_game_assignments(umpire_id);
    `);
    console.log(chalk.green('✅ Indexes created'));
    
    // Verify all enrichment tables exist
    console.log(chalk.yellow('\n📊 Verifying all enrichment tables:'));
    const tables = [
      'weather_data',
      'referee_game_assignments',
      'referee_profiles',
      'umpire_game_assignments',
      'umpire_profiles',
      'situational_performance',
      'injury_reports'
    ];
    
    for (const table of tables) {
      const result = await pool.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      `, [table]);
      
      if (result.rows[0].count > 0) {
        const countResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(chalk.green(`✅ ${table}: exists with ${countResult.rows[0].count} records`));
      } else {
        console.log(chalk.red(`❌ ${table}: does not exist`));
      }
    }
    
    console.log(chalk.green.bold('\n✅ All enrichment tables created successfully!'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await pool.end();
  }
}

createEnrichmentTables().catch(console.error);