#!/usr/bin/env tsx
/**
 * 📊 CHECK CLEANUP RESULTS
 * See how many empty teams remain after cleanup
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkCleanupResults() {
  console.log(chalk.bold.blue('\n📊 CLEANUP RESULTS CHECK\n'));
  
  // Get all teams
  const { data: allTeams } = await supabase
    .from('teams')
    .select('*')
    .order('sport_id, name');
  
  if (!allTeams) return;
  
  // Find empty teams
  const emptyTeams: any[] = [];
  const bySport: { [key: string]: number } = {};
  
  for (const team of allTeams) {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id);
    
    if (!count || count === 0) {
      emptyTeams.push(team);
      bySport[team.sport_id] = (bySport[team.sport_id] || 0) + 1;
    }
  }
  
  console.log(chalk.yellow(`Total teams: ${allTeams.length}`));
  console.log(chalk.yellow(`Teams without players: ${emptyTeams.length}\n`));
  
  // Show breakdown by sport
  console.log(chalk.cyan('Empty teams by sport:'));
  Object.entries(bySport)
    .sort(([_, a], [__, b]) => b - a)
    .forEach(([sport, count]) => {
      console.log(chalk.white(`  ${sport}: ${count}`));
    });
  
  // Show examples of remaining empty teams
  console.log(chalk.cyan('\nExamples of remaining empty teams:'));
  
  const proSports = ['nba', 'nfl', 'mlb', 'nhl'];
  const proEmpty = emptyTeams.filter(t => proSports.includes(t.sport_id));
  
  if (proEmpty.length > 0) {
    console.log(chalk.red('\nProfessional sports still with empty teams:'));
    proEmpty.slice(0, 10).forEach(team => {
      console.log(chalk.red(`  ${team.sport_id}: ${team.name} (External: ${team.external_id})`));
    });
    if (proEmpty.length > 10) {
      console.log(chalk.red(`  ... and ${proEmpty.length - 10} more`));
    }
  }
  
  // Summary
  console.log(chalk.green('\n✅ SUMMARY:'));
  console.log(chalk.white(`  Teams with players: ${allTeams.length - emptyTeams.length}`));
  console.log(chalk.white(`  Teams without players: ${emptyTeams.length}`));
  
  const ncaaEmpty = emptyTeams.filter(t => 
    t.sport_id?.includes('ncaa') || 
    t.sport_id?.includes('college')
  ).length;
  
  console.log(chalk.gray(`    NCAA/College: ${ncaaEmpty}`));
  console.log(chalk.gray(`    Other: ${emptyTeams.length - ncaaEmpty}`));
}

checkCleanupResults().catch(console.error);