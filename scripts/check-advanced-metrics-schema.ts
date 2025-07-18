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
  // Get a sample advanced metric
  const { data: sample } = await supabase
    .from('advanced_metrics')
    .select('*')
    .limit(1);
    
  if (sample && sample.length > 0) {
    console.log(chalk.cyan('\n📊 Advanced Metrics Table Columns:'));
    console.log(Object.keys(sample[0]));
    
    console.log(chalk.yellow('\nSample advanced metric:'));
    console.log(sample[0]);
  } else {
    console.log(chalk.red('No advanced metrics found in database'));
  }
  
  // Also check if table exists
  const { error } = await supabase
    .from('advanced_metrics')
    .select('count')
    .limit(0);
    
  if (error) {
    console.log(chalk.red('\nTable error:'), error.message);
  }
}

checkSchema().catch(console.error);