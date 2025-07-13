#!/usr/bin/env tsx
/**
 * Fix sport IDs in database - standardize all sports to proper abbreviations
 * Phase 1 of the 10X Stats Collection Plan
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixSportIds() {
  console.log(chalk.bold.cyan('\n🔧 FIXING SPORT IDS IN DATABASE\n'));
  
  const sportMappings = [
    { from: 'football', to: 'nfl', league: 'nfl' },
    { from: 'baseball', to: 'mlb', league: 'mlb' },
    { from: 'basketball', to: 'nba', league: 'nba' },
    { from: 'hockey', to: 'nhl', league: 'nhl' },
    { from: 'ncaaf', to: 'nfl', league: 'college-football' },
    { from: 'ncaab', to: 'nba', league: 'mens-college-basketball' }
  ];

  try {
    // First, count how many games need fixing
    console.log('Analyzing current sport IDs...');
    for (const mapping of sportMappings) {
      const { count, error } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport', mapping.from);
      
      if (!error && count && count > 0) {
        console.log(`Found ${chalk.yellow(count)} games with sport="${mapping.from}"`);
      }
    }

    // Fix each mapping
    console.log('\nUpdating sport IDs...');
    let totalUpdated = 0;
    
    for (const mapping of sportMappings) {
      const { data, error } = await supabase
        .from('games')
        .update({ sport: mapping.to })
        .eq('sport', mapping.from)
        .select();
      
      if (error) {
        console.error(chalk.red(`Error updating ${mapping.from} → ${mapping.to}:`), error);
      } else if (data && data.length > 0) {
        console.log(chalk.green(`✓ Updated ${data.length} games: ${mapping.from} → ${mapping.to}`));
        totalUpdated += data.length;
      }
    }

    // Remove games with NULL sports
    console.log('\nCleaning up games with NULL sports...');
    const { data: nullGames, error: nullError } = await supabase
      .from('games')
      .delete()
      .is('sport', null)
      .select();
    
    if (!nullError && nullGames && nullGames.length > 0) {
      console.log(chalk.yellow(`Removed ${nullGames.length} games with NULL sports`));
    }

    // Remove future games
    console.log('\nRemoving future games...');
    const today = new Date().toISOString().split('T')[0];
    const { data: futureGames, error: futureError } = await supabase
      .from('games')
      .delete()
      .gt('game_date', today)
      .select();
    
    if (!futureError && futureGames && futureGames.length > 0) {
      console.log(chalk.yellow(`Removed ${futureGames.length} future games`));
    }

    // Add index on sport column for faster queries
    console.log('\nAdding index on sport column...');
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_games_sport ON games(sport);
        CREATE INDEX IF NOT EXISTS idx_games_sport_date ON games(sport, game_date);
      `
    });
    
    if (indexError) {
      console.log(chalk.yellow('Note: Could not create indexes (may already exist)'));
    } else {
      console.log(chalk.green('✓ Created indexes for faster queries'));
    }

    // Final validation
    console.log('\n📊 Final Sport Distribution:');
    const { data: sportCounts } = await supabase
      .from('games')
      .select('sport')
      .not('sport', 'is', null);
    
    if (sportCounts) {
      const counts = sportCounts.reduce((acc, { sport }) => {
        acc[sport] = (acc[sport] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      Object.entries(counts).forEach(([sport, count]) => {
        console.log(`  ${sport}: ${chalk.cyan(count)} games`);
      });
    }

    console.log(chalk.bold.green(`\n✅ Sport ID standardization complete! Updated ${totalUpdated} games.\n`));

  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  }
}

// Run the fix
fixSportIds();