#!/usr/bin/env tsx
/**
 * Check if all tables have data
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTables() {
  console.log(chalk.blue.bold('\n📊 CHECKING TABLE DATA...\n'));
  
  const tables = [
    'games',
    'player_stats',
    'player_injuries',
    'teams',
    'players',
    'weather_data',
    'social_sentiment',
    'news_articles',
    'ml_predictions',
    'ml_outcomes',
    'ml_model_performance'
  ];
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
      
    if (error) {
      console.log(chalk.red(`❌ ${table}: ERROR - ${error.message}`));
    } else {
      const emoji = count && count > 0 ? '✅' : '⚠️';
      const color = count && count > 0 ? chalk.green : chalk.yellow;
      console.log(color(`${emoji} ${table}: ${count || 0} rows`));
    }
  }
  
  // Check games with scores
  const { count: gamesWithScores } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
    
  console.log(chalk.cyan(`\n📈 Games with scores: ${gamesWithScores || 0}`));
  
  // Check if player_stats has game_id references
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select('game_id, player_id, team_id, fantasy_points')
    .limit(5);
    
  if (sampleStats && sampleStats.length > 0) {
    console.log(chalk.cyan('\n📋 Sample player_stats:'));
    sampleStats.forEach(stat => {
      console.log(chalk.gray(`  - Game: ${stat.game_id}, Player: ${stat.player_id}, Fantasy: ${stat.fantasy_points || 'null'}`));
    });
  }
}

checkTables().catch(console.error);