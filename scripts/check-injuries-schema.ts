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
  console.log(chalk.blue('\n🔍 Checking player_injuries schema...\n'));
  
  // Try different column names
  const attempts = [
    {
      player_id: 24,
      injury_type: 'hamstring',
      status: 'questionable'
    },
    {
      player_id: 24,
      type: 'hamstring',
      status: 'questionable'
    },
    {
      player_id: 24,
      injury: 'hamstring',
      status: 'questionable'  
    }
  ];
  
  for (const attempt of attempts) {
    console.log(chalk.yellow('Trying:'), Object.keys(attempt));
    
    const { data, error } = await supabase
      .from('player_injuries')
      .insert(attempt)
      .select();
      
    if (error) {
      console.log(chalk.red('Error:'), error.message);
    } else {
      console.log(chalk.green('Success!'));
      console.log('Record structure:', data?.[0] ? Object.keys(data[0]) : 'empty');
      
      // Clean up
      if (data?.[0]) {
        await supabase.from('player_injuries').delete().eq('id', data[0].id);
      }
      break;
    }
  }
  
  // Check existing records
  const { data: existing } = await supabase
    .from('player_injuries')
    .select('*')
    .limit(1);
    
  if (existing && existing.length > 0) {
    console.log('\nExisting record structure:', Object.keys(existing[0]));
    console.log('Sample:', existing[0]);
  }
}

checkSchema().catch(console.error);