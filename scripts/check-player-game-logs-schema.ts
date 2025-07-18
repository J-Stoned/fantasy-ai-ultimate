import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  console.log(chalk.cyan('Checking player_game_logs schema...\n'));
  
  // Get a sample record to see the structure
  const { data: sample } = await supabase
    .from('player_game_logs')
    .select('*')
    .limit(1);
    
  if (sample && sample.length > 0) {
    console.log('Sample record structure:');
    const record = sample[0];
    Object.keys(record).forEach(key => {
      console.log(`  ${key}: ${typeof record[key]} (value: ${JSON.stringify(record[key])?.substring(0, 50)}...)`);
    });
  }
  
  // Try to get NCAA Hockey specific records
  console.log(chalk.yellow('\n\nChecking for NCAA Hockey records...'));
  const { data: ncaaHockey } = await supabase
    .from('player_game_logs')
    .select('*')
    .eq('sport', 'NCAA_HKY')
    .limit(5);
    
  if (ncaaHockey && ncaaHockey.length > 0) {
    console.log(`Found ${ncaaHockey.length} NCAA Hockey records`);
    console.log('\nStats structure:');
    const stats = ncaaHockey[0].stats;
    if (stats) {
      console.log(JSON.stringify(stats, null, 2));
    }
  } else {
    console.log('No NCAA Hockey records found yet');
  }
}

checkSchema()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });