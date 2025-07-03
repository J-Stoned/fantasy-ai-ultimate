import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log(chalk.bold.blue('\n🔧 APPLYING SCHEMA ENHANCEMENTS'));
console.log(chalk.gray('='.repeat(50)));

async function testConnection() {
  console.log(chalk.yellow('Testing database connection...'));
  
  const { count, error } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error(chalk.red('❌ Database connection failed:'), error);
    return false;
  }
  
  console.log(chalk.green(`✅ Connected! Found ${count} players`));
  return true;
}

async function applyEnhancements() {
  console.log(chalk.yellow('\n📝 Reading enhancement SQL...'));
  
  const sqlContent = fs.readFileSync('./scripts/enhance-schema-for-complex-features.sql', 'utf-8');
  
  console.log(chalk.blue('\n🚀 Enhancement Summary:'));
  console.log('  1. Add external_id columns for API mappings');
  console.log('  2. Add metadata JSONB columns for flexibility');
  console.log('  3. Create player_platform_mapping table');
  console.log('  4. Create player_game_logs table');
  console.log('  5. Create player_season_stats table');
  console.log('  6. Add performance indexes');
  console.log('  7. Create helper functions and views');
  
  console.log(chalk.yellow('\n⚠️  Important Notes:'));
  console.log('  - Keeps existing integer IDs (no breaking changes)');
  console.log('  - Adds new features alongside existing schema');
  console.log('  - Provides migration path to complex schema');
  console.log('  - All changes are additive (safe to apply)');
  
  console.log(chalk.red('\n⚠️  Manual Step Required:'));
  console.log('  Due to Supabase restrictions, you need to run the SQL manually:');
  console.log('  1. Go to Supabase Dashboard > SQL Editor');
  console.log('  2. Copy the contents of: scripts/enhance-schema-for-complex-features.sql');
  console.log('  3. Run the SQL in the editor');
  console.log('  4. Come back and run the verification script');
  
  // Save a verification script
  const verificationScript = `
-- Verification queries to check if enhancements were applied
SELECT 
  'players_external_id' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'external_id'
  ) as passed
UNION ALL
SELECT 
  'player_platform_mapping_table' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'player_platform_mapping'
  ) as passed
UNION ALL
SELECT 
  'player_game_logs_table' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'player_game_logs'
  ) as passed
UNION ALL
SELECT 
  'player_season_stats_table' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'player_season_stats'
  ) as passed;
`;
  
  fs.writeFileSync('./scripts/verify-schema-enhancements.sql', verificationScript);
  console.log(chalk.green('\n✅ Created verification script: scripts/verify-schema-enhancements.sql'));
}

async function createVerificationScript() {
  console.log(chalk.yellow('\n📝 Creating verification script...'));
  
  const verifyScript = `import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyEnhancements() {
  console.log(chalk.bold.blue('\\n🔍 VERIFYING SCHEMA ENHANCEMENTS'));
  console.log(chalk.gray('='.repeat(50)));
  
  const checks = [
    { name: 'players.external_id column', query: () => supabase.from('players').select('external_id').limit(0) },
    { name: 'players.metadata column', query: () => supabase.from('players').select('metadata').limit(0) },
    { name: 'games.external_id column', query: () => supabase.from('games').select('external_id').limit(0) },
    { name: 'player_platform_mapping table', query: () => supabase.from('player_platform_mapping').select('*').limit(0) },
    { name: 'player_game_logs table', query: () => supabase.from('player_game_logs').select('*').limit(0) },
    { name: 'player_season_stats table', query: () => supabase.from('player_season_stats').select('*').limit(0) },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const check of checks) {
    try {
      const { error } = await check.query();
      if (error) {
        console.log(chalk.red(\`❌ \${check.name}: FAILED\`));
        failed++;
      } else {
        console.log(chalk.green(\`✅ \${check.name}: PASSED\`));
        passed++;
      }
    } catch (e) {
      console.log(chalk.red(\`❌ \${check.name}: FAILED\`));
      failed++;
    }
  }
  
  console.log(chalk.bold.blue('\\n📊 VERIFICATION SUMMARY:'));
  console.log(chalk.green(\`✅ Passed: \${passed}\`));
  console.log(chalk.red(\`❌ Failed: \${failed}\`));
  
  if (failed === 0) {
    console.log(chalk.bold.green('\\n🎉 All enhancements verified successfully!'));
    console.log(chalk.yellow('\\nNext steps:'));
    console.log('1. Update data collectors to use new schema features');
    console.log('2. Migrate existing player_stats to player_game_logs');
    console.log('3. Test enhanced ML training with new features');
  } else {
    console.log(chalk.bold.red('\\n⚠️  Some enhancements are missing!'));
    console.log(chalk.yellow('Please run the SQL script in Supabase dashboard first.'));
  }
}

verifyEnhancements().catch(console.error);`;

  fs.writeFileSync('./scripts/verify-enhancements.ts', verifyScript);
  console.log(chalk.green('✅ Created: scripts/verify-enhancements.ts'));
  console.log(chalk.yellow('\nRun this after applying SQL: npx tsx scripts/verify-enhancements.ts'));
}

async function main() {
  const connected = await testConnection();
  if (!connected) {
    console.error(chalk.red('\n❌ Cannot proceed without database connection'));
    return;
  }
  
  await applyEnhancements();
  await createVerificationScript();
  
  console.log(chalk.bold.green('\n✨ Schema enhancement preparation complete!'));
  console.log(chalk.yellow('\n📋 Next Steps:'));
  console.log('1. Copy scripts/enhance-schema-for-complex-features.sql');
  console.log('2. Run it in Supabase SQL Editor');
  console.log('3. Run: npx tsx scripts/verify-enhancements.ts');
  console.log('4. Update collectors to use enhanced schema');
}

main().catch(console.error);