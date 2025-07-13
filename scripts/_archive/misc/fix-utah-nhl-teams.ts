#!/usr/bin/env tsx
/**
 * 🔧 FIX UTAH NHL TEAMS
 * Remove the duplicate Utah team
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixUtahTeams() {
  console.log(chalk.bold.blue('\n🔧 FIXING UTAH NHL TEAMS\n'));
  
  // Get both Utah teams
  const { data: utahTeams } = await supabase
    .from('teams')
    .select('*')
    .eq('sport_id', 'nhl')
    .or('name.ilike.%Utah%');
  
  if (!utahTeams || utahTeams.length === 0) {
    console.log('No Utah teams found');
    return;
  }
  
  console.log(chalk.yellow(`Found ${utahTeams.length} Utah teams:\n`));
  utahTeams.forEach(team => {
    console.log(`  ${team.name} (${team.abbreviation})`);
    console.log(`    ID: ${team.id}`);
    console.log(`    External: ${team.external_id}`);
    console.log();
  });
  
  // The correct team should be "Utah Hockey Club" based on NHL's official naming
  // Delete "Utah Mammoth" which seems to be incorrect
  const mammoth = utahTeams.find(t => t.name === 'Utah Mammoth');
  const hockeyClub = utahTeams.find(t => t.name === 'Utah Hockey Club');
  
  if (mammoth) {
    console.log(chalk.yellow(`\nDeleting "${mammoth.name}"...`));
    
    // Check for any data
    const { count: playerCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', mammoth.id);
    
    if (playerCount && playerCount > 0) {
      console.log(chalk.red(`  Warning: ${playerCount} players found!`));
      
      // If hockey club exists, migrate players
      if (hockeyClub) {
        console.log(chalk.yellow(`  Migrating players to ${hockeyClub.name}...`));
        await supabase
          .from('players')
          .update({ team_id: hockeyClub.id })
          .eq('team_id', mammoth.id);
      }
    }
    
    // Delete the team
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', mammoth.id);
    
    if (error) {
      console.error(chalk.red('Error deleting team:'), error);
    } else {
      console.log(chalk.green('✓ Deleted Utah Mammoth'));
    }
  }
  
  // Update Utah Hockey Club if needed
  if (hockeyClub && !hockeyClub.external_id) {
    console.log(chalk.yellow('\nUpdating Utah Hockey Club with proper external_id...'));
    
    const { error } = await supabase
      .from('teams')
      .update({
        external_id: 'espn_nhl_129764',  // Use the ESPN ID
        abbreviation: hockeyClub.abbreviation || 'UTA'
      })
      .eq('id', hockeyClub.id);
    
    if (!error) {
      console.log(chalk.green('✓ Updated Utah Hockey Club'));
    }
  }
  
  // Final count
  const { count: finalCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nhl');
  
  console.log(chalk.bold.green(`\n✅ NHL teams after cleanup: ${finalCount}`));
}

fixUtahTeams().catch(console.error);