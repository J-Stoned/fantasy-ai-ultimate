#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGamesSchema() {
  console.log(chalk.cyan('Checking games table schema...'));
  
  // Get a sample game
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error(chalk.red('Error:'), error);
    return;
  }
  
  if (data && data.length > 0) {
    console.log(chalk.green('\nGames table columns:'));
    const columns = Object.keys(data[0]);
    columns.forEach(col => {
      const value = data[0][col];
      const type = value === null ? 'null' : typeof value;
      console.log(chalk.yellow(`  ${col}: ${type}`));
    });
    
    console.log(chalk.cyan('\nSample game:'));
    console.log(data[0]);
  } else {
    console.log(chalk.yellow('No games found in database'));
  }
}

checkGamesSchema().catch(console.error);