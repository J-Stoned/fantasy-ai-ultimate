#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

console.log(chalk.bold.yellow('\n🔍 DEBUGGING PLAYER POSITIONS...\n'));

async function checkPositions() {
  // Check what positions we have
  console.log(chalk.cyan('Checking player positions:'));
  
  const { data: positions, error } = await supabase
    .from('players')
    .select('position')
    .limit(1000);
  
  if (positions) {
    const positionCounts = positions.reduce((acc: any, p) => {
      acc[p.position] = (acc[p.position] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(positionCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .forEach(([pos, count]) => {
        console.log(chalk.green(`  ${pos}: ${count} players`));
      });
  }
  
  // Check QBs specifically
  console.log(chalk.cyan('\n\nChecking QBs:'));
  const { data: qbs } = await supabase
    .from('players')
    .select('id, firstname, lastname, position, team_id')
    .eq('position', 'QB')
    .limit(5);
  
  if (qbs && qbs.length > 0) {
    console.log(chalk.green(`  Found ${qbs.length} QBs:`));
    qbs.forEach(qb => {
      console.log(chalk.gray(`    ${qb.firstname} ${qb.lastname} (ID: ${qb.id})`));
    });
  } else {
    console.log(chalk.red('  No QBs found!'));
    
    // Check if it's case sensitive
    const { data: qbsLower } = await supabase
      .from('players')
      .select('position')
      .ilike('position', 'qb')
      .limit(5);
    
    if (qbsLower && qbsLower.length > 0) {
      console.log(chalk.yellow(`  Found ${qbsLower.length} with lowercase 'qb'`));
    }
  }
  
  // Check a specific player's game logs
  console.log(chalk.cyan('\n\nChecking Patrick Mahomes game logs:'));
  const { data: mahomes } = await supabase
    .from('players')
    .select('id, firstname, lastname')
    .or('firstname.ilike.%mahomes%,lastname.ilike.%mahomes%')
    .limit(1)
    .single();
  
  if (mahomes) {
    const { data: games, count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact' })
      .eq('player_id', mahomes.id)
      .limit(3);
    
    console.log(chalk.green(`  ${mahomes.firstname} ${mahomes.lastname} has ${count} total games`));
    if (games && games.length > 0) {
      games.forEach(g => {
        console.log(chalk.gray(`    ${g.game_date}: ${g.fantasy_points} pts`));
      });
    }
  }
}

checkPositions().catch(console.error);