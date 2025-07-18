import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyMiLBStats() {
  console.log(chalk.cyan('🔍 Verifying MiLB Stats Collection\n'));
  
  // Get MiLB player IDs
  const { data: players } = await supabase
    .from('players')
    .select('id')
    .eq('sport', 'MILB')
    .limit(10000);
    
  const playerIds = players?.map(p => p.id) || [];
  
  // Total stats
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('player_id', playerIds);
    
  console.log(chalk.green(`✅ Total MiLB stats: ${totalStats?.toLocaleString()}`));
  
  // Get a sample stat to see field count
  const { data: sampleStats } = await supabase
    .from('player_game_logs')
    .select('stats')
    .in('player_id', playerIds)
    .limit(5);
    
  if (sampleStats && sampleStats.length > 0) {
    console.log(chalk.yellow('\n📊 Sample stat field counts:'));
    sampleStats.forEach((stat, i) => {
      const fieldCount = Object.keys(stat.stats || {}).length;
      const statType = stat.stats?.statType || 'unknown';
      console.log(`${i+1}. ${statType}: ${fieldCount} fields`);
    });
    
    // Show all fields from first stat
    if (sampleStats[0]?.stats) {
      console.log(chalk.cyan('\n🔍 All fields in first stat:'));
      const fields = Object.keys(sampleStats[0].stats).sort();
      console.log(fields);
    }
  }
  
  // Game coverage
  const { data: gamesWithStats } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .in('player_id', playerIds)
    .limit(10000);
    
  const uniqueGames = new Set(gamesWithStats?.map(s => s.game_id) || []);
  
  console.log(chalk.yellow(`\n📊 Games with stats: ${uniqueGames.size}/3,133 (${Math.round(uniqueGames.size/3133*100)}%)`));
  
  // Calculate improvement
  const oldStats = 22511;
  const newTotal = totalStats || 0;
  const improvement = Math.round((newTotal - oldStats) / oldStats * 100);
  
  console.log(chalk.cyan(`\n💪 Improvement: ${oldStats.toLocaleString()} → ${newTotal.toLocaleString()} (+${improvement}%)`));
}

verifyMiLBStats().catch(console.error);