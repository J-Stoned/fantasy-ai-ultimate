import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function runCleanupFunction() {
  console.log(chalk.bold.magenta('\n🚀 RUNNING DATABASE CLEANUP FUNCTION\n'));
  
  console.log(chalk.yellow('This runs server-side, avoiding client timeouts!\n'));
  
  try {
    // Call the cleanup function via RPC
    const { data, error } = await supabase
      .rpc('cleanup_all_fake_games');
      
    if (error) {
      console.error(chalk.red('Error calling function:'), error);
      console.log(chalk.yellow('\nMake sure you created the function first!'));
      console.log(chalk.gray('Run CREATE-CLEANUP-FUNCTION.sql in Supabase SQL editor'));
      return;
    }
    
    if (data) {
      console.log(chalk.green('✅ CLEANUP SUCCESSFUL!\n'));
      console.log(chalk.cyan('Results:'));
      console.log(`  Stats deleted: ${data.stats_deleted || 0}`);
      console.log(`  Logs deleted: ${data.logs_deleted || 0}`);
      console.log(`  Games deleted: ${data.games_deleted || 0}`);
      console.log(`  Duration: ${data.duration_seconds || 0} seconds`);
    }
    
    // Verify final state
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
      
    console.log(chalk.green(`\n✨ Final game count: ${count}`));
    
  } catch (err) {
    console.error(chalk.red('Unexpected error:'), err);
  }
}

// Instructions
console.log(chalk.bold.cyan('📝 INSTRUCTIONS:\n'));
console.log('1. First, go to Supabase SQL editor:');
console.log(chalk.blue('   https://app.supabase.com/project/pvekvqiqrrpugfmpgaup/sql/new\n'));
console.log('2. Run the CREATE-CLEANUP-FUNCTION.sql to create the function\n');
console.log('3. Then run this script to execute the cleanup\n');
console.log(chalk.yellow('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n'));

setTimeout(() => {
  runCleanupFunction()
    .then(() => console.log(chalk.cyan('\nCleanup complete!\n')))
    .catch(console.error);
}, 5000);