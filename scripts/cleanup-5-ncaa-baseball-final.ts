#!/usr/bin/env tsx
/**
 * 🚀 FINAL NCAA BASEBALL PLAYER FIX
 * More aggressive approach for the remaining 5,343 players
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import pLimit from 'p-limit';
import * as cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CPU_CORES = 12;
const limit = pLimit(CPU_CORES * 4); // 48 concurrent operations
const PAGE_SIZE = 1000;

async function analyzeConflicts() {
  console.log(chalk.yellow('🔍 ANALYZING NCAA BASEBALL CONFLICTS...\n'));

  // Get a sample of conflicts
  const { data: conflicts } = await supabase
    .from('players')
    .select('id, name, external_id')
    .eq('sport', 'NCAA_BASEBALL')
    .like('external_id', 'espn_ncaa_%')
    .not('external_id', 'like', 'espn_ncaa_baseball_%')
    .limit(10);

  if (!conflicts || conflicts.length === 0) return;

  console.log('Sample conflicts:');
  for (const player of conflicts) {
    const proposedId = player.external_id.replace('espn_ncaa_', 'espn_ncaa_baseball_');
    
    const { data: blocker } = await supabase
      .from('players')
      .select('id, name, team_id, created_at')
      .eq('external_id', proposedId)
      .single();

    if (blocker) {
      // Check which one has stats
      const [oldStats, newStats] = await Promise.all([
        supabase.from('player_game_logs').select('*', { count: 'exact', head: true }).eq('player_id', player.id),
        supabase.from('player_game_logs').select('*', { count: 'exact', head: true }).eq('player_id', blocker.id)
      ]);

      console.log(`\n${player.name}:`);
      console.log(`  Old: ID ${player.id}, ${oldStats.count || 0} stats`);
      console.log(`  New: ID ${blocker.id}, ${newStats.count || 0} stats`);
    }
  }
}

async function aggressiveMerge() {
  console.log(chalk.bold.cyan('\n🔥 AGGRESSIVE NCAA BASEBALL MERGE\n'));

  // Get total count
  const { count: totalCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BASEBALL')
    .like('external_id', 'espn_ncaa_%')
    .not('external_id', 'like', 'espn_ncaa_baseball_%');

  if (!totalCount || totalCount === 0) {
    console.log('No players to fix!');
    return;
  }

  console.log(`Processing ${totalCount} players...`);
  
  const pages = Math.ceil(totalCount / PAGE_SIZE);
  const progressBar = new cliProgress.SingleBar({
    format: 'Fixing |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591'
  });
  progressBar.start(totalCount, 0);

  let keepOldCount = 0;
  let mergeToNewCount = 0;
  let updateOnlyCount = 0;
  let errorCount = 0;

  for (let page = 0; page < pages; page++) {
    const { data: players } = await supabase
      .from('players')
      .select('id, name, external_id, team_id')
      .eq('sport', 'NCAA_BASEBALL')
      .like('external_id', 'espn_ncaa_%')
      .not('external_id', 'like', 'espn_ncaa_baseball_%')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .order('id');

    if (!players || players.length === 0) break;

    // Process in parallel batches
    const batchSize = 50;
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);
      
      const promises = batch.map(oldPlayer =>
        limit(async () => {
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
              // Get stats counts
              const [oldStats, newStats] = await Promise.all([
                supabase.from('player_game_logs').select('*', { count: 'exact', head: true }).eq('player_id', oldPlayer.id),
                supabase.from('player_game_logs').select('*', { count: 'exact', head: true }).eq('player_id', newPlayer.id)
              ]);

              const oldCount = oldStats.count || 0;
              const newCount = newStats.count || 0;

              if (oldCount > newCount) {
                // Old has more stats - delete new, keep old with updated ID
                await supabase.from('players').delete().eq('id', newPlayer.id);
                await supabase.from('players').update({ external_id: proposedId }).eq('id', oldPlayer.id);
                keepOldCount++;
              } else {
                // New has more stats or equal - merge old to new, delete old
                if (oldCount > 0) {
                  await supabase.from('player_game_logs').update({ player_id: newPlayer.id }).eq('player_id', oldPlayer.id);
                  await supabase.from('player_stats').update({ player_id: newPlayer.id }).eq('player_id', oldPlayer.id);
                }
                await supabase.from('players').delete().eq('id', oldPlayer.id);
                mergeToNewCount++;
              }
            } else {
              // No conflict, just update
              await supabase.from('players').update({ external_id: proposedId }).eq('id', oldPlayer.id);
              updateOnlyCount++;
            }
          } catch (err) {
            errorCount++;
          }
          
          progressBar.increment();
        })
      );

      await Promise.all(promises);
    }
  }

  progressBar.stop();
  
  console.log(chalk.green('\n✅ AGGRESSIVE MERGE COMPLETE:'));
  console.log(`  - Kept old player (more stats): ${keepOldCount}`);
  console.log(`  - Merged to new player: ${mergeToNewCount}`);
  console.log(`  - Simple updates: ${updateOnlyCount}`);
  console.log(`  - Errors: ${errorCount}`);
}

async function fixRemainingTeams() {
  console.log(chalk.yellow('\n🏢 FIXING LAST 3 NUMERIC TEAM IDs...\n'));

  const { data: numericTeams } = await supabase
    .from('teams')
    .select('id, name, sport, external_id')
    .filter('external_id', 'match', '^[0-9]+$');

  if (!numericTeams || numericTeams.length === 0) {
    console.log('No numeric teams found!');
    return;
  }

  for (const team of numericTeams) {
    const newId = `espn_${team.sport.toLowerCase()}_${team.external_id}`;
    
    // Force update with unique suffix if needed
    const { data: existing } = await supabase
      .from('teams')
      .select('id')
      .eq('external_id', newId)
      .single();

    const finalId = existing ? `${newId}_${team.id}` : newId;
    
    const { error } = await supabase
      .from('teams')
      .update({ external_id: finalId })
      .eq('id', team.id);

    if (!error) {
      console.log(`  ✅ ${team.name}: ${team.external_id} → ${finalId}`);
    }
  }
}

async function finalCheck() {
  console.log(chalk.yellow('\n📊 FINAL CHECK...\n'));

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
    'NCAA Baseball players remaining': ncaaCount.count || 0,
    'Numeric team IDs remaining': numericCount.count || 0
  });

  if ((ncaaCount.count || 0) === 0 && (numericCount.count || 0) === 0) {
    console.log(chalk.bold.green('\n🎉 ALL NCAA BASEBALL PLAYERS AND NUMERIC TEAMS FIXED! 🎉'));
  }
}

async function main() {
  const startTime = Date.now();

  try {
    await analyzeConflicts();
    await aggressiveMerge();
    await fixRemainingTeams();
    await finalCheck();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green(`\n✨ Completed in ${duration}s`));

  } catch (error: any) {
    console.error(chalk.red('❌ Fatal error:'), error.message);
    process.exit(1);
  }
}

main();