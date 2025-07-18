import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNCAABaseballStats() {
  console.log(chalk.cyan('🔍 Checking NCAA Baseball Stats Collection...'));
  
  // 1. Check total player_stats table
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.yellow(`\nTotal stats in player_stats table: ${totalStats}`));
  
  // 2. Check NCAA Baseball games
  const { data: ncaaGames, count: ncaaGameCount } = await supabase
    .from('games')
    .select('id', { count: 'exact' })
    .eq('sport', 'NCAA_BASEBALL')
    .eq('status', 'completed');
    
  console.log(chalk.yellow(`NCAA Baseball games (completed): ${ncaaGameCount}`));
  
  // 3. Check if we have any stats for NCAA Baseball games
  if (ncaaGames && ncaaGames.length > 0) {
    const gameIds = ncaaGames.map(g => g.id);
    const { data: stats, count: ncaaStatsCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact' })
      .in('game_id', gameIds.slice(0, 100)); // Check first 100 games
      
    console.log(chalk.yellow(`NCAA Baseball stats found: ${ncaaStatsCount || 0}`));
    
    if (stats && stats.length > 0) {
      console.log(chalk.green('\n✅ Sample stats found:'));
      console.log(stats[0]);
    }
  }
  
  // 4. Check player_game_logs table (alternative location)
  const { count: gameLogsCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BASEBALL');
    
  console.log(chalk.yellow(`\nNCAA Baseball in player_game_logs: ${gameLogsCount}`));
  
  // 5. Check recent inserts
  const { data: recentStats } = await supabase
    .from('player_stats')
    .select('created_at, stat_type')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (recentStats && recentStats.length > 0) {
    console.log(chalk.blue('\nMost recent stats insertions:'));
    recentStats.forEach(stat => {
      console.log(`  ${stat.created_at} - ${stat.stat_type}`);
    });
  }
  
  // 6. Check structure of player_stats table
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select('*')
    .limit(1);
    
  if (sampleStats && sampleStats.length > 0) {
    console.log(chalk.blue('\nplayer_stats table structure:'));
    console.log(Object.keys(sampleStats[0]));
  }
  
  // 7. Check NCAA Baseball players
  const { count: ncaaPlayersCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BASEBALL');
    
  console.log(chalk.yellow(`\nNCAA Baseball players: ${ncaaPlayersCount}`));
}

checkNCAABaseballStats()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  });