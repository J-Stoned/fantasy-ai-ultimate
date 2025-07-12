#!/usr/bin/env tsx

import { enhancedDb } from '../lib/services/enhanced-database-service';
import chalk from 'chalk';
import fs from 'fs';

async function verifyRealData() {
  console.log(chalk.bold.red('🔍 VERIFYING WHAT\'S ACTUALLY REAL...'));
  console.log(chalk.gray('='.repeat(60)));
  
  // 1. Check if we actually saved any real player stats
  console.log(chalk.cyan('\n1️⃣ CHECKING PLAYER STATS:'));
  const { data: recentStats } = await enhancedDb.getClient()
    .from('player_game_logs')
    .select('id, player_id, stats, fantasy_points, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  let hasRealStats = false;
  let zeroCount = 0;
  
  recentStats?.forEach(log => {
    const stats = log.stats as any;
    if (stats && (stats.points > 0 || stats.assists > 0 || stats.rebounds > 0 || 
                  stats.passing_yards > 0 || stats.rushing_yards > 0)) {
      hasRealStats = true;
      console.log(chalk.green(`✅ Found real stats: ${stats.points || 0} pts, ${stats.rebounds || 0} reb, ${stats.assists || 0} ast`));
    } else {
      zeroCount++;
    }
  });
  
  if (!hasRealStats) {
    console.log(chalk.red('❌ NO REAL STATS FOUND - Still all zeros!'));
  } else {
    console.log(chalk.yellow(`⚠️  But ${zeroCount}/10 recent logs still have zeros`));
  }
  
  // 2. Check pattern detection APIs
  console.log(chalk.cyan('\n2️⃣ CHECKING PATTERN DETECTION:'));
  
  // Check production pattern API
  try {
    const patternCode = fs.readFileSync('./scripts/production-pattern-api-v4.ts', 'utf8');
    const usesRandom = patternCode.includes('Math.random()');
    
    if (usesRandom) {
      console.log(chalk.red('❌ production-pattern-api-v4.ts STILL uses Math.random()!'));
      // Count occurrences
      const matches = patternCode.match(/Math\.random\(\)/g);
      console.log(chalk.red(`   Found ${matches?.length || 0} instances of Math.random()`));
    }
  } catch (error) {
    console.log(chalk.gray('Could not check production pattern API'));
  }
  
  // Check our new real pattern detector
  try {
    const realPatternCode = fs.readFileSync('./scripts/real-pattern-detector.ts', 'utf8');
    const usesRealLogic = realPatternCode.includes('checkBackToBackFade') && 
                          !realPatternCode.includes('Math.random()');
    
    if (usesRealLogic) {
      console.log(chalk.green('✅ real-pattern-detector.ts uses REAL logic (no Math.random)'));
    }
  } catch (error) {
    console.log(chalk.gray('Could not check real pattern detector'));
  }
  
  // 3. Check if ESPN API actually returned data
  console.log(chalk.cyan('\n3️⃣ CHECKING ESPN DATA:'));
  
  // Count games with ESPN external IDs
  const { count: espnGames } = await enhancedDb.getClient()
    .from('games')
    .select('*', { count: 'exact', head: true })
    .like('external_id', 'espn_%');
  
  console.log(chalk.white(`ESPN games in database: ${espnGames || 0}`));
  
  // Check if we have recent ESPN data
  const { data: recentEspnGames } = await enhancedDb.getClient()
    .from('games')
    .select('id, external_id, created_at')
    .like('external_id', 'espn_%')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (recentEspnGames && recentEspnGames.length > 0) {
    const latest = recentEspnGames[0];
    const hoursAgo = (Date.now() - new Date(latest.created_at).getTime()) / (1000 * 60 * 60);
    console.log(chalk.yellow(`Latest ESPN game added ${hoursAgo.toFixed(1)} hours ago`));
  }
  
  // 4. Check if pattern predictions are being saved
  console.log(chalk.cyan('\n4️⃣ CHECKING PATTERN PREDICTIONS:'));
  
  try {
    const { data: predictions, error } = await enhancedDb.getClient()
      .from('pattern_predictions')
      .select('*')
      .limit(5);
    
    if (error) {
      console.log(chalk.red('❌ pattern_predictions table does not exist!'));
    } else if (predictions && predictions.length > 0) {
      console.log(chalk.green(`✅ Found ${predictions.length} pattern predictions`));
    } else {
      console.log(chalk.yellow('⚠️ pattern_predictions table exists but is empty'));
    }
  } catch (error) {
    console.log(chalk.red('❌ Error checking predictions:', error));
  }
  
  // 5. Check accuracy tracking
  console.log(chalk.cyan('\n5️⃣ CHECKING ACCURACY TRACKING:'));
  
  try {
    const { data: metrics, error } = await enhancedDb.getClient()
      .from('accuracy_metrics')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(chalk.red('❌ accuracy_metrics table does not exist!'));
    } else if (metrics && metrics.length > 0) {
      console.log(chalk.green('✅ Accuracy metrics being tracked'));
      console.log(chalk.white(`   Overall accuracy: ${metrics[0].overall_accuracy}%`));
    } else {
      console.log(chalk.yellow('⚠️ No accuracy metrics recorded yet'));
    }
  } catch (error) {
    console.log(chalk.red('❌ Error checking accuracy:', error));
  }
  
  // THE TRUTH
  console.log(chalk.bold.yellow('\n📊 THE ACTUAL TRUTH:'));
  console.log(chalk.gray('='.repeat(60)));
  
  console.log(chalk.white('✅ WHAT\'S REAL:'));
  console.log(chalk.green('  • Created real pattern detector with actual logic'));
  console.log(chalk.green('  • Built ESPN API integration'));
  console.log(chalk.green('  • Set up automated collection framework'));
  console.log(chalk.green('  • Used fast .range() batching'));
  
  console.log(chalk.white('\n❌ WHAT\'S STILL FAKE/INCOMPLETE:'));
  console.log(chalk.red('  • Most player_game_logs still have zero stats'));
  console.log(chalk.red('  • Production pattern APIs still use Math.random()'));
  console.log(chalk.red('  • Pattern predictions table doesn\'t exist'));
  console.log(chalk.red('  • Accuracy metrics table doesn\'t exist'));
  console.log(chalk.red('  • ESPN data collection had errors (400 status)'));
  
  console.log(chalk.white('\n⚠️  PARTIALLY WORKING:'));
  console.log(chalk.yellow('  • ESPN API works but we\'re not parsing all sports correctly'));
  console.log(chalk.yellow('  • Pattern detection logic exists but not integrated'));
  console.log(chalk.yellow('  • Automated service created but tables missing'));
  
  console.log(chalk.bold.red('\n🎯 BOTTOM LINE:'));
  console.log(chalk.white('We built the infrastructure but haven\'t fully populated the data!'));
}

verifyRealData().catch(console.error);