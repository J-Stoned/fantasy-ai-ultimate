#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeNBATeams() {
  console.log(chalk.bold.blue('NBA TEAMS DETAILED ANALYSIS\n'));
  
  // Get all NBA teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, external_id, name')
    .eq('sport', 'NBA')
    .order('name');
    
  // Categorize by external_id format
  const correct = teams?.filter(t => t.external_id?.startsWith('espn_nba_')) || [];
  const legacy = teams?.filter(t => t.external_id?.startsWith('nba_')) || [];
  const nullIds = teams?.filter(t => !t.external_id) || [];
  
  console.log('Summary:');
  console.log(`  Total NBA teams: ${teams?.length || 0}`);
  console.log(`  ✅ Correct format (espn_nba_X): ${correct.length}`);
  console.log(`  ❌ Legacy format (nba_X): ${legacy.length}`);
  console.log(`  ❌ NULL external_id: ${nullIds.length}`);
  
  if (legacy.length > 0) {
    console.log(chalk.yellow('\nLegacy format teams:'));
    legacy.forEach(t => console.log(`  ${t.name}: ${t.external_id} (ID: ${t.id})`));
    
    // Check if these have duplicates
    console.log(chalk.cyan('\nChecking for duplicates...'));
    for (const legacyTeam of legacy) {
      const duplicate = correct.find(c => c.name === legacyTeam.name);
      if (duplicate) {
        console.log(chalk.red(`  DUPLICATE: ${legacyTeam.name}`));
        console.log(`    - Legacy: ${legacyTeam.external_id} (ID: ${legacyTeam.id})`);
        console.log(`    - Correct: ${duplicate.external_id} (ID: ${duplicate.id})`);
      }
    }
  }
  
  // List all teams to see the full picture
  console.log(chalk.cyan('\nAll NBA teams:'));
  teams?.forEach(t => {
    const format = t.external_id?.startsWith('espn_nba_') ? '✅' : 
                   t.external_id?.startsWith('nba_') ? '🔶' : '❌';
    console.log(`  ${format} ${t.name}: ${t.external_id || 'NULL'}`);
  });
}

analyzeNBATeams().catch(console.error);