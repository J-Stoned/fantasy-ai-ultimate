import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function checkStatus() {
  console.log(chalk.bold.magenta('\n📊 DATABASE STATUS CHECK\n'));
  
  // Count players by sport
  const { data: players, error } = await supabase
    .from('players')
    .select('sport')
    .not('external_id', 'is', null);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  const sportCounts = players?.reduce((acc: any, p: any) => {
    acc[p.sport] = (acc[p.sport] || 0) + 1;
    return acc;
  }, {}) || {};
  
  console.log(chalk.yellow('REAL PLAYERS BY SPORT:'));
  for (const [sport, count] of Object.entries(sportCounts)) {
    console.log(`  ${sport}: ${count}`);
  }
  
  // Check games
  const { count: realGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('external_id', 'is', null);
    
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.yellow('\nGAMES:'));
  console.log(`  Real games: ${realGames}`);
  console.log(`  Total games: ${totalGames}`);
  console.log(`  Fake games: ${(totalGames || 0) - (realGames || 0)}`);
  
  // Check total players
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.yellow('\nPLAYERS:'));
  console.log(`  Total: ${totalPlayers}`);
  console.log(`  With external_id: ${players?.length || 0}`);
  console.log(`  Without external_id: ${(totalPlayers || 0) - (players?.length || 0)}`);
  
  // Check player stats
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.yellow('\nPLAYER STATS:'));
  console.log(`  Total records: ${totalStats}`);
  
  // Check cleanup progress
  const cleanupNeeded = ((totalGames || 0) - (realGames || 0)) > 0;
  
  if (cleanupNeeded) {
    console.log(chalk.red('\n⚠️  CLEANUP STILL NEEDED!'));
    console.log(chalk.red(`  ${(totalGames || 0) - (realGames || 0)} fake games remain`));
  } else {
    console.log(chalk.green('\n✅ DATABASE IS CLEAN!'));
  }
}

checkStatus()
  .then(() => console.log(chalk.cyan('\nStatus check complete.\n')))
  .catch(console.error);