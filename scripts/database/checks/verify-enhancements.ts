#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyEnhancements() {
  console.log(chalk.bold.blue('\n🔍 VERIFYING SCHEMA ENHANCEMENTS'));
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
        console.log(chalk.red(`❌ ${check.name}: FAILED`));
        failed++;
      } else {
        console.log(chalk.green(`✅ ${check.name}: PASSED`));
        passed++;
      }
    } catch (e) {
      console.log(chalk.red(`❌ ${check.name}: FAILED`));
      failed++;
    }
  }
  
  console.log(chalk.bold.blue('\n📊 VERIFICATION SUMMARY:'));
  console.log(chalk.green(`✅ Passed: ${passed}`));
  console.log(chalk.red(`❌ Failed: ${failed}`));
  
  if (failed === 0) {
    console.log(chalk.bold.green('\n🎉 All enhancements verified successfully!'));
    console.log(chalk.yellow('\nNext steps:'));
    console.log('1. Update data collectors to use new schema features');
    console.log('2. Migrate existing player_stats to player_game_logs');
    console.log('3. Test enhanced ML training with new features');
  } else {
    console.log(chalk.bold.red('\n⚠️  Some enhancements are missing!'));
    console.log(chalk.yellow('Please run the SQL script in Supabase dashboard first.'));
  }
}

verifyEnhancements().catch(console.error);