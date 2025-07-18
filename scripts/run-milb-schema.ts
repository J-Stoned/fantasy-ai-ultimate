import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import { readFileSync } from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runSQLFile(filename: string, description: string) {
  console.log(chalk.yellow(`\n📝 ${description}...`));
  
  try {
    const sql = readFileSync(filename, 'utf8');
    
    // Since Supabase doesn't have a direct SQL execution method,
    // we'll need to check what columns/tables exist first
    
    // For now, let's just verify the database connection
    const { data, error } = await supabase
      .from('teams')
      .select('id')
      .limit(1);
      
    if (error) {
      console.error(chalk.red(`Database error: ${error.message}`));
      return false;
    }
    
    console.log(chalk.green(`✅ ${description} - SQL file ready`));
    console.log(chalk.cyan(`\nPlease run the following command in your database console:`));
    console.log(chalk.white(`\\i ${filename}`));
    
    return true;
    
  } catch (error) {
    console.error(chalk.red(`Error: ${error}`));
    return false;
  }
}

async function main() {
  console.log(chalk.cyan('🔧 MiLB Database Schema Setup'));
  console.log(chalk.yellow('\nNote: This script prepares SQL files for manual execution.'));
  
  // Test database connection
  const { data: test, error: testError } = await supabase
    .from('teams')
    .select('count')
    .limit(1);
    
  if (testError) {
    console.error(chalk.red('Database connection failed:'), testError);
    process.exit(1);
  }
  
  console.log(chalk.green('✅ Database connection successful'));
  
  // Check existing columns
  console.log(chalk.cyan('\n📊 Checking existing schema...'));
  
  // Try to query with MiLB columns to see if they exist
  const { data: teamCheck, error: teamError } = await supabase
    .from('teams')
    .select('id, league_level')
    .limit(1);
    
  if (teamError && teamError.message.includes('league_level')) {
    console.log(chalk.yellow('⚠️  MiLB columns not found in teams table - schema update needed'));
  } else {
    console.log(chalk.green('✅ Some MiLB columns may already exist'));
  }
  
  // Prepare SQL files
  const sqlFiles = [
    { file: 'scripts/milb-schema-step1.sql', desc: 'Step 1: Teams table columns' },
    { file: 'scripts/milb-schema-step2.sql', desc: 'Step 2: Games and Players columns' },
    { file: 'scripts/milb-schema-step3.sql', desc: 'Step 3: New MiLB tables' }
  ];
  
  console.log(chalk.cyan('\n📄 SQL files prepared:'));
  for (const { file, desc } of sqlFiles) {
    await runSQLFile(file, desc);
  }
  
  console.log(chalk.cyan('\n\n🎯 Next Steps:'));
  console.log(chalk.white('1. Connect to your database using psql or Supabase SQL Editor'));
  console.log(chalk.white('2. Run each SQL file in order:'));
  console.log(chalk.gray('   psql $DATABASE_URL -f scripts/milb-schema-step1.sql'));
  console.log(chalk.gray('   psql $DATABASE_URL -f scripts/milb-schema-step2.sql'));
  console.log(chalk.gray('   psql $DATABASE_URL -f scripts/milb-schema-step3.sql'));
  console.log(chalk.white('\n3. Or copy/paste the SQL content into Supabase SQL Editor'));
  console.log(chalk.white('4. Then run: npx tsx scripts/milb-universal-collector.ts'));
  
  // Let's also try a workaround - update the collector to work without the new columns
  console.log(chalk.cyan('\n\n🚀 Alternative: Creating a collector that works with existing schema...'));
}

main().catch(console.error);