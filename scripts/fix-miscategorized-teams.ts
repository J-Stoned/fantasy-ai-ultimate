#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixMiscategorizedTeams() {
  console.log(chalk.bold.blue('FIXING MISCATEGORIZED TEAMS\n'));
  
  // Fix Bradley Braves
  const { error: error1 } = await supabase
    .from('teams')
    .update({ 
      sport: 'NCAA_BB',
      external_id: 'espn_ncaabb_71' 
    })
    .eq('id', 223);
    
  if (error1) {
    console.error(chalk.red('Error fixing Bradley Braves:'), error1);
  } else {
    console.log(chalk.green('✅ Fixed Bradley Braves: MLB → NCAA_BB'));
  }
  
  // Fix Arizona Cardinals
  const { error: error2 } = await supabase
    .from('teams')
    .update({ sport: 'NFL' })
    .eq('id', 809367);
    
  if (error2) {
    console.error(chalk.red('Error fixing Arizona Cardinals:'), error2);
  } else {
    console.log(chalk.green('✅ Fixed Arizona Cardinals: MLB → NFL'));
  }
  
  // Verify MLB teams are now compliant
  const { count: mlbNonCompliant } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'MLB')
    .not('external_id', 'like', 'espn_mlb_%');
    
  if (mlbNonCompliant === 0) {
    console.log(chalk.green('\n✅ All MLB teams are now compliant!'));
  } else {
    console.log(chalk.red(`\n❌ Still ${mlbNonCompliant} non-compliant MLB teams`));
  }
}

fixMiscategorizedTeams().catch(console.error);