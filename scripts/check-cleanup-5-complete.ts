#!/usr/bin/env tsx
/**
 * Final check for cleanup-5 completion
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkComplete() {
  console.log(chalk.bold.cyan('📊 CLEANUP 5 - ID STANDARDIZATION FINAL CHECK\n'));

  // Check remaining issues
  const checks = await Promise.all([
    // Numeric team IDs
    supabase.from('teams').select('*', { count: 'exact', head: true })
      .filter('external_id', 'match', '^[0-9]+$'),
    
    // NCAA Baseball old format
    supabase.from('players').select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_BASEBALL')
      .like('external_id', 'espn_ncaa_%')
      .not('external_id', 'like', 'espn_ncaa_baseball_%'),
    
    // Total standardized
    supabase.from('teams').select('*', { count: 'exact', head: true })
      .like('external_id', 'espn_%_%'),
    
    supabase.from('players').select('*', { count: 'exact', head: true })
      .like('external_id', 'espn_%_%'),
    
    // NULL external_ids
    supabase.from('teams').select('*', { count: 'exact', head: true })
      .is('external_id', null),
    
    supabase.from('players').select('*', { count: 'exact', head: true })
      .is('external_id', null)
  ]);

  const [numericTeams, ncaaOldFormat, standardTeams, standardPlayers, nullTeams, nullPlayers] = checks;

  console.table({
    'Numeric Team IDs': numericTeams.count || 0,
    'NCAA Baseball Old Format': ncaaOldFormat.count || 0,
    'Standardized Teams': standardTeams.count || 0,
    'Standardized Players': standardPlayers.count || 0,
    'NULL Team IDs': nullTeams.count || 0,
    'NULL Player IDs': nullPlayers.count || 0
  });

  const totalIssues = (numericTeams.count || 0) + (ncaaOldFormat.count || 0);
  
  if (totalIssues === 0) {
    console.log(chalk.bold.green('\n✅ CLEANUP 5 COMPLETE! All IDs are standardized!\n'));
    console.log(chalk.green('Ready to proceed to cleanup-6-handle-nulls.sql'));
    return true;
  } else {
    console.log(chalk.yellow(`\n⚠️  ${totalIssues} issues remaining`));
    
    if (numericTeams.count) {
      const { data: samples } = await supabase
        .from('teams')
        .select('id, name, sport, external_id')
        .filter('external_id', 'match', '^[0-9]+$')
        .limit(5);
      
      console.log('\nSample numeric teams:');
      console.table(samples);
    }
    
    return false;
  }
}

checkComplete().then(isComplete => {
  if (isComplete) {
    console.log(chalk.bold.cyan('\n📝 TODO: Update task list to mark cleanup-5 as completed'));
  }
});