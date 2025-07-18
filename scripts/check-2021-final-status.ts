#!/usr/bin/env tsx
/**
 * Check final status of 2021 NFL stats
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkFinalStatus() {
  console.log(chalk.blue('\n🏈 2021 NFL Stats Final Status\n'));

  // Get 2021 games
  const { data: games } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01');

  if (!games) return;

  const gameIds = games.map(g => g.id);
  
  // Count total stats
  const { count: totalStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', gameIds);

  console.log(chalk.green(`Total 2021 NFL stats: ${totalStats || 0}`));
  console.log(chalk.green(`Total 2021 games: ${games.length}`));
  console.log(chalk.green(`Average per game: ${Math.round((totalStats || 0) / games.length)}`));

  // Check a sample game for detail
  const sampleGameId = gameIds[0];
  const { data: sampleStats } = await supabase
    .from('player_game_logs')
    .select('stats, metadata')
    .eq('game_id', sampleGameId)
    .limit(5);

  console.log(chalk.yellow('\nSample stats from first game:'));
  sampleStats?.forEach((stat, i) => {
    const statKeys = Object.keys(stat.stats || {});
    console.log(`  ${i + 1}. ${statKeys.length} fields: ${statKeys.slice(0, 5).join(', ')}...`);
    if (stat.metadata?.stat_group) {
      console.log(`     Group: ${stat.metadata.stat_group}`);
    }
  });

  // Check for turbo-ultimate stats
  const { count: ultimateStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', gameIds)
    .eq('metadata->>collection_source', 'turbo-ultimate');

  console.log(chalk.cyan(`\nStats from turbo-ultimate collector: ${ultimateStats || 0}`));

  // Check stat groups
  const { data: statGroups } = await supabase
    .rpc('get_stat_groups_count', { game_ids: gameIds.slice(0, 10) });

  if (statGroups) {
    console.log(chalk.blue('\nStat groups found:'));
    statGroups.forEach((g: any) => {
      console.log(`  ${g.stat_group}: ${g.count} stats`);
    });
  }
}

checkFinalStatus().catch(console.error);