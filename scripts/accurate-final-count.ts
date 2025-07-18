import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function accurateFinalCount() {
  console.log(chalk.cyan('📊 ACCURATE FINAL STATS COUNT\n'));
  
  // Direct database total
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.green(`Total stats in database: ${totalStats?.toLocaleString()}\n`));
  
  // Count by sport (comprehensive)
  const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB', 'NCAA_BASEBALL', 'NCAA_HKY', 'MILB'];
  
  for (const sport of sports) {
    // Get total players for this sport
    const { count: playerCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
      
    // Get all player IDs in batches
    let allPlayerIds: number[] = [];
    let offset = 0;
    
    while (offset < (playerCount || 0)) {
      const { data: batch } = await supabase
        .from('players')
        .select('id')
        .eq('sport', sport)
        .range(offset, offset + 999);
        
      if (!batch || batch.length === 0) break;
      allPlayerIds = allPlayerIds.concat(batch.map(p => p.id));
      offset += 1000;
    }
    
    // Count stats for ALL players of this sport
    let sportStats = 0;
    for (let i = 0; i < allPlayerIds.length; i += 300) {
      const batch = allPlayerIds.slice(i, i + 300);
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .in('player_id', batch);
        
      sportStats += count || 0;
    }
    
    console.log(`${sport}: ${sportStats.toLocaleString()} stats (${playerCount} players)`);
  }
  
  // Check for orphaned stats
  const { count: nullStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .is('player_id', null);
    
  if (nullStats && nullStats > 0) {
    console.log(chalk.red(`\n⚠️  Orphaned stats (null player_id): ${nullStats.toLocaleString()}`));
  }
  
  // NCAA Baseball investigation
  console.log(chalk.yellow('\n🔍 NCAA Baseball Investigation:'));
  const { data: ncaaBaseball } = await supabase
    .from('players')
    .select('id, sport')
    .eq('sport', 'NCAA_BASEBALL')
    .limit(10);
    
  if (ncaaBaseball && ncaaBaseball.length > 0) {
    const { count: ncaaStats } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('player_id', ncaaBaseball.map(p => p.id));
      
    console.log(`Sample of 10 NCAA Baseball players have ${ncaaStats} stats`);
    console.log(chalk.red('⚠️  NCAA Baseball stats were likely deleted or players were updated'));
  }
  
  // MiLB verification
  console.log(chalk.green('\n✅ MiLB Collection Results:'));
  const { data: milbSample } = await supabase
    .from('player_game_logs')
    .select('stats')
    .in('player_id', allPlayerIds.slice(0, 5))
    .limit(3);
    
  if (milbSample && milbSample.length > 0) {
    milbSample.forEach((stat, i) => {
      const fields = Object.keys(stat.stats || {}).length;
      console.log(`Sample stat ${i+1}: ${fields} fields`);
    });
  }
}

accurateFinalCount().catch(console.error);