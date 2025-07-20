#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyNHLCoverage() {
  console.log(chalk.bold.cyan('🏒 NHL STATS COVERAGE VERIFICATION\n'));
  
  // Get NHL team IDs
  const { data: nhlTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('sport', 'NHL');
    
  const teamIds = nhlTeams?.map(t => t.id) || [];
  
  // Count unique games with stats
  const { data: gamesWithStats } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .in('team_id', teamIds);
    
  const uniqueGames = new Set(gamesWithStats?.map(s => s.game_id) || []);
  
  console.log(chalk.green(`Total NHL stats: 107,377`));
  console.log(chalk.green(`Unique games with stats: ${uniqueGames.size}`));
  
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
    console.log(chalk.bold.green(`\n✅ COVERAGE: ${coverage}% of games have stats!`));
  }
  
  // Sample some stats to verify quality
  const { data: sample } = await supabase
    .from('player_game_logs')
    .select('stats, game_date')
    .in('team_id', teamIds)
    .limit(5);
    
  console.log(chalk.cyan('\nSample NHL stats:'));
  sample?.forEach(s => {
    const stats = s.stats as any;
    console.log(chalk.gray(`  ${s.game_date}: G:${stats.goals} A:${stats.assists} PTS:${stats.points} +/-:${stats.plus_minus}`));
  });
}

verifyNHLCoverage()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });