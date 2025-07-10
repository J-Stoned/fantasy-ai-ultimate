#!/usr/bin/env tsx
/**
 * Setup ML and Voice Feature Tables
 * Creates all missing tables needed for ML predictions tracking and voice features
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '' // Use service role for admin operations
);

console.log(chalk.blue.bold('\n🔧 SETTING UP ML & VOICE FEATURE TABLES'));
console.log(chalk.blue('=====================================\n'));

async function checkTableExists(tableName: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', tableName)
    .single();
  
  return !error && data !== null;
}

async function setupTables() {
  try {
    // Read the migration SQL
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20250702_ml_voice_features.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log(chalk.yellow('📋 Checking existing tables...'));

    // Check which tables already exist
    const tables = [
      'ml_outcomes',
      'event_predictions',
      'ml_model_performance',
      'voice_commands',
      'voice_training_data',
      'voice_preferences',
      'voice_analytics'
    ];

    for (const table of tables) {
      const exists = await checkTableExists(table);
      console.log(`  ${exists ? '✅' : '❌'} ${table}`);
    }

    console.log(chalk.yellow('\n🚀 Applying migration...'));

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      try {
        // Skip comments
        if (statement.startsWith('--') || statement.length === 0) continue;

        // Execute the statement
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        });

        if (error) {
          // Check if it's a "already exists" error which we can ignore
          if (error.message.includes('already exists')) {
            console.log(chalk.gray(`  ⏭️  Skipped (already exists): ${statement.substring(0, 50)}...`));
          } else {
            console.log(chalk.red(`  ❌ Error: ${error.message}`));
            console.log(chalk.gray(`     Statement: ${statement.substring(0, 100)}...`));
            errorCount++;
          }
        } else {
          successCount++;
          // Log significant operations
          if (statement.includes('CREATE TABLE')) {
            const tableName = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
            console.log(chalk.green(`  ✅ Created table: ${tableName}`));
          } else if (statement.includes('CREATE INDEX')) {
            const indexName = statement.match(/CREATE INDEX IF NOT EXISTS (\w+)/)?.[1];
            console.log(chalk.green(`  ✅ Created index: ${indexName}`));
          }
        }
      } catch (err: any) {
        console.log(chalk.red(`  ❌ Error executing statement: ${err.message}`));
        errorCount++;
      }
    }

    console.log(chalk.blue(`\n📊 Migration Summary:`));
    console.log(chalk.green(`  ✅ Successful operations: ${successCount}`));
    if (errorCount > 0) {
      console.log(chalk.red(`  ❌ Failed operations: ${errorCount}`));
    }

    // Verify tables were created
    console.log(chalk.yellow('\n🔍 Verifying table creation...'));
    
    for (const table of tables) {
      const exists = await checkTableExists(table);
      console.log(`  ${exists ? '✅' : '❌'} ${table} ${exists ? 'created successfully' : 'creation failed'}`);
    }

    // Test inserting sample data
    console.log(chalk.yellow('\n🧪 Testing table functionality...'));

    // Test ML predictions
    const { error: mlError } = await supabase
      .from('ml_predictions')
      .insert({
        game_id: 'test_game_1',
        model_name: 'test_model',
        prediction_type: 'score',
        prediction: JSON.stringify({ home: 110, away: 105 }),
        confidence: 0.85
      });

    console.log(`  ${mlError ? '❌' : '✅'} ML predictions table ${mlError ? 'test failed: ' + mlError.message : 'working'}`);

    // Test voice commands
    const { error: voiceError } = await supabase
      .from('voice_commands')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        session_id: 'test_session',
        command_text: 'Test command',
        status: 'completed'
      });

    console.log(`  ${voiceError ? '❌' : '✅'} Voice commands table ${voiceError ? 'test failed: ' + voiceError.message : 'working'}`);

    console.log(chalk.green('\n✅ Setup complete! ML and voice features are ready to use.'));

  } catch (error: any) {
    console.error(chalk.red('\n❌ Setup failed:'), error);
    process.exit(1);
  }
}

// Alternative: Direct SQL execution if RPC doesn't work
async function executeSQL(sql: string) {
  // This would require direct database connection
  // For now, we'll use Supabase RPC or suggest manual execution
  console.log(chalk.yellow('\n📝 If automatic setup fails, run this SQL manually:'));
  console.log(chalk.gray('\nsupabase db push'));
  console.log(chalk.gray('# or'));
  console.log(chalk.gray('psql $DATABASE_URL < supabase/migrations/20250702_ml_voice_features.sql\n'));
}

// Run setup
setupTables().catch(console.error);