#!/usr/bin/env tsx
/**
 * Check remaining ID standardization issues
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkIssues() {
  console.log(chalk.bold.cyan('🔍 CHECKING REMAINING ISSUES\n'));

  // 1. Check team conflicts
  console.log(chalk.yellow('🏢 Team ID Conflicts:'));
  
  const { data: conflicts } = await supabase
    .from('teams')
    .select('id, name, sport, external_id')
    .or('external_id.eq.espn_ncaa_fb_48,external_id.eq.espn_ncaa_fb_56,external_id.eq.espn_ncaa_fb_47,external_id.eq.espn_ncaa_fb_50,external_id.eq.espn_ncaa_fb_93,external_id.eq.espn_ncaa_fb_70,external_id.eq.espn_ncaa_fb_66,external_id.eq.espn_ncaa_fb_79,external_id.eq.espn_ncaa_fb_62')
    .order('external_id');

  console.table(conflicts);

  // 2. Check remaining numeric teams
  console.log(chalk.yellow('\n🔢 Remaining Numeric Team IDs:'));
  
  const { data: numericTeams } = await supabase
    .from('teams')
    .select('id, name, sport, external_id')
    .filter('external_id', 'match', '^[0-9]+$');

  console.table(numericTeams);

  // 3. Sample remaining NCAA Baseball players
  console.log(chalk.yellow('\n⚾ Sample NCAA Baseball Players Still Needing Fix:'));
  
  const { data: ncaaPlayers } = await supabase
    .from('players')
    .select('id, name, external_id')
    .eq('sport', 'NCAA_BASEBALL')
    .like('external_id', 'espn_ncaa_%')
    .not('external_id', 'like', 'espn_ncaa_baseball_%')
    .limit(10);

  console.table(ncaaPlayers);

  // Check why they're not being fixed
  if (ncaaPlayers && ncaaPlayers.length > 0) {
    console.log(chalk.yellow('\nChecking for blocking duplicates:'));
    
    for (const player of ncaaPlayers.slice(0, 3)) {
      const proposedId = player.external_id.replace('espn_ncaa_', 'espn_ncaa_baseball_');
      
      const { data: blocker } = await supabase
        .from('players')
        .select('id, name, sport')
        .eq('external_id', proposedId)
        .single();

      if (blocker) {
        console.log(`\n❌ ${player.name} (${player.id}) blocked by:`);
        console.log(`   ${blocker.name} (${blocker.id}) - Sport: ${blocker.sport}`);
      }
    }
  }

  // 4. Summary
  console.log(chalk.yellow('\n📊 Summary:'));
  
  const { count: ncaaCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BASEBALL')
    .like('external_id', 'espn_ncaa_%')
    .not('external_id', 'like', 'espn_ncaa_baseball_%');

  const { count: duplicateCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .filter('external_id', 'like', '%_48')
    .or('external_id.like.%_56,external_id.like.%_47');

  console.log(`  NCAA Baseball players still needing fix: ${ncaaCount}`);
  console.log(`  Teams with conflict suffixes: ${duplicateCount}`);
}

checkIssues().catch(console.error);