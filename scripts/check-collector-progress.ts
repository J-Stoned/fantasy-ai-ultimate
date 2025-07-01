#!/usr/bin/env tsx
/**
 * Check Mega Collector Progress
 * Shows what data is being collected in real-time
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkProgress() {
  console.log(chalk.blue.bold('\n📊 MEGA COLLECTOR PROGRESS'));
  console.log(chalk.blue('=========================\n'));
  
  // Check each table
  const tables = [
    { name: 'players', emoji: '🏃' },
    { name: 'teams', emoji: '🏟️' },
    { name: 'games', emoji: '🏈' },
    { name: 'news_articles', emoji: '📰' },
    { name: 'social_sentiment', emoji: '💬' },
    { name: 'weather_data', emoji: '🌤️' },
    { name: 'betting_odds', emoji: '💰' },
    { name: 'fantasy_rankings', emoji: '📈' },
    { name: 'trending_players', emoji: '🔥' },
    { name: 'player_projections', emoji: '🎯' },
  ];
  
  let totalRecords = 0;
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table.name)
      .select('*', { count: 'exact', head: true });
    
    if (!error && count !== null) {
      console.log(`${table.emoji} ${table.name}: ${chalk.green(count.toLocaleString())} records`);
      totalRecords += count;
    } else {
      console.log(`${table.emoji} ${table.name}: ${chalk.gray('Not available')}`);
    }
  }
  
  console.log(chalk.yellow(`\n📊 Total Records: ${totalRecords.toLocaleString()}`));
  
  // Check recent activity
  console.log(chalk.cyan('\n🕐 Recent Activity:\n'));
  
  // Check social sentiment
  const { data: recentSentiment } = await supabase
    .from('social_sentiment')
    .select('platform, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (recentSentiment && recentSentiment.length > 0) {
    console.log(chalk.green('✅ Social Sentiment - Active'));
    recentSentiment.forEach(item => {
      const ago = Date.now() - new Date(item.created_at).getTime();
      const minutes = Math.floor(ago / 60000);
      console.log(`   ${item.platform}: ${minutes} minutes ago`);
    });
  } else {
    console.log(chalk.gray('⏸️  Social Sentiment - No recent data'));
  }
  
  // Check games
  const { data: recentGames } = await supabase
    .from('games')
    .select('sport_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (recentGames && recentGames.length > 0) {
    console.log(chalk.green('\n✅ Games - Active'));
    const sports = recentGames.reduce((acc, game) => {
      acc[game.sport_id] = (acc[game.sport_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(sports).forEach(([sport, count]) => {
      console.log(`   ${sport}: ${count} recent games`);
    });
  }
  
  // Check API usage
  const today = new Date().toISOString().split('T')[0];
  const { data: apiUsage } = await supabase
    .from('api_usage')
    .select('api_name, calls, daily_limit')
    .eq('date', today);
  
  if (apiUsage && apiUsage.length > 0) {
    console.log(chalk.cyan('\n📡 API Usage Today:\n'));
    apiUsage.forEach(api => {
      const percent = api.daily_limit ? Math.round((api.calls / api.daily_limit) * 100) : 0;
      console.log(`${api.api_name}: ${api.calls} calls ${api.daily_limit ? `(${percent}% of limit)` : ''}`);
    });
  }
  
  console.log(chalk.green('\n✨ Collector is running! Data is flowing in.\n'));
}

// Run check
checkProgress().catch(console.error);