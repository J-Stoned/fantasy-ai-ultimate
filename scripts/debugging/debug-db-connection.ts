#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

console.log(chalk.bold.cyan('🔍 DEBUGGING DATABASE CONNECTION'));
console.log(chalk.yellow('═'.repeat(50)));

// Check environment variables
console.log(chalk.cyan('\n1️⃣ Environment Variables:'));
console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
console.log('SUPABASE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log(chalk.red('\n❌ Missing environment variables!'));
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testConnection() {
  console.log(chalk.cyan('\n2️⃣ Testing Basic Query:'));
  
  try {
    // Try a simple count query
    const { count, error, status, statusText } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(chalk.red('❌ Query Error:'), error);
      console.log('Status:', status);
      console.log('Status Text:', statusText);
    } else {
      console.log(chalk.green('✅ Query Success!'));
      console.log('Games count:', count);
    }
    
    // Try to get one record
    console.log(chalk.cyan('\n3️⃣ Testing Data Fetch:'));
    const { data, error: fetchError } = await supabase
      .from('games')
      .select('id')
      .limit(1);
    
    if (fetchError) {
      console.log(chalk.red('❌ Fetch Error:'), fetchError);
    } else if (data && data.length > 0) {
      console.log(chalk.green('✅ Can fetch data!'));
      console.log('Sample game ID:', data[0].id);
    } else {
      console.log(chalk.yellow('⚠️ No data found'));
    }
    
    // Check table existence
    console.log(chalk.cyan('\n4️⃣ Checking Tables:'));
    const tables = ['games', 'teams', 'players', 'ml_predictions'];
    
    for (const table of tables) {
      const { error: tableError } = await supabase
        .from(table)
        .select('id')
        .limit(1);
      
      if (tableError) {
        console.log(chalk.red(`❌ ${table}:`), tableError.message);
      } else {
        console.log(chalk.green(`✅ ${table}: accessible`));
      }
    }
    
  } catch (err) {
    console.log(chalk.red('\n❌ Connection Error:'), err);
  }
}

testConnection().catch(console.error);