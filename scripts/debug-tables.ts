#!/usr/bin/env tsx
/**
 * Debug table issues
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugTables() {
  console.log(chalk.blue.bold('\n🔍 DEBUGGING TABLE ISSUES\n'));
  
  // 1. Test if player_stats table exists by trying to query it
  console.log(chalk.yellow('Testing player_stats table...'));
  try {
    const { data, error, status, statusText } = await supabase
      .from('player_stats')
      .select('*')
      .limit(1);
      
    if (error) {
      console.log(chalk.red(`player_stats error: ${error.message}`));
      console.log('Status:', status, statusText);
      console.log('Error code:', error.code);
      console.log('Full error:', JSON.stringify(error, null, 2));
    } else {
      console.log(chalk.green('player_stats table exists!'));
      console.log('Current records:', data?.length || 0);
    }
  } catch (e: any) {
    console.log(chalk.red('Exception:', e.message));
  }
  
  // 2. Try a simple insert with minimal data
  console.log(chalk.yellow('\nTrying simple insert...'));
  
  // Get one player and one game
  const { data: player } = await supabase
    .from('players')
    .select('id')
    .limit(1)
    .single();
    
  const { data: game } = await supabase
    .from('games')
    .select('id')
    .limit(1)
    .single();
    
  if (player && game) {
    console.log(`Using player ${player.id} and game ${game.id}`);
    
    const { data: insertData, error: insertError } = await supabase
      .from('player_stats')
      .insert({
        player_id: player.id,
        game_id: game.id,
        stat_type: 'test',
        stats: { test: true }
      })
      .select();
      
    if (insertError) {
      console.log(chalk.red('Insert error:', insertError.message));
      console.log('Error code:', insertError.code);
      console.log('Error details:', insertError.details);
      console.log('Error hint:', insertError.hint);
    } else {
      console.log(chalk.green('Insert successful!'));
      console.log('Inserted:', insertData);
    }
  }
  
  // 3. List all tables we can see
  console.log(chalk.yellow('\nListing accessible tables...'));
  
  // This is a bit hacky but works
  const tableNames = [
    'players', 'teams', 'games', 'news_articles',
    'player_stats', 'player_injuries', 'weather_data',
    'team_stats', 'player_performance', 'game_events',
    'injuries', 'player_news', 'team_news'
  ];
  
  for (const table of tableNames) {
    const { error } = await supabase
      .from(table)
      .select('*')
      .limit(0);
      
    if (error) {
      console.log(chalk.red(`❌ ${table}: ${error.message}`));
    } else {
      console.log(chalk.green(`✅ ${table}: accessible`));
    }
  }
}

debugTables().catch(console.error);