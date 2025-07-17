#!/usr/bin/env tsx
/**
 * Update games that reference legacy NBA teams
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateNBAGamesReferences() {
  console.log(chalk.bold.blue('UPDATING NBA GAMES REFERENCES\n'));
  
  // Same mapping as before
  const teamMappings = [
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
  
  let totalGamesUpdated = 0;
  
  for (const mapping of teamMappings) {
    console.log(chalk.yellow(`\nProcessing ${mapping.name}...`));
    
    // Update home team references
    const { count: homeCount } = await supabase
      .from('games')
      .update({ home_team_id: mapping.newId })
      .eq('home_team_id', mapping.oldId);
      
    // Update away team references
    const { count: awayCount } = await supabase
      .from('games')
      .update({ away_team_id: mapping.newId })
      .eq('away_team_id', mapping.oldId);
      
    const updated = (homeCount || 0) + (awayCount || 0);
    if (updated > 0) {
      console.log(chalk.green(`  ✅ Updated ${updated} game references`));
      totalGamesUpdated += updated;
    } else {
      console.log('  No games to update');
    }
  }
  
  console.log(chalk.green(`\n✅ Total games updated: ${totalGamesUpdated}`));
  
  // Also check player_game_logs for team_id references
  console.log(chalk.yellow('\nUpdating player_game_logs team references...'));
  
  let totalStatsUpdated = 0;
  
  for (const mapping of teamMappings) {
    const { count } = await supabase
      .from('player_game_logs')
      .update({ team_id: mapping.newId })
      .eq('team_id', mapping.oldId);
      
    if (count && count > 0) {
      console.log(`  ${mapping.name}: ${count} stats updated`);
      totalStatsUpdated += count;
    }
  }
  
  console.log(chalk.green(`✅ Total stats updated: ${totalStatsUpdated}`));
  
  // Now try to delete the old teams again
  console.log(chalk.yellow('\nAttempting to delete old teams again...'));
  
  const oldTeamIds = teamMappings.map(m => m.oldId);
  
  const { error: deleteError, count: deletedCount } = await supabase
    .from('teams')
    .delete()
    .in('id', oldTeamIds);
    
  if (deleteError) {
    console.error(chalk.red('Error deleting old teams:'), deleteError);
  } else {
    console.log(chalk.green(`✅ Successfully deleted ${deletedCount} duplicate teams!`));
  }
  
  // Final verification
  const { count: nbaTotal } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');
    
  const { count: nonCompliant } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA')
    .not('external_id', 'like', 'espn_nba_%');
    
  console.log(chalk.cyan(`\nFinal NBA teams: ${nbaTotal} total`));
  if (nonCompliant === 0) {
    console.log(chalk.bold.green('✅ All NBA teams are now compliant!'));
  } else {
    console.log(chalk.red(`❌ Still ${nonCompliant} non-compliant`));
  }
}

updateNBAGamesReferences().catch(console.error);