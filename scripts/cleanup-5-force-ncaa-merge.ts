#!/usr/bin/env tsx
/**
 * 🔨 FORCE NCAA BASEBALL MERGE
 * For duplicates with 0 stats, keep the newer one (higher ID)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function forceMerge() {
  console.log(chalk.bold.red('🔨 FORCE NCAA BASEBALL MERGE\n'));
  console.log(chalk.yellow('For players with 0 stats on both sides, keeping the newer player (higher ID)\n'));

  // Get remaining players
  const { data: oldPlayers } = await supabase
    .from('players')
    .select('id, name, external_id')
    .eq('sport', 'NCAA_BASEBALL')
    .like('external_id', 'espn_ncaa_%')
    .not('external_id', 'like', 'espn_ncaa_baseball_%')
    .order('id')
    .limit(1000);

  if (!oldPlayers || oldPlayers.length === 0) {
    console.log('No players to process!');
    return;
  }

  console.log(`Processing ${oldPlayers.length} remaining players...`);

  let deletedCount = 0;
  let updatedCount = 0;
  const errors: string[] = [];

  // Process in chunks
  const chunkSize = 100;
  for (let i = 0; i < oldPlayers.length; i += chunkSize) {
    const chunk = oldPlayers.slice(i, i + chunkSize);
    
    for (const oldPlayer of chunk) {
      try {
        const proposedId = oldPlayer.external_id.replace('espn_ncaa_', 'espn_ncaa_baseball_');
        
        // Check for blocker
        const { data: newPlayer } = await supabase
          .from('players')
          .select('id')
          .eq('external_id', proposedId)
          .neq('id', oldPlayer.id)
          .single();

        if (newPlayer) {
          // Both have 0 stats, delete the older one (lower ID)
          if (oldPlayer.id < newPlayer.id) {
            // Delete old player
            const { error } = await supabase
              .from('players')
              .delete()
              .eq('id', oldPlayer.id);

            if (!error) {
              deletedCount++;
            } else {
              errors.push(`Failed to delete ${oldPlayer.name} (${oldPlayer.id}): ${error.message}`);
            }
          } else {
            // Delete new player and update old
            await supabase
              .from('players')
              .delete()
              .eq('id', newPlayer.id);

            const { error } = await supabase
              .from('players')
              .update({ external_id: proposedId })
              .eq('id', oldPlayer.id);

            if (!error) {
              updatedCount++;
            }
          }
        } else {
          // No conflict, update
          const { error } = await supabase
            .from('players')
            .update({ external_id: proposedId })
            .eq('id', oldPlayer.id);

          if (!error) {
            updatedCount++;
          }
        }
      } catch (err: any) {
        errors.push(`Error processing ${oldPlayer.name}: ${err.message}`);
      }
    }
    
    console.log(`  Processed ${Math.min(i + chunkSize, oldPlayers.length)}/${oldPlayers.length}...`);
  }

  console.log(chalk.green('\n✅ FORCE MERGE COMPLETE:'));
  console.log(`  - Deleted old duplicates: ${deletedCount}`);
  console.log(`  - Updated IDs: ${updatedCount}`);
  
  if (errors.length > 0) {
    console.log(chalk.red(`  - Errors: ${errors.length}`));
    errors.slice(0, 5).forEach(e => console.log(`    ${e}`));
  }

  // Final check
  const { count } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BASEBALL')
    .like('external_id', 'espn_ncaa_%')
    .not('external_id', 'like', 'espn_ncaa_baseball_%');

  console.log(chalk.yellow(`\n📊 Remaining: ${count || 0} NCAA Baseball players`));
  
  if ((count || 0) === 0) {
    console.log(chalk.bold.green('\n🎉 ALL NCAA BASEBALL PLAYERS FINALLY FIXED! 🎉'));
  }
}

forceMerge().catch(console.error);