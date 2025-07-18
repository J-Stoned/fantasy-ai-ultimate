#!/usr/bin/env tsx
/**
 * Check NFL player status and missing players
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNFLPlayerStatus() {
  console.log(chalk.blue('\n🏈 NFL Player Status Check\n'));

  // Total NFL players
  const { count: totalNFL } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL');

  console.log(chalk.green(`Total NFL players: ${totalNFL || 0}`));

  // Check by position
  const { data: positions } = await supabase
    .from('players')
    .select('position')
    .eq('sport', 'NFL');

  if (positions) {
    const positionCounts: Record<string, number> = {};
    positions.forEach(p => {
      const pos = p.position?.[0] || 'Unknown';
      positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    });

    console.log(chalk.cyan('\nPlayers by position:'));
    Object.entries(positionCounts)
      .sort(([,a], [,b]) => b - a)
      .forEach(([pos, count]) => {
        console.log(`  ${pos}: ${count}`);
      });
  }

  // Check recent additions
  const { data: recentPlayers } = await supabase
    .from('players')
    .select('name, external_id, created_at, position')
    .eq('sport', 'NFL')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(chalk.yellow('\nMost recent NFL player additions:'));
  recentPlayers?.forEach(p => {
    const date = new Date(p.created_at).toLocaleDateString();
    console.log(`  ${p.name} (${p.position?.[0] || 'Unknown'}) - ${date}`);
  });

  // Check for key players
  const keyPlayers = [
    'Ben Roethlisberger',
    'Tom Brady',
    'Patrick Mahomes',
    'Aaron Rodgers',
    'Jalen Hurts',
    'Josh Allen',
    'Kyler Murray',
    'Matt Ryan'
  ];

  console.log(chalk.cyan('\nChecking key quarterbacks:'));
  let found = 0;
  let missing = 0;

  for (const name of keyPlayers) {
    const { data } = await supabase
      .from('players')
      .select('name, external_id')
      .eq('sport', 'NFL')
      .ilike('name', `%${name}%`)
      .single();

    if (data) {
      console.log(chalk.green(`  ✅ ${name} (${data.external_id})`));
      found++;
    } else {
      console.log(chalk.red(`  ❌ ${name} - MISSING`));
      missing++;
    }
  }

  console.log(chalk.blue(`\n📊 Summary: ${found} found, ${missing} missing`));

  // Check team distribution
  const { data: teamCounts } = await supabase
    .rpc('get_nfl_players_per_team');

  if (teamCounts && teamCounts.length > 0) {
    console.log(chalk.cyan('\nPlayers per team (Top 10):'));
    teamCounts.slice(0, 10).forEach((t: any) => {
      console.log(`  Team ${t.team_id}: ${t.player_count} players`);
    });
  }
}

checkNFLPlayerStatus().catch(console.error);