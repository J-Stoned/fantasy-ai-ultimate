#!/usr/bin/env tsx
/**
 * Check ID conflicts to understand the unique constraint violations
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkConflicts() {
  console.log(chalk.bold.cyan('🔍 CHECKING ID CONFLICTS\n'));

  // 1. Check NCAA Baseball conflicts
  console.log(chalk.yellow('⚾ NCAA Baseball Conflicts:'));
  
  // Get a sample of players that need fixing
  const { data: needsFix } = await supabase
    .from('players')
    .select('id, name, external_id')
    .eq('sport', 'NCAA_BASEBALL')
    .like('external_id', 'espn_ncaa_%')
    .not('external_id', 'like', 'espn_ncaa_baseball_%')
    .limit(5);
  
  console.log('\nPlayers needing fix:');
  console.table(needsFix);
  
  // Check if the proposed IDs already exist
  if (needsFix && needsFix.length > 0) {
    for (const player of needsFix) {
      const proposedId = player.external_id.replace('espn_ncaa_', 'espn_ncaa_baseball_');
      
      const { data: existing } = await supabase
        .from('players')
        .select('id, name, sport')
        .eq('external_id', proposedId)
        .single();
      
      if (existing) {
        console.log(`\n❌ CONFLICT: ${player.name} (ID: ${player.id})`);
        console.log(`  Current ID: ${player.external_id}`);
        console.log(`  Proposed ID: ${proposedId}`);
        console.log(`  Already taken by: ${existing.name} (ID: ${existing.id}, Sport: ${existing.sport})`);
      }
    }
  }

  // 2. Check numeric team conflicts
  console.log(chalk.yellow('\n\n🏢 Numeric Team ID Status:'));
  
  const { data: numericTeams } = await supabase
    .from('teams')
    .select('id, name, sport, external_id')
    .filter('external_id', 'match', '^[0-9]+$')
    .limit(10);
  
  console.log('\nTeams with numeric IDs:');
  console.table(numericTeams);

  // 3. Check for duplicate external_ids
  console.log(chalk.yellow('\n\n🔄 Checking for duplicate external_ids:'));
  
  // This query would need to be done via RPC or manually
  const { data: allPlayers } = await supabase
    .from('players')
    .select('external_id')
    .not('external_id', 'is', null);
  
  const idCounts = new Map<string, number>();
  allPlayers?.forEach(p => {
    const count = idCounts.get(p.external_id) || 0;
    idCounts.set(p.external_id, count + 1);
  });
  
  const duplicates = Array.from(idCounts.entries())
    .filter(([_, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  if (duplicates.length > 0) {
    console.log('\nTop duplicate external_ids:');
    console.table(duplicates.map(([id, count]) => ({ external_id: id, count })));
  }

  // 4. Summary
  console.log(chalk.yellow('\n\n📊 Summary:'));
  
  const { count: ncaaBaseballNeedsFix } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BASEBALL')
    .like('external_id', 'espn_ncaa_%')
    .not('external_id', 'like', 'espn_ncaa_baseball_%');
  
  const { count: numericTeamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .filter('external_id', 'match', '^[0-9]+$');
  
  console.log(`  NCAA Baseball players needing fix: ${ncaaBaseballNeedsFix}`);
  console.log(`  Teams with numeric IDs: ${numericTeamCount}`);
  console.log(`  Total duplicate IDs found: ${duplicates.length}`);
}

checkConflicts().catch(console.error);