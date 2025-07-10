#!/usr/bin/env tsx
/**
 * DATABASE STATUS CHECKER
 * Simple script to check current database records
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

console.log(chalk.cyan.bold('\n📊 FANTASY AI DATABASE STATUS'));
console.log(chalk.cyan('================================\n'));

async function checkDatabase() {
  try {
    // Test connection
    const { data: test, error: testError } = await supabase
      .from('players')
      .select('id')
      .limit(1);

    if (testError) {
      console.log(chalk.red('❌ Database connection FAILED'));
      console.log(chalk.red(`Error: ${testError.message}`));
      return;
    }

    console.log(chalk.green('✅ Database connected!\n'));

    // Count records in each table
    const tables = [
      { name: 'players', label: '🏃 Players' },
      { name: 'teams_master', label: '🏟️ Teams' },
      { name: 'games', label: '🏈 Games' },
      { name: 'news_articles', label: '📰 News Articles' },
      { name: 'sentiment', label: '💬 Sentiment' }
    ];

    let totalRecords = 0;
    
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table.name)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`${table.label}: ${chalk.yellow('Table not found or error')}`);
        } else {
          const recordCount = count || 0;
          totalRecords += recordCount;
          console.log(`${table.label}: ${chalk.bold.white(recordCount.toLocaleString())}`);
        }
      } catch (err) {
        console.log(`${table.label}: ${chalk.red('Error accessing table')}`);
      }
    }

    console.log(chalk.cyan('\n' + '─'.repeat(32)));
    console.log(chalk.bold.green(`🔥 TOTAL RECORDS: ${totalRecords.toLocaleString()}`));
    
    // Calculate collection rate
    const collectTime = 2; // minutes since collection started
    const rate = Math.floor(totalRecords / collectTime);
    console.log(chalk.yellow(`📈 Collection rate: ~${rate.toLocaleString()} records/minute`));
    
    // ETA to 1M records
    if (rate > 0) {
      const remaining = 1000000 - totalRecords;
      const minutesToGo = Math.ceil(remaining / rate);
      const hours = Math.floor(minutesToGo / 60);
      const minutes = minutesToGo % 60;
      console.log(chalk.magenta(`⏱️  ETA to 1M records: ${hours}h ${minutes}m`));
    }

  } catch (error) {
    console.log(chalk.red('❌ Unexpected error:'), error);
  }
}

// Run the check
checkDatabase()
  .then(() => {
    console.log(chalk.cyan('\n✨ Check complete!\n'));
    process.exit(0);
  })
  .catch((err) => {
    console.error(chalk.red('Fatal error:'), err);
    process.exit(1);
  });