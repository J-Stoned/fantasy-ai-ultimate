#!/usr/bin/env tsx
/**
 * Fix player_stats entries that have ESPN IDs instead of database player IDs
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixPlayerStatsMapping() {
  console.log(chalk.bold.cyan('\n🔧 FIXING PLAYER STATS MAPPING\n'));

  try {
    // First, get all the problematic stats
    console.log('Finding stats with ESPN player IDs...');
    const { data: badStats, error: statsError } = await supabase
      .from('player_stats')
      .select('id, player_id, game_id')
      .gte('player_id', 100000000) // ESPN IDs are in the 100M+ range
      .order('id');

    if (statsError) throw statsError;
    console.log(`Found ${badStats?.length || 0} stats with ESPN player IDs`);

    if (!badStats || badStats.length === 0) {
      console.log(chalk.green('✅ No bad stats found!'));
      return;
    }

    // Get unique ESPN IDs
    const espnIds = [...new Set(badStats.map(s => s.player_id))];
    console.log(`Unique ESPN player IDs: ${espnIds.length}`);

    // Build mapping of ESPN ID to database ID
    console.log('\nBuilding player ID mapping...');
    const mapping = new Map<number, number>();
    let mapped = 0;

    for (const espnId of espnIds) {
      // Find player by ESPN ID
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('id')
        .eq('external_id', `espn_nfl_${espnId}`)
        .single();

      if (!playerError && player) {
        mapping.set(espnId, player.id);
        mapped++;
      }
    }

    console.log(`Mapped ${mapped} out of ${espnIds.length} ESPN IDs to database IDs`);

    // Update stats in batches
    console.log('\nUpdating player_stats...');
    let updated = 0;
    const batchSize = 1000;

    for (let i = 0; i < badStats.length; i += batchSize) {
      const batch = badStats.slice(i, i + batchSize);
      
      // Group by correct player_id for bulk updates
      const updates = new Map<number, number[]>();
      
      for (const stat of batch) {
        const correctId = mapping.get(stat.player_id);
        if (correctId) {
          if (!updates.has(correctId)) {
            updates.set(correctId, []);
          }
          updates.get(correctId)!.push(stat.id);
        }
      }

      // Perform updates
      for (const [playerId, statIds] of updates) {
        const { error: updateError } = await supabase
          .from('player_stats')
          .update({ player_id: playerId })
          .in('id', statIds);

        if (updateError) {
          console.error(`Error updating stats for player ${playerId}:`, updateError);
        } else {
          updated += statIds.length;
        }
      }

      console.log(`Progress: ${updated}/${badStats.length} (${((updated/badStats.length)*100).toFixed(1)}%)`);
    }

    console.log(chalk.green(`\n✅ Successfully updated ${updated} player_stats entries!`));

    // Delete any remaining unmapped stats (no corresponding player)
    const unmapped = badStats.filter(s => !mapping.has(s.player_id));
    if (unmapped.length > 0) {
      console.log(`\nDeleting ${unmapped.length} stats with no matching player...`);
      const { error: deleteError } = await supabase
        .from('player_stats')
        .delete()
        .in('id', unmapped.map(s => s.id));

      if (deleteError) {
        console.error('Error deleting unmapped stats:', deleteError);
      } else {
        console.log(chalk.yellow(`Deleted ${unmapped.length} unmapped stats`));
      }
    }

  } catch (error) {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

// Run the fix
fixPlayerStatsMapping();