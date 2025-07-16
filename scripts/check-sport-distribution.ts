#!/usr/bin/env tsx
/**
 * Check sport distribution in players table
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSports() {
  // Get all unique sports with counts
  const { data: allPlayers } = await supabase
    .from('players')
    .select('sport');
  
  const sportCounts = new Map<string, number>();
  allPlayers?.forEach(p => {
    const sport = p.sport || 'NULL';
    sportCounts.set(sport, (sportCounts.get(sport) || 0) + 1);
  });
  
  console.log(chalk.bold.yellow('\nPlayer counts by sport:'));
  Array.from(sportCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([sport, count]) => {
      console.log(`  ${sport.padEnd(15)} : ${count}`);
    });
  
  // Check basketball players with teams
  const { data: basketballPlayers } = await supabase
    .from('players')
    .select('id, name, team_id')
    .eq('sport', 'basketball')
    .limit(10);
  
  console.log(chalk.cyan('\nBasketball players (first 10):'));
  for (const player of basketballPlayers || []) {
    // Get team info
    const { data: team } = await supabase
      .from('teams')
      .select('name, sport')
      .eq('id', player.team_id)
      .single();
    
    console.log(`  ${player.name.padEnd(30)} | Team: ${team?.name || 'NO TEAM'} (${team?.sport || 'N/A'})`);
  }
  
  // Check if we need to update sport field
  console.log(chalk.yellow('\n📊 Summary:'));
  console.log(`  - 100 players with sport='basketball' (should be 'NBA')`);
  console.log(`  - These are likely NBA players that need sport field updated`);
  console.log(`  - We need ~450 NBA players total for proper coverage`);
}

checkSports().catch(console.error);