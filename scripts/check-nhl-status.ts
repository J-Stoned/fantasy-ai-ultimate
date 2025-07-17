#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNHL() {
  console.log(chalk.bold.cyan('🏒 NHL Teams Status\n'));
  
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .eq('sport', 'NHL')
    .order('name');
    
  teams?.forEach(t => {
    const status = t.external_id ? '✅' : '❌';
    console.log(chalk.white(`${status} ${t.name} (ID: ${t.id}, ESPN: ${t.external_id || 'NULL'})`));
  });
  
  // Check for ID conflicts
  console.log(chalk.yellow('\nChecking ESPN ID conflicts...'));
  
  // Check espn_nhl_13
  const { data: espn13 } = await supabase
    .from('teams')
    .select('id, name, sport, external_id')
    .eq('external_id', 'espn_nhl_13');
    
  if (espn13 && espn13.length > 0) {
    console.log(chalk.red('ESPN ID 13 conflicts:'));
    espn13.forEach(t => {
      console.log(chalk.red(`  - ${t.sport} ${t.name} has espn_nhl_13`));
    });
  }
  
  // Check all Florida Panthers
  console.log(chalk.yellow('\nAll Florida Panthers teams:'));
  const { data: panthers } = await supabase
    .from('teams')
    .select('id, name, sport, external_id')
    .ilike('name', '%florida panthers%');
    
  panthers?.forEach(t => {
    console.log(chalk.white(`  - ${t.sport} ${t.name} (ID: ${t.id}, ESPN: ${t.external_id || 'NULL'})`));
  });
}

checkNHL().catch(console.error);