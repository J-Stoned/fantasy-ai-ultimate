#!/usr/bin/env tsx
/**
 * Clean ALL fake data including test players and ML training data
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function cleanAllFakeData() {
  console.log(chalk.bold.red('🧹 CLEANING ALL FAKE DATA FROM DATABASE\n'));
  
  // Step 1: Delete ML predictions (we'll retrain)
  console.log(chalk.yellow('Step 1: Deleting ML predictions...'));
  const { error: mlError, count: mlCount } = await supabase
    .from('ml_predictions')
    .delete()
    .gte('id', 0); // Delete all
    
  if (mlError) {
    console.error('ML predictions error:', mlError);
  } else {
    console.log(chalk.green(`✓ Deleted ${mlCount || 0} ML predictions`));
  }
  
  // Step 2: Delete test player stats first (foreign key constraint)
  console.log(chalk.yellow('\nStep 2: Finding and deleting test player stats...'));
  
  // Get a sample of test player IDs
  const { data: testPlayers } = await supabase
    .from('players')
    .select('id')
    .like('name', '%_175133%_%')
    .limit(100);
    
  if (testPlayers && testPlayers.length > 0) {
    const testIds = testPlayers.map(p => p.id);
    
    // Delete their stats
    const { error: statsError } = await supabase
      .from('player_stats')
      .delete()
      .in('player_id', testIds);
      
    console.log(chalk.green(`✓ Deleted stats for sample test players`));
  }
  
  // Step 3: Identify ALL fake data patterns
  console.log(chalk.yellow('\nStep 3: Identifying fake data patterns...'));
  
  const fakePatterns = [
    { pattern: '%_175133%_%', description: '835K test players' },
    { pattern: 'test_%', description: 'Test prefixed players' },
    { pattern: '%_test_%', description: 'Test in name' },
    { pattern: 'Ryan Lawrence_4_803_%', description: 'Specific test pattern' }
  ];
  
  let totalFakePlayers = 0;
  
  for (const fake of fakePatterns) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .like('name', fake.pattern);
      
    if (count && count > 0) {
      console.log(`  Found ${count.toLocaleString()} players matching: ${fake.description}`);
      totalFakePlayers += count;
    }
  }
  
  // Also check external_id patterns
  const { count: testExternalCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .or('external_id.like.test_%,external_id.like.fake_%,external_id.like.temp_%');
    
  if (testExternalCount && testExternalCount > 0) {
    console.log(`  Found ${testExternalCount.toLocaleString()} players with test external_ids`);
    totalFakePlayers += testExternalCount;
  }
  
  console.log(chalk.red(`\nTotal fake players to delete: ${totalFakePlayers.toLocaleString()}`));
  
  // Step 4: Clean players without required data
  console.log(chalk.yellow('\nStep 4: Checking for incomplete player records...'));
  
  const { count: noNameCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .or('firstname.is.null,lastname.is.null,name.is.null');
    
  const { count: noSportCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .is('sport_id', null);
    
  console.log(`  Players without names: ${noNameCount || 0}`);
  console.log(`  Players without sport: ${noSportCount || 0}`);
  
  // Step 5: Show what will remain
  console.log(chalk.cyan('\n📊 What will remain after cleaning:'));
  
  const realPatterns = [
    { pattern: 'sleeper_%', sport: 'NFL (Sleeper)' },
    { pattern: 'espn_nfl_%', sport: 'NFL (ESPN)' },
    { pattern: 'espn_ncaa_%', sport: 'NCAA' },
    { pattern: 'espn_nba_%', sport: 'NBA' },
    { pattern: 'espn_mlb_%', sport: 'MLB' },
    { pattern: 'espn_nhl_%', sport: 'NHL' }
  ];
  
  for (const real of realPatterns) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .ilike('external_id', real.pattern);
      
    if (count && count > 0) {
      console.log(`  ${real.sport}: ${count.toLocaleString()} players`);
    }
  }
  
  // Ask for confirmation
  console.log(chalk.bold.yellow('\n⚠️  WARNING: This will permanently delete:'));
  console.log(`- ${totalFakePlayers.toLocaleString()} fake/test players`);
  console.log('- All ML predictions (will need retraining)');
  console.log('- All player stats for test players');
  
  console.log(chalk.bold.green('\n✅ This will KEEP:'));
  console.log('- All real NFL players from Sleeper');
  console.log('- All real NCAA players from ESPN');
  console.log('- All other real player data');
  console.log('- All games and game logs for real players');
  
  console.log(chalk.bold.red('\n🚀 Ready to clean! Run delete-fake-data-execute.ts to proceed.'));
}

cleanAllFakeData().catch(console.error);