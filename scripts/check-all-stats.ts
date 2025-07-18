import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAllStats() {
  console.log(chalk.cyan('📊 Checking ALL stats in player_game_logs\n'));
  
  // Total count
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.yellow(`Total stats in database: ${totalStats || 0}`));
  
  // Check recent stats
  const { data: recentStats } = await supabase
    .from('player_game_logs')
    .select('player_id, game_date, stats')
    .order('id', { ascending: false })
    .limit(5);
    
  if (recentStats && recentStats.length > 0) {
    console.log(chalk.green('\nMost recent stats:'));
    recentStats.forEach((stat, i) => {
      const date = new Date(stat.game_date).toLocaleDateString();
      console.log(`${i+1}. Player ${stat.player_id} on ${date}`);
      if (stat.stats?.atBats !== undefined) {
        console.log(`   Batting: ${stat.stats.atBats} AB, ${stat.stats.hits} H`);
      }
      if (stat.stats?.inningsPitched) {
        console.log(`   Pitching: ${stat.stats.inningsPitched} IP`);
      }
    });
  }
  
  // Check MiLB players with stats
  const { data: milbPlayersWithStats } = await supabase
    .from('player_game_logs')
    .select('player_id')
    .in('player_id', await getMiLBPlayerIds())
    .limit(10);
    
  console.log(chalk.yellow(`\nMiLB players with stats: ${milbPlayersWithStats?.length || 0}`));
}

async function getMiLBPlayerIds() {
  const { data: players } = await supabase
    .from('players')
    .select('id')
    .eq('sport', 'MILB')
    .limit(100);
    
  return players?.map(p => p.id) || [];
}

checkAllStats().catch(console.error);