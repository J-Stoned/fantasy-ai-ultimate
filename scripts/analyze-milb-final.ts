import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeMiLBFinal() {
  console.log(chalk.cyan('📊 Final MiLB Collection Analysis\n'));
  
  // Summary
  const { count: teams } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MILB');
    
  const { count: games } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MILB');
    
  const { count: players } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MILB');
    
  console.log(chalk.green('✅ MiLB Collection Summary:'));
  console.log(`Teams: ${teams}`);
  console.log(`Games: ${games}`);
  console.log(`Players: ${players}`);
  
  // Get all MiLB player IDs in batches
  let allPlayerIds: number[] = [];
  let offset = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data: batch } = await supabase
      .from('players')
      .select('id')
      .eq('sport', 'MILB')
      .range(offset, offset + batchSize - 1);
      
    if (!batch || batch.length === 0) break;
    
    allPlayerIds = allPlayerIds.concat(batch.map(p => p.id));
    offset += batchSize;
  }
  
  console.log(chalk.yellow(`\nTotal MiLB player IDs: ${allPlayerIds.length}`));
  
  // Count stats for these players
  let totalStats = 0;
  const statsPerBatch = 500;
  
  for (let i = 0; i < allPlayerIds.length; i += statsPerBatch) {
    const batch = allPlayerIds.slice(i, i + statsPerBatch);
    const { count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('player_id', batch);
      
    totalStats += count || 0;
  }
  
  console.log(chalk.green(`\n✅ Total MiLB Stats: ${totalStats.toLocaleString()}`));
  
  // Get sample of new vs old stats
  const { data: oldStyleStats } = await supabase
    .from('player_game_logs')
    .select('stats')
    .in('player_id', allPlayerIds.slice(0, 100))
    .not('stats', 'cs', '{"statType": null}')
    .is('stats->statType', null)
    .limit(3);
    
  const { data: newStyleStats } = await supabase
    .from('player_game_logs')
    .select('stats')
    .in('player_id', allPlayerIds.slice(0, 100))
    .not('stats->statType', 'is', null)
    .limit(3);
    
  console.log(chalk.cyan('\n📊 Stats Style Comparison:'));
  
  if (oldStyleStats && oldStyleStats.length > 0) {
    console.log(chalk.yellow('\nOld Style (limited fields):'));
    oldStyleStats.forEach((stat, i) => {
      const fields = Object.keys(stat.stats || {}).length;
      console.log(`${i+1}. ${fields} fields`);
    });
  }
  
  if (newStyleStats && newStyleStats.length > 0) {
    console.log(chalk.green('\nNew Style (all fields):'));
    newStyleStats.forEach((stat, i) => {
      const fields = Object.keys(stat.stats || {}).length;
      const type = stat.stats?.statType || 'unknown';
      console.log(`${i+1}. ${type}: ${fields} fields`);
    });
  }
  
  // Game coverage
  const { data: gamesWithStats } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .in('player_id', allPlayerIds.slice(0, 1000))
    .limit(5000);
    
  const uniqueGames = new Set(gamesWithStats?.map(s => s.game_id) || []);
  
  console.log(chalk.yellow(`\n📊 Game Coverage: ${uniqueGames.size} games have stats`));
  
  // Calculate final metrics
  const avgStatsPerGame = totalStats / (games || 1);
  const avgStatsPerPlayer = totalStats / (players || 1);
  
  console.log(chalk.cyan('\n📈 Final Metrics:'));
  console.log(`Average stats per game: ${avgStatsPerGame.toFixed(1)}`);
  console.log(`Average stats per player: ${avgStatsPerPlayer.toFixed(1)}`);
  
  // Estimate completion
  const estimatedFullCoverage = Math.round(3133 * avgStatsPerGame);
  console.log(chalk.yellow(`\n💡 If all games had stats: ~${estimatedFullCoverage.toLocaleString()} total stats`));
}

analyzeMiLBFinal().catch(console.error);