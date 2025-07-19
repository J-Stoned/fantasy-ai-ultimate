#!/usr/bin/env tsx
/**
 * Check what damage was done by team deletions
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkDamage() {
  console.log(chalk.bold.red('🚨 CHECKING TEAM DELETION DAMAGE\n'));

  // Count teams by sport
  const { data: allTeams } = await supabase
    .from('teams')
    .select('sport')
    .order('sport');
  
  const sportCounts = new Map<string, number>();
  allTeams?.forEach(team => {
    const count = sportCounts.get(team.sport || 'NULL') || 0;
    sportCounts.set(team.sport || 'NULL', count + 1);
  });
  
  const teamCounts = Array.from(sportCounts.entries()).map(([sport, count]) => ({ sport, count }));

  console.log('Teams remaining by sport:');
  console.table(teamCounts);

  // Check for teams with suffix IDs that still exist
  const { data: suffixTeams } = await supabase
    .from('teams')
    .select('id, name, sport, external_id')
    .or('external_id.like.%_48,external_id.like.%_56,external_id.like.%_47,external_id.like.%_50')
    .limit(20);

  if (suffixTeams && suffixTeams.length > 0) {
    console.log('\nTeams with suffix IDs still in database:');
    console.table(suffixTeams);
  }

  // Check total team count
  const { count: totalTeams } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true });

  console.log(`\nTotal teams in database: ${totalTeams}`);

  // Check some specific teams that might have been deleted
  const checkTeams = [
    'Daytona Tortugas',
    'Palm Beach Cardinals',
    'Birmingham Southern Panthers',
    'Duke Blue Devils',
    'Ohio State Buckeyes'
  ];

  console.log('\nChecking for specific teams:');
  for (const name of checkTeams) {
    const { data } = await supabase
      .from('teams')
      .select('id, name, sport, external_id')
      .eq('name', name);
    
    if (data && data.length > 0) {
      console.log(`✅ ${name}: ${data.length} entries`);
      data.forEach(t => console.log(`   - ${t.sport} (${t.external_id})`));
    } else {
      console.log(`❌ ${name}: NOT FOUND`);
    }
  }
}

checkDamage().catch(console.error);