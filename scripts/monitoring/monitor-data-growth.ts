#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

let previousTotal = 0;
let startTotal = 0;
const startTime = Date.now();

async function checkGrowth() {
  const tables = [
    { name: 'players', emoji: '🏃' },
    { name: 'teams', emoji: '🏟️' },
    { name: 'games', emoji: '🏈' },
    { name: 'news_articles', emoji: '📰' },
    { name: 'reddit_sentiment', emoji: '💬' },
  ];
  
  console.clear();
  console.log(chalk.cyan.bold('📊 FANTASY AI DATA MONITOR'));
  console.log(chalk.cyan('==========================\n'));
  
  let currentTotal = 0;
  
  for (const table of tables) {
    try {
      const { count } = await supabase
        .from(table.name)
        .select('*', { count: 'exact', head: true });
      
      if (count !== null) {
        console.log(`${table.emoji} ${table.name}: ${chalk.white.bold(count.toLocaleString())}`);
        currentTotal += count;
      }
    } catch (e) {}
  }
  
  console.log(chalk.cyan('\n' + '─'.repeat(30)));
  console.log(chalk.green.bold(`📈 TOTAL: ${currentTotal.toLocaleString()}`));
  
  if (startTotal === 0) startTotal = currentTotal;
  
  const growth = currentTotal - previousTotal;
  const totalGrowth = currentTotal - startTotal;
  const runtime = Math.floor((Date.now() - startTime) / 1000);
  const rate = runtime > 0 ? Math.floor((totalGrowth / runtime) * 60) : 0;
  
  if (growth > 0) {
    console.log(chalk.yellow(`\n✨ +${growth} new records!`));
  }
  
  console.log(chalk.gray(`\nTotal growth: +${totalGrowth}`));
  console.log(chalk.gray(`Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`));
  console.log(chalk.gray(`Rate: ${rate} records/min`));
  
  if (currentTotal > 100000) {
    console.log(chalk.red.bold('\n🚀 100K MILESTONE REACHED!'));
  }
  
  previousTotal = currentTotal;
}

// Initial check
checkGrowth();

// Check every 5 seconds
setInterval(checkGrowth, 5000);

console.log(chalk.yellow('\nPress Ctrl+C to stop monitoring\n'));