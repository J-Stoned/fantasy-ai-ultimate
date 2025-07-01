#!/usr/bin/env tsx
/**
 * 🔥 COMPLETE SYSTEM STATUS CHECK
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config({ path: '.env.local' });

const execAsync = promisify(exec);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSystemStatus() {
  console.log(chalk.red.bold('\n🔥 FANTASY AI SYSTEM STATUS CHECK\n'));
  
  // 1. Check Database Population
  console.log(chalk.cyan.bold('📊 DATABASE STATUS:'));
  console.log(chalk.cyan('──────────────────'));
  
  const tables = [
    'players', 'games', 'news_articles', 'teams',
    'player_stats', 'player_injuries', 'player_projections',
    'weather_data', 'betting_odds', 'social_sentiment',
    'ml_predictions', 'ml_models', 'training_data',
    'voice_sessions', 'fantasy_rankings', 'trending_players'
  ];
  
  let populatedTables = 0;
  let totalRecords = 0;
  
  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (count && count > 0) {
      populatedTables++;
      totalRecords += count;
      console.log(`✅ ${table}: ${chalk.green(count.toLocaleString())} records`);
    } else {
      console.log(`❌ ${table}: ${chalk.red('EMPTY')}`);
    }
  }
  
  console.log(chalk.yellow(`\n📈 Total: ${totalRecords.toLocaleString()} records across ${populatedTables}/${tables.length} tables`));
  
  // 2. Check ML Models
  console.log(chalk.magenta.bold('\n🧠 ML/AI STATUS:'));
  console.log(chalk.magenta('────────────────'));
  
  const { data: models } = await supabase
    .from('ml_models')
    .select('name, accuracy, version, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (models && models.length > 0) {
    console.log(chalk.green('✅ ML Models Found:'));
    models.forEach(model => {
      console.log(`   • ${model.name} v${model.version} - ${(model.accuracy * 100).toFixed(1)}% accuracy`);
    });
  } else {
    console.log(chalk.yellow('⚠️  No ML models found in database'));
  }
  
  // Check predictions
  const { count: predCount } = await supabase
    .from('ml_predictions')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\n🎯 Predictions Made: ${predCount || 0}`);
  
  // 3. Check Voice Training
  console.log(chalk.blue.bold('\n🎤 VOICE AGENT STATUS:'));
  console.log(chalk.blue('────────────────────'));
  
  const { count: voiceCount } = await supabase
    .from('voice_sessions')
    .select('*', { count: 'exact', head: true });
  
  if (voiceCount && voiceCount > 0) {
    console.log(chalk.green(`✅ Voice Sessions: ${voiceCount}`));
  } else {
    console.log(chalk.yellow('⚠️  No voice training data yet'));
  }
  
  // 4. Check Running Processes
  console.log(chalk.yellow.bold('\n⚙️  RUNNING PROCESSES:'));
  console.log(chalk.yellow('───────────────────'));
  
  try {
    const { stdout } = await execAsync('ps aux | grep -E "collector|learning|train" | grep tsx | grep -v grep | wc -l');
    const processCount = parseInt(stdout.trim());
    
    if (processCount > 0) {
      console.log(chalk.green(`✅ ${processCount} data collection/AI processes running`));
      
      // List them
      const { stdout: processes } = await execAsync('ps aux | grep -E "collector|learning|train" | grep tsx | grep -v grep | awk \'{print $NF}\' | sort | uniq');
      const scripts = processes.trim().split('\n').filter(s => s);
      scripts.forEach(script => {
        console.log(`   • ${script}`);
      });
    } else {
      console.log(chalk.red('❌ No active processes found'));
    }
  } catch (error) {
    console.log(chalk.gray('Could not check processes'));
  }
  
  // 5. Summary
  console.log(chalk.green.bold('\n📋 SUMMARY:'));
  console.log(chalk.green('──────────'));
  
  const status = {
    database: totalRecords > 1000000 ? '🟢 ACTIVE' : totalRecords > 100000 ? '🟡 GROWING' : '🔴 NEEDS DATA',
    ml: models && models.length > 0 ? '🟢 TRAINED' : predCount && predCount > 0 ? '🟡 LEARNING' : '🔴 NOT TRAINED',
    voice: voiceCount && voiceCount > 0 ? '🟢 TRAINED' : '🔴 NOT TRAINED',
    collectors: populatedTables > 10 ? '🟢 WORKING' : '🟡 PARTIAL'
  };
  
  console.log(`Database: ${status.database}`);
  console.log(`ML/AI: ${status.ml}`);
  console.log(`Voice Agent: ${status.voice}`);
  console.log(`Data Collection: ${status.collectors}`);
  
  // Recommendations
  console.log(chalk.cyan.bold('\n💡 RECOMMENDATIONS:'));
  console.log(chalk.cyan('─────────────────'));
  
  if (status.ml.includes('🔴')) {
    console.log('• Run: npx tsx scripts/train-ml-models-gpu.ts');
  }
  if (status.voice.includes('🔴')) {
    console.log('• Run: npx tsx scripts/train-voice-agent.ts');
  }
  if (totalRecords < 1000000) {
    console.log('• Keep collectors running to gather more data');
  }
  
  console.log(chalk.yellow('\n✨ Check complete!\n'));
}

checkSystemStatus().catch(console.error);