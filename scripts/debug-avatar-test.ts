#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

console.log(chalk.bold.cyan('\n🔍 DEBUGGING AVATAR TEST\n'));

async function debugAvatarTest() {
  try {
    // First check if season_stats column exists
    const { data: players, error } = await supabase
      .from('players')
      .select('id, firstname, lastname, position, season_stats')
      .limit(5);
    
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log(chalk.yellow('Sample players with season_stats:'));
    players?.forEach(p => {
      console.log(chalk.gray(`${p.firstname} ${p.lastname}:`));
      console.log(chalk.gray(`  Position: ${JSON.stringify(p.position)}`));
      console.log(chalk.gray(`  Season Stats: ${JSON.stringify(p.season_stats)}`));
    });
    
    // Check if any players have non-null season_stats
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .not('season_stats', 'is', null);
      
    console.log(chalk.yellow(`\nPlayers with non-null season_stats: ${count || 0}`));
    
    // Check for RBs specifically
    const { data: rbs, error: rbError } = await supabase
      .from('players')
      .select('id, firstname, lastname, position')
      .contains('position', ['RB'])
      .limit(10);
      
    console.log(chalk.yellow(`\nRBs found: ${rbs?.length || 0}`));
    if (rbs && rbs.length > 0) {
      rbs.forEach(rb => {
        console.log(chalk.gray(`  ${rb.firstname} ${rb.lastname} - ${JSON.stringify(rb.position)}`));
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugAvatarTest().catch(console.error);