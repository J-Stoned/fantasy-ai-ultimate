#!/usr/bin/env tsx
/**
 * 🔍 CHECK NBA TEAM FORMATS
 * Determine which format is better to keep
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkFormats() {
  console.log(chalk.bold.blue('\n🔍 NBA TEAM FORMAT CHECK\n'));
  
  // Get all NBA teams
  const { data: nbaTeams } = await supabase
    .from('teams')
    .select('*')
    .eq('sport_id', 'nba')
    .order('name');
  
  if (!nbaTeams) return;
  
  // Separate ESPN and non-ESPN teams
  const espnTeams = nbaTeams.filter(t => t.external_id?.startsWith('espn_nba_'));
  const otherTeams = nbaTeams.filter(t => !t.external_id?.startsWith('espn_nba_'));
  
  console.log(chalk.yellow('ESPN Teams (with espn_nba_ prefix):'));
  espnTeams.slice(0, 10).forEach(team => {
    console.log(`  ${team.name} - City: "${team.city}" - External: ${team.external_id}`);
  });
  
  console.log(chalk.yellow('\n\nOther Teams:'));
  otherTeams.slice(0, 10).forEach(team => {
    console.log(`  ${team.name} - City: "${team.city}" - External: ${team.external_id}`);
  });
  
  // Check which teams have more complete data
  console.log(chalk.cyan('\n\nChecking data completeness:'));
  
  // Sample ESPN team
  const espnSample = espnTeams.find(t => t.name === 'Lakers');
  if (espnSample) {
    console.log(chalk.yellow('\nESPN Team Example (Lakers):'));
    console.log(`  Name: ${espnSample.name}`);
    console.log(`  City: ${espnSample.city || 'NULL'}`);
    console.log(`  Abbreviation: ${espnSample.abbreviation}`);
    console.log(`  External ID: ${espnSample.external_id}`);
    console.log(`  Logo URL: ${espnSample.logo_url || 'NULL'}`);
  }
  
  // Sample other team
  const otherSample = otherTeams.find(t => t.name === 'Los Angeles Lakers');
  if (otherSample) {
    console.log(chalk.yellow('\nOther Team Example (Los Angeles Lakers):'));
    console.log(`  Name: ${otherSample.name}`);
    console.log(`  City: ${otherSample.city || 'NULL'}`);
    console.log(`  Abbreviation: ${otherSample.abbreviation || 'NULL'}`);
    console.log(`  External ID: ${otherSample.external_id || 'NULL'}`);
    console.log(`  Logo URL: ${otherSample.logo_url || 'NULL'}`);
  }
  
  // Check which format has more players
  console.log(chalk.cyan('\n\nChecking player counts:'));
  
  const espnPlayerCounts = await Promise.all(
    espnTeams.slice(0, 5).map(async team => {
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('team_id', team.id);
      return { name: team.name, count: count || 0 };
    })
  );
  
  console.log(chalk.yellow('\nESPN Teams player counts:'));
  espnPlayerCounts.forEach(({ name, count }) => {
    console.log(`  ${name}: ${count} players`);
  });
}

checkFormats().catch(console.error);