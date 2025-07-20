#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyNewNHLStats() {
  console.log(chalk.bold.cyan('🏒 VERIFYING NEW NHL STATS\n'));
  
  // Check stats with our collection source
  const { count: newStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .eq('metadata->>sport', 'NHL');
    
  console.log(chalk.green(`New NHL stats (with sport metadata): ${newStats || 0}`));
  
  // Count unique games
  const { data: gamesWithStats } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .eq('metadata->>sport', 'NHL');
    
  const uniqueGames = new Set(gamesWithStats?.map(s => s.game_id) || []);
  console.log(chalk.green(`Unique games with new stats: ${uniqueGames.size}`));
  
  // Count total 2021-22 NHL games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NHL')
    .gte('start_time', '2021-10-12')
    .lte('start_time', '2022-06-26');
    
  console.log(chalk.yellow(`Total NHL games 2021-22: ${totalGames}`));
  
  if (totalGames) {
    const coverage = (uniqueGames.size / totalGames * 100).toFixed(1);
    console.log(chalk.bold.green(`\n✅ NEW COVERAGE: ${coverage}% of games have stats!`));
  }
  
  // Sample new stats
  const { data: sample } = await supabase
    .from('player_game_logs')
    .select('stats, game_date, metadata')
    .eq('metadata->>sport', 'NHL')
    .limit(5);
    
  console.log(chalk.cyan('\nSample new NHL stats:'));
  sample?.forEach(s => {
    const stats = s.stats as any;
    console.log(chalk.gray(`  ${s.game_date}: G:${stats.goals} A:${stats.assists} PTS:${stats.points} +/-:${stats.plus_minus}`));
  });
  
  // Check collection source breakdown
  const { data: sources } = await supabase
    .from('player_game_logs')
    .select('metadata')
    .eq('metadata->>sport', 'NHL')
    .limit(10);
    
  console.log(chalk.yellow('\nCollection sources:'));
  const sourceCounts = new Map();
  sources?.forEach(s => {
    const source = (s.metadata as any)?.collection_source || 'unknown';
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
  });
  
  for (const [source, count] of sourceCounts) {
    console.log(chalk.gray(`  ${source}: ${count} samples`));
  }
}

verifyNewNHLStats()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });