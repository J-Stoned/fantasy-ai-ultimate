#!/usr/bin/env tsx
/**
 * 🚀 Create Fantasy ML Tables
 * Creates the missing tables for our fantasy ML system
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  console.log(chalk.bold.cyan('🚀 CREATING FANTASY ML TABLES...'));
  
  try {
    const sql = fs.readFileSync('scripts/sql/create-fantasy-ml-tables.sql', 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    console.log(chalk.yellow(`Found ${statements.length} SQL statements to execute`));
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement && !statement.startsWith('--')) {
        console.log(chalk.cyan(`Executing statement ${i + 1}/${statements.length}...`));
        
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
        
        if (error) {
          if (error.message.includes('already exists')) {
            console.log(chalk.yellow('  → Already exists, skipping'));
          } else {
            console.error(chalk.red('  → Error:'), error.message);
            throw error;
          }
        } else {
          console.log(chalk.green('  → Success!'));
        }
      }
    }
    
    console.log(chalk.bold.green('\n✅ FANTASY ML TABLES CREATED!'));
    console.log(chalk.yellow('Tables available:'));
    console.log(chalk.cyan('  • player_projections'));
    console.log(chalk.cyan('  • dfs_lineups'));
    console.log(chalk.cyan('  • fantasy_schedule_strength'));
    console.log(chalk.cyan('  • player_value_metrics'));
    console.log(chalk.cyan('  • stack_correlations'));
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to create tables:'), error);
    process.exit(1);
  }
}

createTables();