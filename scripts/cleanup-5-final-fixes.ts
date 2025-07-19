#!/usr/bin/env tsx
/**
 * 🏁 FINAL ID STANDARDIZATION FIXES
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

const limit = pLimit(24); // High concurrency for speed
const PAGE_SIZE = 1000;

async function fixNullSportTeams() {
  console.log(chalk.yellow('🏫 FIXING TEAMS WITH NULL SPORTS...\n'));

  // These are clearly college teams based on their names
  const collegeTeams = [
    { name: 'Western Kentucky Hilltoppers', sport: 'NCAA_FB' },
    { name: 'Georgetown Hoyas', sport: 'NCAA_BB' },
    { name: 'Jacksonville State Gamecocks', sport: 'NCAA_FB' },
    { name: 'Bellarmine Knights', sport: 'NCAA_BB' },
    { name: 'Yale Bulldogs', sport: 'NCAA_FB' },
    { name: 'UIC Flames', sport: 'NCAA_BB' },
    { name: 'George Washington Revolutionaries', sport: 'NCAA_BB' },
    { name: 'South Florida Bulls', sport: 'NCAA_FB' },
    { name: 'UConn Huskies', sport: 'NCAA_BB' }
  ];

  for (const team of collegeTeams) {
    const { data, error } = await supabase
      .from('teams')
      .update({ sport: team.sport })
      .eq('name', team.name)
      .is('sport', null)
      .select();

    if (data && data.length > 0) {
      console.log(`  ✅ ${team.name} → ${team.sport}`);
      
      // Now fix the numeric ID
      for (const t of data) {
        const newId = `espn_${team.sport.toLowerCase()}_${t.external_id}`;
        await supabase
          .from('teams')
          .update({ external_id: newId })
          .eq('id', t.id);
      }
    }
  }
}

async function continueNcaaBaseballMerge() {
  console.log(chalk.yellow('\n⚾ CONTINUING NCAA BASEBALL PLAYER MERGE...\n'));

  // Get remaining count
  const { count: totalCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NCAA_BASEBALL')
    .like('external_id', 'espn_ncaa_%')
    .not('external_id', 'like', 'espn_ncaa_baseball_%');

  if (!totalCount || totalCount === 0) {
    console.log('All NCAA Baseball players already fixed!');
    return;
  }

  console.log(`Found ${totalCount} players still to process`);
  
  const pages = Math.ceil(totalCount / PAGE_SIZE);
  const progressBar = new cliProgress.SingleBar({
    format: 'Merging |{bar}| {percentage}% | {value}/{total} | ETA: {eta}s',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591'
  });
  progressBar.start(totalCount, 0);

  let totalMerged = 0;
  let totalSkipped = 0;

  for (let page = 0; page < pages; page++) {
    const { data: players } = await supabase
      .from('players')
      .select('id, name, external_id')
      .eq('sport', 'NCAA_BASEBALL')
      .like('external_id', 'espn_ncaa_%')
      .not('external_id', 'like', 'espn_ncaa_baseball_%')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .order('id');

    if (!players || players.length === 0) break;

    const batchSize = 50;
    for (let i = 0; i < players.length; i += batchSize) {
      const batch = players.slice(i, i + batchSize);
      
      const promises = batch.map(player =>
        limit(async () => {
          const proposedId = player.external_id.replace('espn_ncaa_', 'espn_ncaa_baseball_');
          
          // Check for duplicate
          const { data: duplicate } = await supabase
            .from('players')
            .select('id')
            .eq('external_id', proposedId)
            .neq('id', player.id)
            .single();

          if (duplicate) {
            // Merge player stats
            try {
              // Get stats counts to decide which to keep
              const [oldStats, newStats] = await Promise.all([
                supabase
                  .from('player_game_logs')
                  .select('*', { count: 'exact', head: true })
                  .eq('player_id', player.id),
                supabase
                  .from('player_game_logs')
                  .select('*', { count: 'exact', head: true })
                  .eq('player_id', duplicate.id)
              ]);

              const oldCount = oldStats.count || 0;
              const newCount = newStats.count || 0;

              if (oldCount > 0 && newCount === 0) {
                // Old player has stats, new doesn't - keep old, update ID
                await supabase
                  .from('players')
                  .delete()
                  .eq('id', duplicate.id);
                
                await supabase
                  .from('players')
                  .update({ external_id: proposedId })
                  .eq('id', player.id);
              } else {
                // New player has stats or both have stats - merge to new
                if (oldCount > 0) {
                  await supabase
                    .from('player_game_logs')
                    .update({ player_id: duplicate.id })
                    .eq('player_id', player.id);
                  
                  await supabase
                    .from('player_stats')
                    .update({ player_id: duplicate.id })
                    .eq('player_id', player.id);
                }
                
                await supabase
                  .from('players')
                  .delete()
                  .eq('id', player.id);
              }
              
              totalMerged++;
            } catch (err) {
              totalSkipped++;
            }
          } else {
            // No duplicate, safe to update
            await supabase
              .from('players')
              .update({ external_id: proposedId })
              .eq('id', player.id);
            
            totalMerged++;
          }
          
          progressBar.increment();
        })
      );

      await Promise.all(promises);
    }
  }

  progressBar.stop();
  
  console.log(chalk.green(`\n✅ Results:`));
  console.log(`  - Processed ${totalMerged} players`);
  console.log(`  - Skipped ${totalSkipped} due to errors`);
}

async function removeBrokenTeams() {
  console.log(chalk.yellow('\n🗑️  REMOVING DUPLICATE TEAMS WITH SUFFIX IDs...\n'));

  const { data: suffixTeams } = await supabase
    .from('teams')
    .select('id, name, external_id')
    .or('external_id.like.%_48,external_id.like.%_56,external_id.like.%_47,external_id.like.%_50,external_id.like.%_93,external_id.like.%_70,external_id.like.%_66,external_id.like.%_79,external_id.like.%_62,external_id.like.%_94');

  if (suffixTeams && suffixTeams.length > 0) {
    console.log(`Found ${suffixTeams.length} teams with suffix IDs to remove`);
    
    for (const team of suffixTeams) {
      // Check if they have any games
      const { count } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`);

      if (count === 0) {
        const { error } = await supabase
          .from('teams')
          .delete()
          .eq('id', team.id);

        if (!error) {
          console.log(`  ✅ Removed duplicate: ${team.name} (${team.external_id})`);
        }
      }
    }
  }
}

async function finalReport() {
  console.log(chalk.yellow('\n📊 FINAL STANDARDIZATION REPORT...\n'));

  const queries = [
    supabase.from('teams').select('*', { count: 'exact', head: true }).like('external_id', 'espn_%_%'),
    supabase.from('players').select('*', { count: 'exact', head: true }).like('external_id', 'espn_%_%'),
    supabase.from('games').select('*', { count: 'exact', head: true }).like('external_id', 'espn_%_%'),
    supabase.from('teams').select('*', { count: 'exact', head: true }).filter('external_id', 'match', '^[0-9]+$'),
    supabase.from('players').select('*', { count: 'exact', head: true })
      .eq('sport', 'NCAA_BASEBALL')
      .like('external_id', 'espn_ncaa_%')
      .not('external_id', 'like', 'espn_ncaa_baseball_%')
  ];

  const [standardTeams, standardPlayers, standardGames, numericTeams, ncaaRemaining] = await Promise.all(queries);

  console.table({
    'Standardized Teams': standardTeams.count || 0,
    'Standardized Players': standardPlayers.count || 0,
    'Standardized Games': standardGames.count || 0,
    'Remaining Numeric Teams': numericTeams.count || 0,
    'NCAA Baseball Players Remaining': ncaaRemaining.count || 0
  });

  if ((numericTeams.count || 0) === 0 && (ncaaRemaining.count || 0) === 0) {
    console.log(chalk.bold.green('\n🎉 ALL IDs FULLY STANDARDIZED! 🎉'));
    console.log(chalk.green('✅ Ready to proceed to cleanup-6-handle-nulls.sql'));
  }
}

async function main() {
  const startTime = Date.now();

  try {
    await fixNullSportTeams();
    await removeBrokenTeams();
    await continueNcaaBaseballMerge();
    await finalReport();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green(`\n✨ Completed in ${duration}s`));

  } catch (error: any) {
    console.error(chalk.red('❌ Fatal error:'), error.message);
    process.exit(1);
  }
}

main();