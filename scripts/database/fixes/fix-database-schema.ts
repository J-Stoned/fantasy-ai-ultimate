#!/usr/bin/env tsx
/**
 * 🔧 DATABASE SCHEMA FIX
 * Adds missing pattern_results columns and tables
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixDatabaseSchema() {
  console.log(chalk.blue.bold('🔧 FIXING DATABASE SCHEMA\n'));
  
  try {
    // 1. Check if pattern_results column exists
    console.log(chalk.yellow('1. Checking games table schema...'));
    const { data: columns } = await supabase.rpc('get_table_columns', {
      table_name: 'games'
    }).select('column_name');
    
    const hasPatternResults = columns?.some(c => c.column_name === 'pattern_results');
    
    if (!hasPatternResults) {
      console.log(chalk.cyan('   Adding pattern_results column...'));
      
      // Execute migration SQL
      const { error: alterError } = await supabase.rpc('execute_sql', {
        query: `
          ALTER TABLE games 
          ADD COLUMN pattern_results JSONB DEFAULT '{}',
          ADD COLUMN patterns_analyzed BOOLEAN DEFAULT false,
          ADD COLUMN pattern_count INTEGER DEFAULT 0,
          ADD COLUMN total_pattern_roi DECIMAL(5,3) DEFAULT 0;
        `
      });
      
      if (alterError) {
        console.error(chalk.red('Failed to add columns:'), alterError);
      } else {
        console.log(chalk.green('   ✓ Columns added successfully'));
      }
    } else {
      console.log(chalk.green('   ✓ pattern_results column already exists'));
    }
    
    // 2. Create pattern_results table
    console.log(chalk.yellow('\n2. Creating pattern_results table...'));
    const { error: tableError } = await supabase.rpc('execute_sql', {
      query: `
        CREATE TABLE IF NOT EXISTS pattern_results (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          game_id TEXT REFERENCES games(id),
          pattern_name TEXT NOT NULL,
          detected BOOLEAN NOT NULL,
          confidence DECIMAL(3,2),
          expected_roi DECIMAL(5,3),
          details JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          UNIQUE(game_id, pattern_name)
        );
      `
    });
    
    if (tableError) {
      console.error(chalk.red('Failed to create table:'), tableError);
    } else {
      console.log(chalk.green('   ✓ Table created successfully'));
    }
    
    // 3. Create indexes
    console.log(chalk.yellow('\n3. Creating indexes...'));
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_games_pattern_results ON games USING GIN (pattern_results)',
      'CREATE INDEX IF NOT EXISTS idx_pattern_results_game_id ON pattern_results(game_id)',
      'CREATE INDEX IF NOT EXISTS idx_pattern_results_pattern_name ON pattern_results(pattern_name)',
      'CREATE INDEX IF NOT EXISTS idx_pattern_results_detected ON pattern_results(detected)'
    ];
    
    for (const index of indexes) {
      const { error } = await supabase.rpc('execute_sql', { query: index });
      if (error) {
        console.error(chalk.red(`Failed to create index:`, error));
      }
    }
    console.log(chalk.green('   ✓ Indexes created'));
    
    // 4. Create pattern statistics view
    console.log(chalk.yellow('\n4. Creating pattern statistics view...'));
    const { error: viewError } = await supabase.rpc('execute_sql', {
      query: `
        CREATE OR REPLACE VIEW pattern_statistics AS
        SELECT 
          pr.pattern_name,
          COUNT(*) as total_occurrences,
          COUNT(*) FILTER (WHERE pr.detected) as detected_count,
          AVG(pr.confidence) FILTER (WHERE pr.detected) as avg_confidence,
          AVG(pr.expected_roi) FILTER (WHERE pr.detected) as avg_roi,
          COUNT(DISTINCT pr.game_id) as games_analyzed
        FROM pattern_results pr
        GROUP BY pr.pattern_name;
      `
    });
    
    if (viewError) {
      console.error(chalk.red('Failed to create view:'), viewError);
    } else {
      console.log(chalk.green('   ✓ View created successfully'));
    }
    
    console.log(chalk.green.bold('\n✅ SCHEMA FIX COMPLETE!'));
    
  } catch (error) {
    console.error(chalk.red('Schema fix failed:'), error);
  }
}

// If RPC functions don't exist, create simpler version
async function fixDatabaseSchemaSimple() {
  console.log(chalk.blue.bold('🔧 FIXING DATABASE SCHEMA (Simple Method)\n'));
  
  try {
    // Test if pattern_results exists by querying
    console.log(chalk.yellow('Testing games table for pattern_results column...'));
    const { data, error } = await supabase
      .from('games')
      .select('id, pattern_results')
      .limit(1);
      
    if (error && error.message.includes('column "pattern_results" does not exist')) {
      console.log(chalk.red('   Column does not exist - manual intervention needed'));
      console.log(chalk.yellow('\n   Please run the following SQL in Supabase SQL Editor:'));
      console.log(chalk.cyan(`
-- Add pattern columns to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS pattern_results JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS patterns_analyzed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pattern_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_pattern_roi DECIMAL(5,3) DEFAULT 0;

-- Create pattern_results table
CREATE TABLE IF NOT EXISTS pattern_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT REFERENCES games(id),
  pattern_name TEXT NOT NULL,
  detected BOOLEAN NOT NULL,
  confidence DECIMAL(3,2),
  expected_roi DECIMAL(5,3),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(game_id, pattern_name)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_games_pattern_results ON games USING GIN (pattern_results);
CREATE INDEX IF NOT EXISTS idx_pattern_results_game_id ON pattern_results(game_id);
CREATE INDEX IF NOT EXISTS idx_pattern_results_pattern_name ON pattern_results(pattern_name);
CREATE INDEX IF NOT EXISTS idx_pattern_results_detected ON pattern_results(detected);
      `));
    } else if (!error) {
      console.log(chalk.green('   ✓ pattern_results column already exists!'));
    }
    
    // Check if pattern_results table exists
    console.log(chalk.yellow('\nChecking for pattern_results table...'));
    const { error: tableError } = await supabase
      .from('pattern_results')
      .select('count')
      .limit(1);
      
    if (tableError && tableError.message.includes('does not exist')) {
      console.log(chalk.red('   Table does not exist - please create using SQL above'));
    } else {
      console.log(chalk.green('   ✓ pattern_results table exists!'));
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

// Try simple method first
fixDatabaseSchemaSimple().catch(console.error);