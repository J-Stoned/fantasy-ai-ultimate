#!/usr/bin/env tsx
/**
 * Analyze NBA players in database
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzePlayers() {
  console.log(chalk.bold.blue('\n🏀 NBA PLAYER ANALYSIS\n'));
  
  // Count by different sport values
  const sportVariations = ['NBA', 'nba', 'basketball', 'Basketball'];
  
  console.log(chalk.yellow('Players by sport field:'));
  for (const sport of sportVariations) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
    
    if (count && count > 0) {
      console.log(`  sport='${sport}': ${count}`);
    }
  }
  
  // Check players with NBA teams
  const { data: nbaTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('sport', 'NBA');
  
  const nbaTeamIds = nbaTeams?.map(t => t.id) || [];
  
  const { count: playersWithNBATeams } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .in('team_id', nbaTeamIds);
  
  console.log(chalk.cyan(`\nPlayers with NBA team_id: ${playersWithNBATeams || 0}`));
  
  // Check using OR condition
  const { count: totalNBAPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .or(`sport.eq.NBA,sport.eq.nba,team_id.in.(${nbaTeamIds.join(',')})`);
  
  console.log(chalk.green(`\nTotal NBA players (sport OR team): ${totalNBAPlayers || 0}`));
  
  // Sample some players
  const { data: samplePlayers } = await supabase
    .from('players')
    .select('id, name, sport, team_id, external_id')
    .or('sport.eq.NBA,sport.eq.nba')
    .limit(10);
  
  console.log(chalk.gray('\nSample NBA players:'));
  samplePlayers?.forEach(p => {
    console.log(`  ${p.name.padEnd(30)} | sport: ${(p.sport || 'null').padEnd(10)} | team: ${p.team_id?.toString().padEnd(6)} | external: ${p.external_id || 'null'}`);
  });
  
  // Check total players
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.blue(`\nTotal players in database: ${totalPlayers}`));
  
  // Check if there are players without sport field
  const { count: noSport } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .is('sport', null);
  
  console.log(chalk.red(`Players with NULL sport: ${noSport || 0}`));
  
  // Check external IDs
  const { data: externalIdSample } = await supabase
    .from('players')
    .select('external_id')
    .not('external_id', 'is', null)
    .like('external_id', '%nba%')
    .limit(10);
  
  console.log(chalk.yellow('\nSample external IDs with "nba":'));
  externalIdSample?.forEach(p => {
    console.log(`  ${p.external_id}`);
  });
}

analyzePlayers().catch(console.error);