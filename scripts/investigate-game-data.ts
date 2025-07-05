#!/usr/bin/env tsx
/**
 * 🔍 INVESTIGATE GAME DATA
 * Check what's actually in the database
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateGameData() {
  console.log(chalk.bold.cyan('🔍 INVESTIGATING GAME DATA'));
  console.log(chalk.yellow('═'.repeat(50)));
  
  try {
    // 1. Check total games
    console.log(chalk.cyan('\n1️⃣ Total games in database:'));
    const { count: totalCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    console.log(chalk.green(`Total games: ${totalCount}`));
    
    // 2. Check games with scores
    console.log(chalk.cyan('\n2️⃣ Games with scores:'));
    const { count: scoredCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
    console.log(chalk.green(`Games with scores: ${scoredCount}`));
    
    // 3. Sample of games structure
    console.log(chalk.cyan('\n3️⃣ Sample games structure:'));
    const { data: sampleGames } = await supabase
      .from('games')
      .select('*')
      .limit(5);
    
    if (sampleGames && sampleGames.length > 0) {
      console.log(chalk.green('Sample game structure:'));
      console.log(JSON.stringify(sampleGames[0], null, 2));
    }
    
    // 4. Check for different score column names
    console.log(chalk.cyan('\n4️⃣ Checking for score columns:'));
    const { data: gameColumns } = await supabase.rpc('get_table_columns', { table_name: 'games' }).catch(() => null);
    
    // Let's try different score field names
    const possibleScoreFields = [
      'home_score', 'away_score',
      'home_points', 'away_points', 
      'home_team_score', 'away_team_score',
      'score_home', 'score_away',
      'final_score_home', 'final_score_away'
    ];
    
    const { data: sampleGame } = await supabase
      .from('games')
      .select('*')
      .limit(1);
    
    if (sampleGame && sampleGame.length > 0) {
      const gameKeys = Object.keys(sampleGame[0]);
      console.log(chalk.green('Available columns:'));
      gameKeys.forEach(key => {
        const value = sampleGame[0][key];
        console.log(`  ${key}: ${value} (${typeof value})`);
      });
      
      console.log(chalk.yellow('\nLooking for score-related columns:'));
      const scoreColumns = gameKeys.filter(key => 
        key.toLowerCase().includes('score') || 
        key.toLowerCase().includes('point') ||
        key.toLowerCase().includes('final')
      );
      scoreColumns.forEach(col => {
        console.log(chalk.green(`  Found: ${col}`));
      });
    }
    
    // 5. Check if we have game results in a different format
    console.log(chalk.cyan('\n5️⃣ Checking for game results:'));
    const { data: resultsQuery } = await supabase
      .from('games')
      .select('*')
      .not('home_team_id', 'is', null)
      .not('away_team_id', 'is', null)
      .limit(10);
    
    if (resultsQuery && resultsQuery.length > 0) {
      console.log(chalk.green(`Found ${resultsQuery.length} games with team data`));
      
      // Look for any numeric fields that might be scores
      const sample = resultsQuery[0];
      Object.keys(sample).forEach(key => {
        const value = sample[key];
        if (typeof value === 'number' && value > 0 && value < 100) {
          console.log(chalk.yellow(`Potential score field: ${key} = ${value}`));
        }
      });
    }
    
  } catch (error) {
    console.error(chalk.red('Investigation failed:'), error);
  }
}

investigateGameData().catch(console.error);