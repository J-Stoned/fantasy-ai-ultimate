#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  // Get a sample betting line
  const { data: sample } = await supabase
    .from('betting_lines')
    .select('*')
    .limit(1);
    
  if (sample && sample.length > 0) {
    console.log(chalk.cyan('\n📊 Betting Lines Table Columns:'));
    console.log(Object.keys(sample[0]));
    
    console.log(chalk.yellow('\nSample betting line:'));
    console.log(sample[0]);
  } else {
    console.log(chalk.red('No betting lines found in database'));
  }
}

checkSchema().catch(console.error);