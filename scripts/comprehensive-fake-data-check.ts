#!/usr/bin/env tsx
/**
 * Comprehensive check for ALL fake/test data in database
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function comprehensiveFakeDataCheck() {
  console.log(chalk.bold.red('🔍 COMPREHENSIVE FAKE/TEST DATA CHECK\n'));
  
  const fakeDataFound: any = {
    players: [],
    games: [],
    stats: [],
    other: []
  };
  
  // 1. Check Players
  console.log(chalk.yellow('1. Checking PLAYERS table...'));
  
  // Test patterns in names
  const testPatterns = [
    '%test%', '%fake%', '%temp%', '%demo%', '%sample%',
    '%_175133%_%', '%example%', '%dummy%'
  ];
  
  for (const pattern of testPatterns) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .ilike('name', pattern);
      
    if (count && count > 0) {
      fakeDataFound.players.push({ pattern, count });
      console.log(chalk.red(`  Found ${count} players matching: ${pattern}`));
    }
  }
  
  // Check for null/empty names
  const { count: noNames } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .or('name.is.null,firstname.is.null,lastname.is.null');
    
  if (noNames && noNames > 0) {
    console.log(chalk.red(`  Found ${noNames} players without proper names`));
    fakeDataFound.players.push({ pattern: 'no names', count: noNames });
  }
  
  // Check external_ids
  const { data: suspiciousIds } = await supabase
    .from('players')
    .select('external_id')
    .or('external_id.like.test_%,external_id.like.fake_%,external_id.like.temp_%')
    .limit(10);
    
  if (suspiciousIds && suspiciousIds.length > 0) {
    console.log(chalk.red(`  Found suspicious external_ids:`));
    suspiciousIds.forEach(p => console.log(`    - ${p.external_id}`));
  }
  
  // 2. Check Games
  console.log(chalk.yellow('\n2. Checking GAMES table...'));
  
  // Games with null external_ids
  const { count: nullExternalIds } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .is('external_id', null);
    
  if (nullExternalIds && nullExternalIds > 0) {
    console.log(chalk.red(`  Found ${nullExternalIds} games with NULL external_id`));
    fakeDataFound.games.push({ issue: 'null external_id', count: nullExternalIds });
  }
  
  // Games with test patterns
  for (const pattern of testPatterns) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .ilike('external_id', pattern);
      
    if (count && count > 0) {
      fakeDataFound.games.push({ pattern, count });
      console.log(chalk.red(`  Found ${count} games matching: ${pattern}`));
    }
  }
  
  // Games with impossible scores
  const { count: weirdScores } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .or('home_score.gt.200,away_score.gt.200'); // Impossible scores
    
  if (weirdScores && weirdScores > 0) {
    console.log(chalk.red(`  Found ${weirdScores} games with impossible scores (>200)`));
  }
  
  // Games from the future
  const { count: futureGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .gt('start_time', new Date().toISOString());
    
  console.log(chalk.yellow(`  Games scheduled in future: ${futureGames} (may be legitimate)`));
  
  // 3. Check Player Stats
  console.log(chalk.yellow('\n3. Checking PLAYER_STATS table...'));
  
  // Stats for non-existent players
  const { count: orphanStats } = await supabase
    .from('player_stats')
    .select('player_id', { count: 'exact', head: true })
    .limit(1);
    
  console.log(`  Total player_stats records: ${orphanStats}`);
  
  // Check if stats reference test players
  const { data: testPlayerSample } = await supabase
    .from('players')
    .select('id')
    .like('name', '%_175133%_%')
    .limit(10);
    
  if (testPlayerSample && testPlayerSample.length > 0) {
    const testIds = testPlayerSample.map(p => p.id);
    const { count: testStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .in('player_id', testIds);
      
    if (testStats && testStats > 0) {
      console.log(chalk.red(`  Found ${testStats} stats for test players (sample check)`));
      fakeDataFound.stats.push({ issue: 'stats for test players', count: testStats });
    }
  }
  
  // 4. Check other tables
  console.log(chalk.yellow('\n4. Checking OTHER tables...'));
  
  // ML Predictions
  const { count: mlPredictions } = await supabase
    .from('ml_predictions')
    .select('*', { count: 'exact', head: true });
    
  if (mlPredictions && mlPredictions > 0) {
    console.log(chalk.yellow(`  ML predictions: ${mlPredictions} (may need retraining)`));
  }
  
  // News
  const { count: newsCount } = await supabase
    .from('news')
    .select('*', { count: 'exact', head: true })
    .or('title.ilike.%test%,content.ilike.%test%');
    
  if (newsCount && newsCount > 0) {
    console.log(chalk.red(`  Found ${newsCount} news items with 'test' content`));
  }
  
  // 5. Summary
  console.log(chalk.bold.cyan('\n📊 FAKE DATA SUMMARY:'));
  
  let totalFake = 0;
  
  console.log(chalk.yellow('\nPLAYERS:'));
  fakeDataFound.players.forEach(item => {
    console.log(`  ${item.pattern}: ${item.count}`);
    totalFake += item.count;
  });
  
  console.log(chalk.yellow('\nGAMES:'));
  fakeDataFound.games.forEach(item => {
    console.log(`  ${item.pattern || item.issue}: ${item.count}`);
    totalFake += item.count;
  });
  
  console.log(chalk.yellow('\nSTATS:'));
  fakeDataFound.stats.forEach(item => {
    console.log(`  ${item.issue}: ${item.count}`);
  });
  
  console.log(chalk.bold.red(`\n⚠️  TOTAL SUSPICIOUS RECORDS: ${totalFake.toLocaleString()}`));
  
  // 6. Recommendations
  console.log(chalk.bold.green('\n💡 RECOMMENDATIONS:'));
  
  if (fakeDataFound.players.length > 0) {
    console.log('1. Delete remaining test players');
  }
  
  if (nullExternalIds > 0) {
    console.log('2. Delete games with NULL external_id');
  }
  
  if (fakeDataFound.stats.length > 0) {
    console.log('3. Clean up stats for test players');
  }
  
  console.log('4. Verify all remaining data is legitimate');
}

comprehensiveFakeDataCheck().catch(console.error);