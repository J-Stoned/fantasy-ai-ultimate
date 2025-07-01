#!/usr/bin/env tsx
/**
 * 🔍 Verify Fantasy AI Setup
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifySetup() {
  console.log(chalk.cyan.bold('🔍 VERIFYING FANTASY AI SETUP\n'));
  
  let allGood = true;
  
  // Test correlation_insights table
  try {
    await supabase.from('correlation_insights').select('id').limit(1);
    console.log(chalk.green('✅ correlation_insights table: READY'));
  } catch (error) {
    console.log(chalk.red('❌ correlation_insights table: ERROR'));
    allGood = false;
  }
  
  // Test ml_predictions table
  try {
    await supabase.from('ml_predictions').select('id').limit(1);
    console.log(chalk.green('✅ ml_predictions table: READY'));
  } catch (error) {
    console.log(chalk.red('❌ ml_predictions table: ERROR'));
    allGood = false;
  }
  
  // Test injuries table
  try {
    await supabase.from('injuries').select('id').limit(1);
    console.log(chalk.green('✅ injuries table: READY'));
  } catch (error) {
    console.log(chalk.red('❌ injuries table: ERROR'));
    allGood = false;
  }
  
  // Check for historical data
  const { count: gamesCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);
  
  console.log(chalk.yellow(`\n📊 Historical games available: ${gamesCount?.toLocaleString()}`));
  
  // Check API keys
  console.log(chalk.cyan('\n🔑 API Keys:'));
  console.log(chalk.white(`   OpenWeather: ${process.env.OPENWEATHER_API_KEY ? '✅ Configured' : '❌ Missing'}`));
  console.log(chalk.white(`   OpenAI: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing'}`));
  console.log(chalk.white(`   The Odds API: ${process.env.THE_ODDS_API_KEY ? '✅ Configured' : '❌ Missing'}`));
  
  if (allGood) {
    console.log(chalk.green.bold('\n🚀 ALL SYSTEMS GO! Your Fantasy AI is ready!\n'));
    console.log(chalk.yellow('Next steps:'));
    console.log(chalk.white('1. Start continuous learning: npx tsx scripts/continuous-learning-ai.ts'));
    console.log(chalk.white('2. Run data collector: npx tsx scripts/mega-data-collector-v3.ts'));
    console.log(chalk.white('3. Train on historical data: npx tsx scripts/ml-historical-trainer.ts'));
    console.log(chalk.white('4. Make predictions: npx tsx scripts/ml-ensemble-enhanced.ts'));
  } else {
    console.log(chalk.red.bold('\n⚠️  Some components need attention\n'));
  }
}

verifySetup().catch(console.error);