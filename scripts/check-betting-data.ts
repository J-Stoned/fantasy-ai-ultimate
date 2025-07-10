#!/usr/bin/env tsx
/**
 * Check what betting data we have from ESPN API
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkBettingData() {
  console.log(chalk.bold.cyan('\n🎲 CHECKING BETTING DATA IN DATABASE\n'));
  
  try {
    // 1. Check if we have betting data columns in games table
    const { data: gamesSample } = await supabase
      .from('games')
      .select('*')
      .eq('sport_id', 'nfl')
      .limit(1);
    
    if (gamesSample && gamesSample.length > 0) {
      const columns = Object.keys(gamesSample[0]);
      const bettingColumns = columns.filter(col => 
        col.includes('spread') || 
        col.includes('odds') || 
        col.includes('line') || 
        col.includes('total') ||
        col.includes('betting') ||
        col.includes('over_under') ||
        col.includes('moneyline')
      );
      
      console.log(chalk.yellow('Betting-related columns in games table:'));
      if (bettingColumns.length > 0) {
        bettingColumns.forEach(col => console.log(`  - ${col}`));
      } else {
        console.log('  None found');
      }
    }

    // 2. Check betting_lines table
    const { count: bettingLinesCount } = await supabase
      .from('betting_lines')
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.yellow('\nBetting lines table:'));
    console.log(`  Total records: ${bettingLinesCount || 0}`);
    
    if (bettingLinesCount && bettingLinesCount > 0) {
      // Get sample betting lines
      const { data: sampleLines } = await supabase
        .from('betting_lines')
        .select('*')
        .limit(5);
      
      console.log('  Sample betting lines:');
      sampleLines?.forEach(line => {
        console.log(`    Game ${line.game_id}: Spread ${line.spread}, O/U ${line.over_under}`);
      });
    }

    // 3. Check sample NFL game's full data
    const { data: sampleGame } = await supabase
      .from('games')
      .select('*')
      .eq('sport_id', 'nfl')
      .not('home_score', 'is', null)
      .limit(1)
      .single();
    
    if (sampleGame) {
      console.log(chalk.yellow('\nSample NFL game betting-related fields:'));
      let foundBettingData = false;
      Object.entries(sampleGame).forEach(([key, value]) => {
        if (key.includes('spread') || 
            key.includes('odds') || 
            key.includes('line') || 
            key.includes('total') ||
            key.includes('over_under') ||
            key.includes('moneyline')) {
          console.log(`  ${key}: ${value}`);
          foundBettingData = true;
        }
      });
      
      if (!foundBettingData) {
        console.log('  No betting data found in games table');
      }
    }
    
    // 4. Check if external_id contains betting info
    console.log(chalk.yellow('\nChecking ESPN API integration:'));
    
    // Look at what's in external_id to understand ESPN data structure
    const { data: espnGames } = await supabase
      .from('games')
      .select('id, external_id, sport_id')
      .eq('sport_id', 'nfl')
      .not('external_id', 'is', null)
      .limit(5);
    
    console.log('Sample external IDs (ESPN game IDs):');
    espnGames?.forEach(game => {
      console.log(`  ${game.external_id}`);
    });
    
    // 5. Summary
    console.log(chalk.bold.green('\n📊 SUMMARY:'));
    if (bettingLinesCount && bettingLinesCount > 0) {
      console.log('✅ Betting lines table exists with data');
    } else {
      console.log('❌ No betting data found in betting_lines table');
    }
    
    console.log('\nNote: ESPN API does provide betting data (spreads, totals, odds) for games.');
    console.log('This data is typically available in the "competitions.odds" section of the API response.');
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

checkBettingData().catch(console.error);