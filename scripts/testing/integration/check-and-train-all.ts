#!/usr/bin/env tsx
/**
 * CHECK DATA AND TRAIN ON EVERYTHING
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAndTrain() {
  console.log(chalk.blue.bold('\n📊 CHECKING DATABASE...\n'));
  
  // Count games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
    
  const { count: gamesWithScores } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
    
  console.log(chalk.yellow(`Total games: ${totalGames}`));
  console.log(chalk.yellow(`Games with scores: ${gamesWithScores}`));
  
  // Get all games with pagination
  console.log(chalk.blue('\n📥 Loading ALL games with pagination...'));
  
  const allGames = [];
  const pageSize = 10000;
  let page = 0;
  
  while (true) {
    const { data: batch, error } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error('Error loading games:', error);
      break;
    }
    
    if (!batch || batch.length === 0) break;
    
    allGames.push(...batch);
    console.log(chalk.green(`  Loaded page ${page + 1}: ${batch.length} games (total: ${allGames.length})`));
    
    if (batch.length < pageSize) break;
    page++;
  }
  
  console.log(chalk.green.bold(`\n✅ Successfully loaded ${allGames.length} games!`));
  
  // Now train on ALL of them
  if (allGames.length > 10000) {
    console.log(chalk.red.bold('\n🚀 NOW WE CAN TRAIN ON REAL DATA!'));
    console.log(chalk.yellow('\nNext step: Run the training with all this data'));
  } else {
    console.log(chalk.red('\n⚠️  Still not enough data. Check Supabase connection.'));
  }
}

checkAndTrain().catch(console.error);