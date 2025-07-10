import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function verifyCleanup() {
  console.log(chalk.bold.cyan('\n🔍 VERIFYING CLEANUP OPERATIONS\n'));
  
  // Get initial count
  const { count: beforeCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null);
    
  console.log(chalk.yellow(`BEFORE: ${beforeCount} fake games`));
  
  // Try to delete a small batch
  const { data: gamesToDelete } = await supabase
    .from('games')
    .select('id')
    .is('external_id', null)
    .limit(100);
    
  if (!gamesToDelete || gamesToDelete.length === 0) {
    console.log(chalk.green('No fake games found!'));
    return;
  }
  
  const gameIds = gamesToDelete.map(g => g.id);
  console.log(chalk.gray(`\nAttempting to delete ${gameIds.length} games...`));
  console.log(chalk.gray(`Game IDs: ${gameIds.slice(0, 5).join(', ')}...`));
  
  // Delete with explicit error handling
  const { data: deleteData, error: deleteError, count: deleteCount } = await supabase
    .from('games')
    .delete()
    .in('id', gameIds);
    
  if (deleteError) {
    console.log(chalk.red('\n❌ DELETE FAILED:'));
    console.log(chalk.red(`Error code: ${deleteError.code}`));
    console.log(chalk.red(`Error message: ${deleteError.message}`));
    console.log(chalk.red(`Error details: ${deleteError.details}`));
  } else {
    console.log(chalk.green(`\n✅ Delete operation completed`));
    console.log(chalk.cyan(`Reported count: ${deleteCount}`));
    console.log(chalk.cyan(`Delete data: ${JSON.stringify(deleteData)}`));
  }
  
  // Wait a moment for database to update
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Get after count
  const { count: afterCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null);
    
  console.log(chalk.yellow(`\nAFTER: ${afterCount} fake games`));
  console.log(chalk.bold.magenta(`\nACTUAL DELETED: ${(beforeCount || 0) - (afterCount || 0)} games`));
  
  if (beforeCount === afterCount) {
    console.log(chalk.red('\n⚠️  NO GAMES WERE ACTUALLY DELETED!'));
    console.log(chalk.yellow('Possible reasons:'));
    console.log('1. Database might be read-only or paused');
    console.log('2. RLS policies might be preventing deletes');
    console.log('3. Foreign key constraints still blocking');
  }
}

verifyCleanup()
  .catch(console.error);