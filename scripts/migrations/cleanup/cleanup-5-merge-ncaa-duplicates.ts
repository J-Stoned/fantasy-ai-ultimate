#!/usr/bin/env tsx
/**
 * 🚀 MERGE DUPLICATE NCAA BASEBALL PLAYERS
 * These are the same players imported twice with different ID formats
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import pLimit from 'p-limit';
import os from 'os';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CPU_CORES = os.cpus().length;
const limit = pLimit(CPU_CORES * 2); // 24 concurrent operations

async function findAndMergeDuplicates() {
  console.log(chalk.bold.cyan('🔄 MERGING DUPLICATE NCAA BASEBALL PLAYERS\n'));

  // Find all NCAA Baseball players with old format IDs
  const { data: oldFormat } = await supabase
    .from('players')
    .select('id, name, external_id, team_id, jersey_number, position')
    .eq('sport', 'NCAA_BASEBALL')
    .like('external_id', 'espn_ncaa_%')
    .not('external_id', 'like', 'espn_ncaa_baseball_%');

  console.log(`Found ${oldFormat?.length || 0} players with old format IDs`);

  if (!oldFormat || oldFormat.length === 0) return;

  let mergedCount = 0;
  let deletedCount = 0;
  const errors: string[] = [];

  // Process in batches for speed
  const batchSize = 100;
  for (let i = 0; i < oldFormat.length; i += batchSize) {
    const batch = oldFormat.slice(i, i + batchSize);
    
    const promises = batch.map(oldPlayer =>
      limit(async () => {
        try {
          // Find the new format player
          const proposedId = oldPlayer.external_id.replace('espn_ncaa_', 'espn_ncaa_baseball_');
          
          const { data: newPlayer } = await supabase
            .from('players')
            .select('id, name')
            .eq('external_id', proposedId)
            .single();

          if (newPlayer && newPlayer.id !== oldPlayer.id) {
            // Same player, different IDs - merge by transferring stats and deleting old
            
            // Transfer all player_game_logs to the new player
            const { error: logsError } = await supabase
              .from('player_game_logs')
              .update({ player_id: newPlayer.id })
              .eq('player_id', oldPlayer.id);

            if (logsError) {
              errors.push(`Failed to transfer logs for ${oldPlayer.name}: ${logsError.message}`);
              return;
            }

            // Transfer any player_stats
            await supabase
              .from('player_stats')
              .update({ player_id: newPlayer.id })
              .eq('player_id', oldPlayer.id);

            // Delete the old duplicate player
            const { error: deleteError } = await supabase
              .from('players')
              .delete()
              .eq('id', oldPlayer.id);

            if (!deleteError) {
              deletedCount++;
            } else {
              errors.push(`Failed to delete ${oldPlayer.name}: ${deleteError.message}`);
            }
          } else {
            // No duplicate found, just update the ID format
            const { error } = await supabase
              .from('players')
              .update({ external_id: proposedId })
              .eq('id', oldPlayer.id);

            if (!error) {
              mergedCount++;
            }
          }
        } catch (err: any) {
          errors.push(`Error processing ${oldPlayer.name}: ${err.message}`);
        }
      })
    );

    await Promise.all(promises);
    
    // Progress update
    console.log(`  Processed ${Math.min(i + batchSize, oldFormat.length)}/${oldFormat.length} players...`);
  }

  console.log(chalk.green(`\n✅ Results:`));
  console.log(`  - Deleted ${deletedCount} duplicate players`);
  console.log(`  - Updated ${mergedCount} player IDs`);
  
  if (errors.length > 0) {
    console.log(chalk.red(`\n❌ Errors (${errors.length}):`));
    errors.slice(0, 5).forEach(err => console.log(`  - ${err}`));
    if (errors.length > 5) {
      console.log(`  ... and ${errors.length - 5} more errors`);
    }
  }
}

async function fixRemainingNumericTeams() {
  console.log(chalk.yellow('\n\n🏢 FIXING REMAINING NUMERIC TEAM IDs...\n'));

  const { data: numericTeams } = await supabase
    .from('teams')
    .select('id, name, sport, external_id')
    .filter('external_id', 'match', '^[0-9]+$');

  console.log(`Found ${numericTeams?.length || 0} teams with numeric IDs`);

  if (!numericTeams || numericTeams.length === 0) return;

  let fixed = 0;
  for (const team of numericTeams) {
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

      if (!error) {
        fixed++;
        console.log(`  ✅ ${team.name}: ${team.external_id} → ${newId}`);
      }
    } else {
      // Add suffix for conflict
      const { error } = await supabase
        .from('teams')
        .update({ external_id: `${newId}_${team.id}` })
        .eq('id', team.id);

      if (!error) {
        fixed++;
        console.log(`  ⚠️  ${team.name}: ${team.external_id} → ${newId}_${team.id} (conflict)`);
      }
    }
  }

  console.log(chalk.green(`\n✅ Fixed ${fixed} team IDs`));
}

async function finalReport() {
  console.log(chalk.yellow('\n\n📊 FINAL REPORT...\n'));

  const [ncaaCount, numericCount] = await Promise.all([
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_BASEBALL')
      .like('external_id', 'espn_ncaa_%')
      .not('external_id', 'like', 'espn_ncaa_baseball_%'),
    supabase
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .filter('external_id', 'match', '^[0-9]+$')
  ]);

  console.table({
    'NCAA Baseball players with old format': ncaaCount.count || 0,
    'Teams with numeric IDs': numericCount.count || 0
  });

  if ((ncaaCount.count || 0) === 0 && (numericCount.count || 0) === 0) {
    console.log(chalk.bold.green('\n🎉 ALL IDs STANDARDIZED! 🎉'));
  }
}

async function main() {
  const startTime = Date.now();

  try {
    await findAndMergeDuplicates();
    await fixRemainingNumericTeams();
    await finalReport();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green(`\n✨ Completed in ${duration}s`));

  } catch (error: any) {
    console.error(chalk.red('❌ Fatal error:'), error.message);
    process.exit(1);
  }
}

main();