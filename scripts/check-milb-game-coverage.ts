import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGameCoverage() {
  console.log(chalk.cyan('🔍 Checking MiLB Game Coverage\n'));
  
  // Get total games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MILB');
    
  console.log(chalk.yellow(`Total MiLB games: ${totalGames}`));
  
  // Get games with stats
  const { data: gamesWithStats } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .in('game_id', await getMiLBGameIds())
    .limit(10000);
    
  const uniqueGamesWithStats = new Set(gamesWithStats?.map(s => s.game_id) || []);
  
  console.log(chalk.green(`Games with stats: ${uniqueGamesWithStats.size}`));
  console.log(chalk.yellow(`Coverage: ${Math.round(uniqueGamesWithStats.size / totalGames! * 100)}%`));
  
  // Get average stats per game
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('player_id', await getMiLBPlayerIds());
    
  const avgStatsPerGame = Math.round(totalStats! / uniqueGamesWithStats.size);
  
  console.log(chalk.blue(`\nAverage stats per game: ${avgStatsPerGame}`));
  console.log(chalk.cyan(`\n💡 This suggests ~${avgStatsPerGame / 2} players per game (batting + pitching stats)`));
  
  // Check by year
  console.log(chalk.green('\n📅 Stats by Year:'));
  
  for (const year of [2021, 2022, 2023, 2024, 2025]) {
    const { count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .gte('game_date', `${year}-01-01`)
      .lt('game_date', `${year + 1}-01-01`)
      .in('player_id', await getMiLBPlayerIds());
      
    console.log(`${year}: ${count || 0} stats`);
  }
}

async function getMiLBPlayerIds() {
  const { data: players } = await supabase
    .from('players')
    .select('id')
    .eq('sport', 'MILB')
    .limit(10000);
    
  return players?.map(p => p.id) || [];
}

async function getMiLBGameIds() {
  const { data: games } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'MILB')
    .limit(10000);
    
  return games?.map(g => g.id) || [];
}

checkGameCoverage().catch(console.error);