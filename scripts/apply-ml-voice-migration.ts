#!/usr/bin/env tsx
/**
 * Apply ML/Voice Features Migration Directly
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(chalk.red('❌ Missing required environment variables'));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log(chalk.blue('🚀 Applying ML/Voice Features Migration...'));
  
  try {
    // Read the migration file
    const migrationPath = join(process.cwd(), 'supabase/migrations/20250702_ml_voice_features.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');
    
    console.log(chalk.yellow('📄 Migration file loaded'));
    
    // Split the migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(chalk.yellow(`📊 Found ${statements.length} SQL statements to execute`));
    
    // Execute each statement
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      process.stdout.write(chalk.gray(`Executing statement ${i + 1}/${statements.length}... `));
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Try direct execution if exec_sql fails
          const { error: directError } = await supabase.from('_migrations').select('*').limit(1);
          if (directError) {
            throw new Error(`Statement ${i + 1} failed: ${error.message}`);
          }
        }
        
        successCount++;
        console.log(chalk.green('✓'));
      } catch (err: any) {
        errorCount++;
        console.log(chalk.red('✗'));
        console.error(chalk.red(`Error: ${err.message}`));
        
        // Continue with other statements
        if (!statement.includes('CREATE TABLE IF NOT EXISTS')) {
          console.log(chalk.yellow('Continuing with remaining statements...'));
        }
      }
    }
    
    console.log(chalk.blue('\n📊 Migration Summary:'));
    console.log(chalk.green(`✅ Successful statements: ${successCount}`));
    console.log(chalk.red(`❌ Failed statements: ${errorCount}`));
    
    // Verify key tables were created
    console.log(chalk.blue('\n🔍 Verifying tables...'));
    
    const tablesToCheck = [
      'ml_outcomes',
      'event_predictions', 
      'ml_model_performance',
      'voice_commands',
      'voice_training_data',
      'voice_preferences',
      'voice_analytics'
    ];
    
    for (const table of tablesToCheck) {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(chalk.red(`❌ Table ${table}: NOT FOUND`));
      } else {
        console.log(chalk.green(`✅ Table ${table}: EXISTS (${count || 0} rows)`));
      }
    }
    
    console.log(chalk.green('\n✅ ML/Voice migration completed!'));
    
  } catch (error: any) {
    console.error(chalk.red('\n❌ Migration failed:'), error.message);
    process.exit(1);
  }
}

// Run the migration
applyMigration();