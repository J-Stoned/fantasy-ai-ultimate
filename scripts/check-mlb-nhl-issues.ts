#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMLBNHLIssues() {
  console.log(chalk.bold.cyan('🔍 CHECKING MLB & NHL TEAM ISSUES\n'));
  
  // Check MLB (should be 30, have 31)
  console.log(chalk.yellow('⚾ MLB TEAMS (expecting 30):'));
  const { data: mlbTeams } = await supabase
    .from('teams')
    .select('id, name, abbreviation, external_id')
    .eq('sport', 'MLB')
    .order('name');
    
  console.log(chalk.white(`Total MLB teams: ${mlbTeams?.length}`));
  
  // Look for potential issues
  const mlbESPNTeams = mlbTeams?.filter(t => t.external_id) || [];
  console.log(chalk.blue(`With ESPN IDs: ${mlbESPNTeams.length}`));
  
  // List all teams to find the extra one
  console.log(chalk.gray('\nAll MLB teams:'));
  mlbTeams?.forEach((t, i) => {
    console.log(chalk.white(`  ${i+1}. ${t.name} (ID: ${t.id})`));
  });
  
  // Check NHL (should be 32, have 33)
  console.log(chalk.yellow('\n🏒 NHL TEAMS (expecting 32):'));
  const { data: nhlTeams } = await supabase
    .from('teams')
    .select('id, name, abbreviation, external_id')
    .eq('sport', 'NHL')
    .order('name');
    
  console.log(chalk.white(`Total NHL teams: ${nhlTeams?.length}`));
  
  // Look for duplicates
  const nhlByName: Record<string, any[]> = {};
  nhlTeams?.forEach(t => {
    if (!nhlByName[t.name]) nhlByName[t.name] = [];
    nhlByName[t.name].push(t);
  });
  
  console.log(chalk.red('\nNHL Duplicates:'));
  let duplicateFound = false;
  Object.entries(nhlByName).forEach(([name, teams]) => {
    if (teams.length > 1) {
      duplicateFound = true;
      console.log(chalk.red(`  ${name}:`));
      teams.forEach(t => {
        console.log(chalk.white(`    - ID: ${t.id}, ESPN: ${t.external_id || 'NULL'}`));
      });
    }
  });
  
  if (!duplicateFound) {
    console.log(chalk.green('  No duplicates found'));
  }
  
  // Teams without ESPN IDs
  const nhlWithoutEspn = nhlTeams?.filter(t => !t.external_id) || [];
  if (nhlWithoutEspn.length > 0) {
    console.log(chalk.yellow('\nNHL teams without ESPN IDs:'));
    nhlWithoutEspn.forEach(t => {
      console.log(chalk.white(`  - ${t.name} (ID: ${t.id})`));
    });
  }
  
  // Check for special cases
  console.log(chalk.cyan('\nSpecial Cases:'));
  
  // NHL: Seattle Kraken (expansion team)
  const krakenTeams = nhlTeams?.filter(t => t.name.includes('Kraken')) || [];
  console.log(chalk.white(`Seattle Kraken entries: ${krakenTeams.length}`));
  krakenTeams.forEach(t => {
    console.log(chalk.gray(`  - ID: ${t.id}, ESPN: ${t.external_id}`));
  });
  
  // NHL: Vegas Golden Knights (expansion team)
  const vegasTeams = nhlTeams?.filter(t => t.name.includes('Vegas')) || [];
  console.log(chalk.white(`Vegas Golden Knights entries: ${vegasTeams.length}`));
  vegasTeams.forEach(t => {
    console.log(chalk.gray(`  - ID: ${t.id}, ESPN: ${t.external_id}`));
  });
}

checkMLBNHLIssues().catch(console.error);