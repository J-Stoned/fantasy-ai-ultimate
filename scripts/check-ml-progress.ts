import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkProgress() {
  console.log(chalk.bold.cyan('📊 ML Data Collection Progress\n'));
  
  // Check each table
  const tables = [
    { name: 'weather_data', icon: '🌤️' },
    { name: 'betting_lines', icon: '💰' },
    { name: 'advanced_player_metrics', icon: '📊' },
    { name: 'team_synergy_stats', icon: '🤝' },
    { name: 'situational_performance', icon: '📈' },
    { name: 'market_sentiment', icon: '📉' },
    { name: 'schedule_fatigue_metrics', icon: '😴' }
  ];
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table.name)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`${table.icon} ${table.name}: ❌ Error - ${error.message}`);
    } else {
      console.log(`${table.icon} ${table.name}: ${count?.toLocaleString() || 0} records`);
    }
  }
  
  // Check betting_lines schema
  console.log(chalk.cyan('\n🔍 Checking betting_lines schema...'));
  const { data: sample } = await supabase
    .from('betting_lines')
    .select('*')
    .limit(1);
  
  if (sample && sample.length > 0) {
    console.log('Available columns:', Object.keys(sample[0]).join(', '));
  }
  
  // Summary
  console.log(chalk.bold.green('\n✅ Ready for next steps:'));
  console.log('1. Collect historical data (2021-2022) for more games');
  console.log('2. Calculate remaining advanced metrics');
  console.log('3. Run ML model training');
}

checkProgress().catch(console.error);