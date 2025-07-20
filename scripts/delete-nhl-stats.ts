#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteNHLStats() {
  console.log(chalk.bold.red('🗑️  DELETING NHL STATS\n'));
  
  // First count how many we're deleting
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .eq('metadata->>sport', 'NHL');
    
  console.log(chalk.yellow(`Found ${count || 0} NHL stats to delete`));
  
  if (count && count > 0) {
    console.log(chalk.red('\nDeleting all NHL stats...'));
    
    // Delete in batches to avoid timeout
    let deleted = 0;
    while (deleted < count) {
      const { error, data } = await supabase
        .from('player_game_logs')
        .delete()
        .eq('metadata->>sport', 'NHL')
        .select()
        .limit(1000);
        
      if (error) {
        console.error(chalk.red('Delete error:'), error);
        break;
      }
      
      deleted += data?.length || 0;
      console.log(chalk.gray(`  Deleted ${deleted}/${count} stats...`));
    }
    
    console.log(chalk.green(`\n✅ Deleted ${deleted} NHL stats!`));
  } else {
    console.log(chalk.yellow('\nNo NHL stats to delete'));
  }
  
  // Verify deletion
  const { count: remaining } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .eq('metadata->>sport', 'NHL');
    
  console.log(chalk.cyan(`\nRemaining NHL stats: ${remaining || 0}`));
}

deleteNHLStats()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });