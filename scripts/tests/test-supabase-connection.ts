#!/usr/bin/env tsx
/**
 * 🧪 TEST SUPABASE CONNECTION
 * Run this after unpausing your Supabase project
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

async function testSupabaseConnection() {
  console.log(chalk.bold.cyan('🧪 TESTING SUPABASE CONNECTION'));
  console.log(chalk.yellow('═'.repeat(50)));
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.log(chalk.red('❌ Missing environment variables!'));
    console.log(chalk.yellow('\nMake sure .env.local has:'));
    console.log('- NEXT_PUBLIC_SUPABASE_URL');
    console.log('- SUPABASE_SERVICE_ROLE_KEY');
    return;
  }
  
  console.log(chalk.cyan('\n📍 Project Info:'));
  console.log('URL:', chalk.white(url));
  console.log('Project ID:', chalk.white(url.split('.')[0].split('//')[1]));
  
  const supabase = createClient(url, key);
  
  console.log(chalk.cyan('\n🔄 Testing connection...'));
  
  try {
    // Simple health check
    const { count, error, status } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    if (status === 503) {
      console.log(chalk.red('\n❌ DATABASE IS PAUSED!'));
      console.log(chalk.yellow('\nTo fix this:'));
      console.log('1. Go to: https://supabase.com/dashboard');
      console.log('2. Find your project');
      console.log('3. Click "Unpause" or "Resume"');
      console.log('4. Wait 1-2 minutes');
      console.log('5. Run this script again');
      
    } else if (error) {
      console.log(chalk.red('\n❌ Connection Error:'));
      console.log('Error:', error.message);
      console.log('Status:', status);
      
    } else {
      console.log(chalk.green('\n✅ DATABASE IS WORKING!'));
      console.log(chalk.green(`Found ${count || 0} games in database`));
      
      // Check all tables
      console.log(chalk.cyan('\n📊 Checking all tables:'));
      const tables = ['games', 'teams', 'players', 'news_articles', 'ml_predictions'];
      
      for (const table of tables) {
        const { count: tableCount } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        console.log(`${table}: ${chalk.green(tableCount?.toLocaleString() || '0')} records`);
      }
      
      console.log(chalk.bold.green('\n🎉 Everything is working!'));
      console.log(chalk.yellow('\nNext steps:'));
      console.log('1. Run data collector: npx tsx scripts/mega-data-collector-v3.ts');
      console.log('2. Start API: npx tsx scripts/production-api-v3.ts');
      console.log('3. Test predictions: npx tsx scripts/test-working-api.ts');
    }
    
  } catch (err) {
    console.log(chalk.red('\n❌ Unexpected Error:'), err.message);
  }
}

testSupabaseConnection().catch(console.error);