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
  console.log(chalk.bold.cyan('Checking player_game_logs schema...\n'));

  // Get a sample row
  const { data, error } = await supabase
    .from('player_game_logs')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Current columns in player_game_logs:');
    const columns = Object.keys(data[0]).sort();
    columns.forEach(col => {
      const value = data[0][col];
      const type = value === null ? 'null' : typeof value;
      console.log(`  ${col}: ${type}`);
    });
    
    console.log('\nStats-related columns found:');
    const statsColumns = columns.filter(col => 
      col.includes('passing') || 
      col.includes('rushing') || 
      col.includes('receiving') ||
      col.includes('fantasy') ||
      col.includes('yards') ||
      col.includes('touchdowns')
    );
    console.log(statsColumns.join(', '));
  } else {
    console.log('No data found in player_game_logs');
  }
}

checkSchema();