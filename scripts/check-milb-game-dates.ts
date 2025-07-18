import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMiLBGameDates() {
  console.log(chalk.cyan('📅 MiLB Game Date Analysis\n'));
  
  // Get date range
  const { data: dateRange } = await supabase
    .from('games')
    .select('start_time')
    .eq('sport', 'MILB')
    .order('start_time', { ascending: true })
    .limit(1);
    
  const { data: latestGame } = await supabase
    .from('games')
    .select('start_time')
    .eq('sport', 'MILB')
    .order('start_time', { ascending: false })
    .limit(1);
    
  if (dateRange && latestGame) {
    console.log(chalk.yellow('Date range:'));
    console.log(`  Earliest: ${new Date(dateRange[0].start_time).toLocaleDateString()}`);
    console.log(`  Latest: ${new Date(latestGame[0].start_time).toLocaleDateString()}`);
  }
  
  // Count by year
  console.log(chalk.yellow('\nGames by year:'));
  
  for (const year of [2021, 2022, 2023, 2024, 2025]) {
    const { count } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'MILB')
      .gte('start_time', `${year}-01-01`)
      .lt('start_time', `${year + 1}-01-01`);
      
    console.log(`  ${year}: ${count || 0} games`);
  }
  
  // Sample some games with details
  console.log(chalk.yellow('\nSample games:'));
  
  const { data: sampleGames } = await supabase
    .from('games')
    .select('external_id, start_time, league, status')
    .eq('sport', 'MILB')
    .order('start_time', { ascending: false })
    .limit(10);
    
  sampleGames?.forEach(game => {
    const date = new Date(game.start_time).toLocaleDateString();
    const gameId = game.external_id.replace('mlb_milb_', '');
    console.log(`  ${date} - ${game.league} - Game ${gameId} - ${game.status}`);
  });
}

checkMiLBGameDates().catch(console.error);