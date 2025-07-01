#!/usr/bin/env tsx
/**
 * Run collection_state migration
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runMigration() {
  console.log(chalk.blue('Running collection_state migration...'));
  
  const sql = fs.readFileSync('./supabase/migrations/20250107_collection_state.sql', 'utf8');
  
  // Split by semicolons and run each statement
  const statements = sql.split(';').filter(s => s.trim());
  
  for (const statement of statements) {
    if (statement.trim()) {
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' }).single();
        if (error) {
          console.error(chalk.red('Error:'), error.message);
          // Try direct query as fallback
          console.log('Trying direct approach...');
        }
      } catch (e) {
        console.log(chalk.yellow('Note: exec_sql not available, migration needs manual run'));
      }
    }
  }
  
  // Verify table exists
  const { data, error } = await supabase.from('collection_state').select('*');
  if (error) {
    console.log(chalk.red('❌ Migration failed - table not created'));
    console.log(chalk.yellow('\nPlease run the SQL in supabase/migrations/20250107_collection_state.sql manually in Supabase dashboard'));
  } else {
    console.log(chalk.green('✅ Migration successful - collection_state table ready!'));
    console.log(chalk.gray(`Found ${data.length} collector states`));
  }
}

runMigration().catch(console.error);