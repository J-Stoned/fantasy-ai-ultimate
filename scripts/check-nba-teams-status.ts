#!/usr/bin/env tsx
/**
 * Check NBA teams and their external IDs
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTeams() {
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, abbreviation, external_id')
    .eq('sport', 'NBA')
    .order('name');
  
  console.log(chalk.bold.blue('\n🏀 NBA Teams Status:\n'));
  
  teams?.forEach(team => {
    const hasEspnId = team.external_id?.includes('espn_nba_');
    const espnId = team.external_id?.replace('espn_nba_', '').replace('nba_', '');
    
    console.log(`${team.name.padEnd(25)} | ID: ${team.id.toString().padStart(6)} | ESPN ID: ${espnId || 'MISSING'.padEnd(10)} | External: ${team.external_id || 'null'}`);
  });
  
  // Count players per team
  console.log(chalk.bold.yellow('\n📊 Players per team:\n'));
  
  for (const team of teams || []) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id);
    
    console.log(`${team.name.padEnd(25)} | ${count || 0} players`);
  }
}

checkTeams().catch(console.error);