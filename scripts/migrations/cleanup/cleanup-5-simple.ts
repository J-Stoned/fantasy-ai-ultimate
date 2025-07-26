#!/usr/bin/env tsx
/**
 * Simple ID standardization using Supabase service role
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

// Create client with service role key for full access
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function runCleanup() {
  console.log(chalk.bold.cyan('🏆 ID STANDARDIZATION\n'));

  try {
    // 1. First check what needs to be fixed
    console.log(chalk.yellow('📊 Checking current state...'));
    
    // Check numeric IDs
    const checkNumeric = await supabase.rpc('check_numeric_ids', {});
    console.log('\nNumeric IDs found:', checkNumeric.data);

    // 2. Fix NCAA Baseball IDs using RPC
    console.log(chalk.yellow('\n⚾ Fixing NCAA Baseball IDs...'));
    
    const ncaaFix = await supabase.rpc('fix_ncaa_baseball_ids', {});
    console.log('NCAA Baseball fixes:', ncaaFix.data);

    // 3. Fix numeric team IDs
    console.log(chalk.yellow('\n🏢 Fixing numeric team IDs...'));
    
    const teamFix = await supabase.rpc('fix_numeric_team_ids', {});
    console.log('Team fixes:', teamFix.data);

    console.log(chalk.green('\n✅ ID standardization complete!'));

  } catch (error: any) {
    console.error(chalk.red('❌ Error:'), error.message);
    
    // If RPC functions don't exist, let's do it manually
    console.log(chalk.yellow('\n🔧 Falling back to manual approach...'));
    await manualFix();
  }
}

async function manualFix() {
  // 1. Check and log what needs fixing
  const { data: numericTeams } = await supabase
    .from('teams')
    .select('id, name, sport, external_id')
    .or('external_id.eq.26,external_id.eq.2,external_id.eq.8')
    .limit(10);

  console.log('\nSample numeric teams:');
  console.table(numericTeams);

  // 2. Fix misclassified college teams first
  console.log(chalk.yellow('\n📚 Fixing misclassified college teams...'));
  
  // Get the specific teams we know are wrong
  const wrongTeams = [
    { id: 800721, name: 'UCLA Bruins', correct_sport: 'NCAA_BB' },
    { id: 800732, name: 'Auburn Tigers', correct_sport: 'NCAA_BB' },
    { id: 800741, name: 'Arkansas Razorbacks', correct_sport: 'NCAA_BB' }
  ];

  for (const team of wrongTeams) {
    const { error } = await supabase
      .from('teams')
      .update({ sport: team.correct_sport })
      .eq('id', team.id);
    
    if (!error) {
      console.log(`  ✅ Fixed ${team.name} -> ${team.correct_sport}`);
    }
  }

  // 3. Now standardize the IDs
  console.log(chalk.yellow('\n🔧 Standardizing IDs...'));
  
  // Get all teams with numeric external_ids
  const { data: teamsToFix } = await supabase
    .from('teams')
    .select('id, sport, external_id')
    .filter('external_id', 'match', '^[0-9]+$')
    .not('sport', 'is', null);

  console.log(`Found ${teamsToFix?.length || 0} teams to fix`);

  // Fix them in batches
  if (teamsToFix && teamsToFix.length > 0) {
    let fixed = 0;
    
    for (const team of teamsToFix) {
      const newId = `espn_${team.sport.toLowerCase()}_${team.external_id}`;
      
      // Check if this ID already exists
      const { data: existing } = await supabase
        .from('teams')
        .select('id')
        .eq('external_id', newId)
        .single();
      
      if (!existing) {
        const { error } = await supabase
          .from('teams')
          .update({ external_id: newId })
          .eq('id', team.id);
        
        if (!error) fixed++;
      }
    }
    
    console.log(`  ✅ Fixed ${fixed} team IDs`);
  }

  // 4. Summary
  const { count: remaining } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .filter('external_id', 'match', '^[0-9]+$');

  console.log(`\n📊 Remaining numeric IDs: ${remaining || 0}`);
}

runCleanup();