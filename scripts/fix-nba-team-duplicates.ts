#!/usr/bin/env tsx
/**
 * Fix NBA team duplicates by transferring players
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface TeamMapping {
  oldId: number;
  newId: number;
  name: string;
}

async function fixNBATeamDuplicates() {
  console.log(chalk.bold.blue('FIXING NBA TEAM DUPLICATES\n'));
  
  // Mapping of old IDs to new IDs
  const teamMappings: TeamMapping[] = [
    { oldId: 95, newId: 800699, name: 'Orlando Magic' },
    { oldId: 78, newId: 800691, name: 'Chicago Bulls' },
    { oldId: 88, newId: 800713, name: 'Memphis Grizzlies' },
    { oldId: 99, newId: 800710, name: 'Sacramento Kings' },
    { oldId: 80, newId: 800711, name: 'Dallas Mavericks' },
    { oldId: 81, newId: 800701, name: 'Denver Nuggets' },
    { oldId: 101, newId: 800690, name: 'Toronto Raptors' },
    { oldId: 76, newId: 800687, name: 'Brooklyn Nets' },
    { oldId: 90, newId: 800695, name: 'Milwaukee Bucks' }
  ];
  
  let totalPlayersMoved = 0;
  
  // Process each team mapping
  for (const mapping of teamMappings) {
    console.log(chalk.yellow(`\nProcessing ${mapping.name}...`));
    
    // Get players from old team
    const { data: players, count } = await supabase
      .from('players')
      .select('id, name', { count: 'exact' })
      .eq('team_id', mapping.oldId);
      
    console.log(`  Found ${count} players to move`);
    
    if (players && players.length > 0) {
      // Update players to new team
      const { error } = await supabase
        .from('players')
        .update({ team_id: mapping.newId })
        .eq('team_id', mapping.oldId);
        
      if (error) {
        console.error(chalk.red(`  Error moving players: ${error.message}`));
      } else {
        console.log(chalk.green(`  ✅ Moved ${players.length} players to correct team`));
        totalPlayersMoved += players.length;
      }
    }
  }
  
  console.log(chalk.green(`\n✅ Total players moved: ${totalPlayersMoved}`));
  
  // Now delete the old teams
  console.log(chalk.yellow('\nDeleting old teams with legacy format...'));
  
  const oldTeamIds = teamMappings.map(m => m.oldId);
  
  const { error: deleteError, count: deletedCount } = await supabase
    .from('teams')
    .delete()
    .in('id', oldTeamIds);
    
  if (deleteError) {
    console.error(chalk.red('Error deleting old teams:'), deleteError);
  } else {
    console.log(chalk.green(`✅ Deleted ${deletedCount} duplicate teams`));
  }
  
  // Verify NBA teams are now compliant
  const { count: nonCompliant } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA')
    .not('external_id', 'like', 'espn_nba_%');
    
  if (nonCompliant === 0) {
    console.log(chalk.bold.green('\n✅ All NBA teams are now compliant!'));
  } else {
    console.log(chalk.red(`\n❌ Still ${nonCompliant} non-compliant NBA teams`));
    
    // Show what's left
    const { data: remaining } = await supabase
      .from('teams')
      .select('id, name, external_id')
      .eq('sport', 'NBA')
      .not('external_id', 'like', 'espn_nba_%')
      .limit(5);
      
    console.log('Remaining non-compliant teams:');
    remaining?.forEach(t => console.log(`  ${t.name}: ${t.external_id}`));
  }
}

fixNBATeamDuplicates().catch(console.error);