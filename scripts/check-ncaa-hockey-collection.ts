#!/usr/bin/env tsx
/**
 * Check NCAA Hockey collection results
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNCAAHockeyCollection() {
  console.log(chalk.bold.blue('🏒 NCAA HOCKEY COLLECTION RESULTS\n'));
  
  // Count by season
  const { data: games } = await supabase
    .from('games')
    .select('metadata')
    .eq('sport', 'NCAA_HKY');
  
  const seasonCounts: Record<string, number> = {};
  games?.forEach(game => {
    const season = game.metadata?.season || 'Unknown';
    seasonCounts[season] = (seasonCounts[season] || 0) + 1;
  });
  
  console.log(chalk.yellow('Games by Season:'));
  Object.entries(seasonCounts).forEach(([season, count]) => {
    console.log(`  ${season}: ${chalk.green(count)} games`);
  });
  
  // Check total count
  const { count } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_HKY');
  
  console.log(chalk.bold.green(`\n✅ Total NCAA Hockey games: ${count}`));
  
  // Check teams
  const { count: teamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_HKY');
  
  console.log(chalk.bold.blue(`\n✅ Total NCAA Hockey teams: ${teamCount}`));
  
  // Sample some games
  const { data: sampleGames } = await supabase
    .from('games')
    .select('*')
    .eq('sport', 'NCAA_HKY')
    .limit(5);
  
  console.log(chalk.yellow('\nSample games:'));
  sampleGames?.forEach(game => {
    console.log(`  ${game.metadata?.short_name || 'Unknown'} - ${game.start_time}`);
  });
}

checkNCAAHockeyCollection().catch(console.error);