import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function debugDatabaseIssues() {
  console.log(chalk.cyan('🔍 Debugging Database Issues...\n'));
  
  // 1. Check unique sports
  const { data: sports, error: sportsError } = await supabase
    .from('games')
    .select('sport')
    .limit(1000);
  
  if (sports) {
    const uniqueSports = new Set(sports.map(s => s.sport));
    console.log(chalk.yellow('Sports in database:'), Array.from(uniqueSports));
  }
  
  // 2. Check games without scores
  const { data: gamesNoScores, count: noScoreCount } = await supabase
    .from('games')
    .select('id, sport, start_time', { count: 'exact' })
    .lt('start_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .is('home_score', null)
    .limit(5);
  
  console.log(chalk.yellow(`\nGames without scores: ${noScoreCount || 0}`));
  if (gamesNoScores && gamesNoScores.length > 0) {
    console.log('Sample:', gamesNoScores.slice(0, 3));
  }
  
  // 3. Check invalid fantasy points
  const { data: invalidStats } = await supabase
    .from('player_game_logs')
    .select('id, player_id, fantasy_points')
    .or('fantasy_points.lt.0,fantasy_points.gt.100')
    .limit(5);
  
  console.log(chalk.yellow(`\nInvalid fantasy points found: ${invalidStats?.length || 0}`));
  if (invalidStats && invalidStats.length > 0) {
    console.log('Sample:', invalidStats.slice(0, 3));
  }
  
  // 4. Test write access properly
  console.log(chalk.cyan('\n🔧 Testing write access...'));
  
  try {
    // Try to insert into weather_data
    const testWeather = {
      game_id: 1,
      temperature: 72,
      wind_speed: 5,
      humidity: 50,
      conditions: 'test_' + Date.now()
    };
    
    const { data: writeData, error: writeError } = await supabase
      .from('weather_data')
      .insert(testWeather)
      .select();
    
    if (writeError) {
      console.log(chalk.red('Write error:'), writeError.message);
      console.log(chalk.red('Error code:'), writeError.code);
      console.log(chalk.red('Error details:'), writeError.details);
    } else {
      console.log(chalk.green('✅ Write access confirmed!'));
      
      // Clean up
      if (writeData && writeData[0]) {
        await supabase
          .from('weather_data')
          .delete()
          .eq('id', writeData[0].id);
        console.log(chalk.gray('Test data cleaned up'));
      }
    }
  } catch (e) {
    console.log(chalk.red('Exception during write test:'), e);
  }
  
  // 5. Check if we need to use different env variable
  console.log(chalk.cyan('\n🔑 Environment check:'));
  console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('NEXT_PUBLIC_SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  // 6. Check table permissions
  console.log(chalk.cyan('\n📋 Checking new ML tables...'));
  const mlTables = [
    'advanced_player_metrics',
    'team_synergy_stats',
    'situational_performance',
    'market_sentiment',
    'schedule_fatigue_metrics'
  ];
  
  for (const table of mlTables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(chalk.red(`❌ ${table}:`), error.message);
    } else {
      console.log(chalk.green(`✅ ${table}: ${count || 0} records`));
    }
  }
}

debugDatabaseIssues().catch(console.error);