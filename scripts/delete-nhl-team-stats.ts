#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteNHLTeamStats() {
  console.log(chalk.bold.red('🗑️  DELETING NHL TEAM STATS\n'));
  
  // Get NHL team IDs
  const { data: nhlTeams } = await supabase
    .from('teams')
    .select('id')
    .eq('sport', 'NHL');
    
  const teamIds = nhlTeams?.map(t => t.id) || [];
  
  console.log(chalk.yellow(`Found ${teamIds.length} NHL teams`));
  console.log(chalk.yellow(`Will delete stats for team IDs: ${teamIds.slice(0, 5).join(', ')}...`));
  
  // Count stats to delete
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('team_id', teamIds);
    
  console.log(chalk.red(`\nFound ${count || 0} NHL team stats to delete`));
  
  if (count && count > 0) {
    console.log(chalk.yellow('\nDeleting in batches...'));
    
    let deleted = 0;
    let batchCount = 0;
    
    while (deleted < count) {
      batchCount++;
      console.log(chalk.gray(`  Batch ${batchCount}: Deleting up to 1000 records...`));
      
      // Get IDs to delete first
      const { data: idsToDelete } = await supabase
        .from('player_game_logs')
        .select('id')
        .in('team_id', teamIds)
        .order('id')
        .limit(1000);
        
      if (!idsToDelete || idsToDelete.length === 0) {
        console.log(chalk.yellow('    No more records found'));
        break;
      }
      
      // Delete by IDs
      const { error, data } = await supabase
        .from('player_game_logs')
        .delete()
        .in('id', idsToDelete.map(r => r.id))
        .select('id');
        
      if (error) {
        console.error(chalk.red('Delete error:'), error);
        break;
      }
      
      const batchDeleted = data?.length || 0;
      deleted += batchDeleted;
      
      console.log(chalk.gray(`    Deleted ${batchDeleted} records (${deleted}/${count} total)`));
      
      if (batchDeleted === 0) {
        console.log(chalk.yellow('    No more records to delete'));
        break;
      }
    }
    
    console.log(chalk.green(`\n✅ Deleted ${deleted} NHL team stats!`));
  } else {
    console.log(chalk.yellow('\nNo NHL team stats to delete'));
  }
  
  // Verify deletion
  const { count: remaining } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('team_id', teamIds);
    
  console.log(chalk.cyan(`\nRemaining NHL team stats: ${remaining || 0}`));
}

deleteNHLTeamStats()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });