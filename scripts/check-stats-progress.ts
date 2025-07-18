#!/usr/bin/env tsx
/**
 * Check stats collection progress
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkProgress() {
  console.log(chalk.blue('\n📊 NFL Stats Collection Progress\n'));

  // Current total
  const { count: currentTotal } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NFL');

  console.log(chalk.green(`Current NFL stats: ${currentTotal || 0}`));
  console.log(chalk.yellow(`Previous total: 11,040`));
  
  if (currentTotal && currentTotal > 11040) {
    console.log(chalk.green(`\n✅ Added ${currentTotal - 11040} new stats!`));
  }

  // Check 2021 games specifically
  const { data: games2021 } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01');

  if (games2021) {
    const gameIds = games2021.map(g => g.id);
    const { count: stats2021 } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('game_id', gameIds);

    console.log(chalk.cyan(`\n2021 season stats: ${stats2021 || 0}`));
    if (stats2021) {
      const avgPerGame = Math.round(stats2021 / games2021.length);
      console.log(chalk.cyan(`Average per game: ${avgPerGame}`));
      console.log(chalk.yellow(`Target per game: 78`));
      
      if (avgPerGame >= 78) {
        console.log(chalk.green('\n🎉 SUCCESS! Reached 78 stats per game!'));
      } else {
        console.log(chalk.yellow(`\nStill need ${78 - avgPerGame} more stats per game`));
      }
    }
  }

  // Check for stats with complete mappings
  const { data: sampleStats } = await supabase
    .from('player_game_logs')
    .select('stats')
    .eq('sport', 'NFL')
    .order('created_at', { ascending: false })
    .limit(5);

  if (sampleStats && sampleStats.length > 0) {
    console.log(chalk.blue('\nSample of latest stat fields:'));
    const allFields = new Set<string>();
    sampleStats.forEach(s => {
      if (s.stats) {
        Object.keys(s.stats).forEach(key => allFields.add(key));
      }
    });
    console.log(Array.from(allFields).join(', '));
  }
}

checkProgress().catch(console.error);