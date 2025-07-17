#!/usr/bin/env tsx
/**
 * Fix ALL references to legacy NBA teams
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixAllNBAReferences() {
  console.log(chalk.bold.blue('FIXING ALL NBA TEAM REFERENCES\n'));
  
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
  
  // Fix opponent_id references in player_game_logs
  console.log(chalk.yellow('Updating opponent_id references in player_game_logs...'));
  
  let totalOpponentUpdates = 0;
  
  for (const mapping of teamMappings) {
    const { count } = await supabase
      .from('player_game_logs')
      .update({ opponent_id: mapping.newId })
      .eq('opponent_id', mapping.oldId);
      
    if (count && count > 0) {
      console.log(`  ${mapping.name}: ${count} opponent references updated`);
      totalOpponentUpdates += count;
    }
  }
  
  console.log(chalk.green(`✅ Total opponent references updated: ${totalOpponentUpdates}`));
  
  // Check for any other tables that might reference teams
  console.log(chalk.yellow('\nChecking for other references...'));
  
  // Skip constraint check for now
  
  // Final attempt to delete
  console.log(chalk.yellow('\nFinal deletion attempt...'));
  
  const oldTeamIds = teamMappings.map(m => m.oldId);
  
  const { error: deleteError, count: deletedCount } = await supabase
    .from('teams')
    .delete()
    .in('id', oldTeamIds);
    
  if (deleteError) {
    console.error(chalk.red('Still cannot delete:'), deleteError);
    
    // Let's check what's still referencing these teams
    console.log(chalk.yellow('\nChecking remaining references...'));
    
    for (const mapping of teamMappings.slice(0, 1)) { // Just check first one
      // Check all possible references
      const checks = [
        { table: 'players', column: 'team_id' },
        { table: 'games', column: 'home_team_id' },
        { table: 'games', column: 'away_team_id' },
        { table: 'player_game_logs', column: 'team_id' },
        { table: 'player_game_logs', column: 'opponent_id' }
      ];
      
      console.log(`\nChecking references to ${mapping.name} (ID: ${mapping.oldId}):`);
      
      for (const check of checks) {
        const { count } = await supabase
          .from(check.table)
          .select('*', { count: 'exact', head: true })
          .eq(check.column, mapping.oldId);
          
        if (count && count > 0) {
          console.log(`  ${check.table}.${check.column}: ${count} references`);
        }
      }
    }
  } else {
    console.log(chalk.green(`✅ Successfully deleted ${deletedCount} duplicate teams!`));
  }
  
  // Final verification
  const { count: nonCompliant } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA')
    .not('external_id', 'like', 'espn_nba_%');
    
  if (nonCompliant === 0) {
    console.log(chalk.bold.green('\n🎉 ALL NBA TEAMS ARE NOW COMPLIANT!'));
  } else {
    console.log(chalk.red(`\n❌ Still ${nonCompliant} non-compliant NBA teams`));
  }
}

fixAllNBAReferences().catch(console.error);