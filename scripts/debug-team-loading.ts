#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugTeamLoading() {
  console.log(chalk.cyan('🔍 Debugging team loading query...\n'));
  
  // Test the exact query used in memory-cache.ts
  console.log(chalk.yellow('Testing cache query: .not("external_id", "is", null)'));
  const { data: cacheQuery } = await supabase
    .from('teams')
    .select('id, name, sport, external_id')
    .not('external_id', 'is', null);
    
  console.log(chalk.white(`Cache query result: ${cacheQuery?.length || 0} teams`));
  
  // Test getting all teams
  console.log(chalk.yellow('\nTesting full query: all teams'));
  const { data: allTeams } = await supabase
    .from('teams')
    .select('id, name, sport, external_id');
    
  console.log(chalk.white(`Full query result: ${allTeams?.length || 0} teams`));
  
  // Compare NFL teams
  const cacheNFL = cacheQuery?.filter(t => t.sport === 'NFL') || [];
  const allNFL = allTeams?.filter(t => t.sport === 'NFL') || [];
  
  console.log(chalk.cyan('\nNFL Team Comparison:'));
  console.log(chalk.white(`Cache query NFL teams: ${cacheNFL.length}`));
  console.log(chalk.white(`All NFL teams: ${allNFL.length}`));
  
  // Show missing teams
  const missingFromCache = allNFL.filter(team => 
    !cacheQuery?.some(cached => cached.id === team.id)
  );
  
  if (missingFromCache.length > 0) {
    console.log(chalk.red(`\\nMissing from cache (${missingFromCache.length} teams):`));
    missingFromCache.forEach(team => {
      console.log(chalk.white(`  ${team.name} - external_id: ${team.external_id || 'NULL'}`));
    });
  }
  
  // Check for NULL external_ids specifically
  const nullExternalIds = allNFL.filter(team => !team.external_id);
  if (nullExternalIds.length > 0) {
    console.log(chalk.yellow(`\\nTeams with NULL external_id (${nullExternalIds.length}):`));
    nullExternalIds.forEach(team => {
      console.log(chalk.white(`  ${team.name} (ID: ${team.id})`));
    });
  }
}

debugTeamLoading().catch(console.error);