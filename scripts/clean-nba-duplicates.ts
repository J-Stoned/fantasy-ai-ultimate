#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanNBADuplicates() {
  console.log(chalk.bold.blue('CLEANING NBA TEAM DUPLICATES\n'));
  
  // Get the legacy format teams to remove
  const legacyIds = [76, 78, 80, 81, 88, 90, 95, 99, 101]; // IDs from the analysis
  
  console.log(`Removing ${legacyIds.length} duplicate teams with legacy format...`);
  
  const { error, count } = await supabase
    .from('teams')
    .delete()
    .in('id', legacyIds);
    
  if (error) {
    console.error(chalk.red('Error removing duplicates:'), error);
  } else {
    console.log(chalk.green(`✅ Removed ${count} duplicate teams`));
  }
  
  // Also remove the NULL external_id teams since they're duplicates too
  console.log('\nRemoving NBA teams with NULL external_ids...');
  
  const { error: nullError, count: nullCount } = await supabase
    .from('teams')
    .delete()
    .eq('sport', 'NBA')
    .is('external_id', null);
    
  if (nullError) {
    console.error(chalk.red('Error removing NULL teams:'), nullError);
  } else {
    console.log(chalk.green(`✅ Removed ${nullCount} teams with NULL external_ids`));
  }
  
  // Final verification
  const { data: remaining, count: totalCount } = await supabase
    .from('teams')
    .select('id, name, external_id', { count: 'exact' })
    .eq('sport', 'NBA');
    
  console.log(chalk.cyan(`\nFinal NBA team count: ${totalCount}`));
  
  // Check compliance
  const nonCompliant = remaining?.filter(t => !t.external_id?.startsWith('espn_nba_')) || [];
  
  if (nonCompliant.length === 0) {
    console.log(chalk.green('✅ All NBA teams are now compliant!'));
  } else {
    console.log(chalk.red(`❌ Still ${nonCompliant.length} non-compliant teams:`));
    nonCompliant.forEach(t => console.log(`  ${t.name}: ${t.external_id}`));
  }
}

cleanNBADuplicates().catch(console.error);