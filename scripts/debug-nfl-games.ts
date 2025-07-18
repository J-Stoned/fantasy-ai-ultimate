#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugNFLGames() {
  // Direct query
  const { data: nflGames, error } = await supabase
    .from('games')
    .select('id, sport, start_time, external_id')
    .eq('sport', 'NFL')
    .order('start_time');
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(chalk.yellow(`Total NFL games: ${nflGames?.length}`));
  
  // Group by year
  const byYear: Record<number, number> = {};
  nflGames?.forEach(game => {
    const year = new Date(game.start_time).getFullYear();
    byYear[year] = (byYear[year] || 0) + 1;
  });
  
  console.log(chalk.cyan('\nGames by year:'));
  Object.entries(byYear).forEach(([year, count]) => {
    console.log(chalk.white(`  ${year}: ${count} games`));
  });
  
  // Show first 5 games
  console.log(chalk.cyan('\nFirst 5 games:'));
  nflGames?.slice(0, 5).forEach(game => {
    console.log(chalk.gray(`  ${game.external_id} - ${new Date(game.start_time).toLocaleDateString()}`));
  });
}

debugNFLGames();