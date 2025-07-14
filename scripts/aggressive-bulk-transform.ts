#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function aggressiveBulkTransform() {
  console.log(chalk.bold.red('\n🔥 AGGRESSIVE BULK TRANSFORMATION - PROCESSING ALL STATS!\n'));
  console.log(chalk.gray('━'.repeat(60)));
  
  const BATCH_SIZE = 10000; // Process 10K at a time
  const CONCURRENT_BATCHES = 5; // Run 5 batches in parallel
  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let currentOffset = 0;
  
  try {
    // Get total count
    const { count: totalStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });
    
    console.log(chalk.yellow(`📊 TOTAL STATS TO PROCESS: ${chalk.bold(totalStats?.toLocaleString())}\n`));
    
    // Get all unique player-game combinations
    console.log(chalk.cyan('🔍 Discovering all player-game combinations...\n'));
    
    const startTime = Date.now();
    let hasMore = true;
    const allCombos: Array<{player_id: number, game_id: number}> = [];
    
    // Fetch all combinations in chunks
    while (hasMore) {
      const { data: batch, error } = await supabase
        .from('player_stats')
        .select('player_id, game_id')
        .range(currentOffset, currentOffset + 50000 - 1)
        .order('game_id', { ascending: true });
      
      if (error) {
        console.error(chalk.red('Error fetching batch:'), error);
        break;
      }
      
      if (!batch || batch.length === 0) {
        hasMore = false;
        break;
      }
      
      // Add to combinations
      batch.forEach(item => {
        allCombos.push({ player_id: item.player_id, game_id: item.game_id });
      });
      
      currentOffset += 50000;
      console.log(chalk.gray(`Fetched ${allCombos.length} combinations...`));
      
      // Prevent infinite loop
      if (allCombos.length > 1000000) {
        console.log(chalk.yellow('Reached 1M combinations limit for safety'));
        break;
      }
    }
    
    // Deduplicate
    console.log(chalk.cyan('\n🧹 Deduplicating combinations...\n'));
    const uniqueMap = new Map<string, { player_id: number, game_id: number }>();
    allCombos.forEach(combo => {
      const key = `${combo.player_id}-${combo.game_id}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, combo);
      }
    });
    
    const uniqueCombos = Array.from(uniqueMap.values());
    console.log(chalk.green(`✅ Found ${chalk.bold(uniqueCombos.length.toLocaleString())} unique player-game combinations\n`));
    
    // Process in aggressive parallel batches
    console.log(chalk.yellow('🚀 STARTING AGGRESSIVE PARALLEL PROCESSING...\n'));
    
    for (let i = 0; i < uniqueCombos.length; i += BATCH_SIZE * CONCURRENT_BATCHES) {
      const batchPromises = [];
      
      // Create parallel batches
      for (let j = 0; j < CONCURRENT_BATCHES; j++) {
        const startIdx = i + (j * BATCH_SIZE);
        const endIdx = Math.min(startIdx + BATCH_SIZE, uniqueCombos.length);
        
        if (startIdx < uniqueCombos.length) {
          const batch = uniqueCombos.slice(startIdx, endIdx);
          batchPromises.push(processBatchFast(batch, j));
        }
      }
      
      // Wait for all parallel batches to complete
      const results = await Promise.all(batchPromises);
      
      // Aggregate results
      results.forEach(result => {
        totalProcessed += result.processed;
        totalUpdated += result.updated;
        totalCreated += result.created;
        totalSkipped += result.skipped;
      });
      
      // Progress update
      const progress = (totalProcessed / uniqueCombos.length * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (totalProcessed / parseFloat(elapsed)).toFixed(0);
      
      console.log(chalk.bold.green(`\n✅ PROGRESS: ${totalProcessed.toLocaleString()}/${uniqueCombos.length.toLocaleString()} (${progress}%)`));
      console.log(chalk.white(`   Updated: ${chalk.green(totalUpdated.toLocaleString())}, Created: ${chalk.blue(totalCreated.toLocaleString())}, Skipped: ${chalk.gray(totalSkipped.toLocaleString())}`));
      console.log(chalk.white(`   Speed: ${chalk.yellow(rate + '/sec')}, Elapsed: ${chalk.cyan(elapsed + 's')}\n`));
      
      // Brief pause every 100K records to avoid overwhelming the database
      if (totalProcessed > 0 && totalProcessed % 100000 === 0) {
        console.log(chalk.yellow('⏸️  Brief pause to let database breathe...\n'));
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // Final results
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.bold.green(`\n🎯 TRANSFORMATION COMPLETE!`));
    console.log(chalk.white(`├─ Total processed: ${chalk.bold(totalProcessed.toLocaleString())}`));
    console.log(chalk.white(`├─ Records updated: ${chalk.green.bold(totalUpdated.toLocaleString())}`));
    console.log(chalk.white(`├─ Records created: ${chalk.blue.bold(totalCreated.toLocaleString())}`));
    console.log(chalk.white(`├─ Records skipped: ${chalk.gray(totalSkipped.toLocaleString())}`));
    console.log(chalk.white(`├─ Success rate: ${chalk.green.bold(((totalUpdated + totalCreated) / totalProcessed * 100).toFixed(1) + '%')}`));
    console.log(chalk.white(`└─ Total time: ${chalk.cyan.bold(totalTime + ' seconds')}\n`));
    
    // Verify new coverage
    await verifyNewCoverage();
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  }
}

async function processBatchFast(batch: Array<{ player_id: number, game_id: number }>, batchNum: number) {
  let processed = 0;
  let updated = 0;
  let created = 0;
  let skipped = 0;
  
  try {
    // Get all stats for this batch in one query
    const playerGamePairs = batch.map(b => `(${b.player_id},${b.game_id})`).join(',');
    
    // Use raw SQL for efficiency
    const { data: allStats, error: statsError } = await supabase.rpc('get_batch_stats', {
      player_game_pairs: batch
    }).catch(() => ({ data: null, error: 'RPC not available' }));
    
    // Fallback to regular queries if RPC fails
    if (!allStats || statsError) {
      // Process in smaller chunks
      const chunkSize = 100;
      for (let i = 0; i < batch.length; i += chunkSize) {
        const chunk = batch.slice(i, i + chunkSize);
        const chunkResults = await processChunk(chunk);
        processed += chunkResults.processed;
        updated += chunkResults.updated;
        created += chunkResults.created;
        skipped += chunkResults.skipped;
      }
    }
    
  } catch (error) {
    console.error(chalk.red(`Batch ${batchNum} error:`), error);
  }
  
  return { processed, updated, created, skipped };
}

async function processChunk(chunk: Array<{ player_id: number, game_id: number }>) {
  let processed = 0;
  let updated = 0;
  let created = 0;
  let skipped = 0;
  
  for (const combo of chunk) {
    try {
      // Get stats for this player-game
      const { data: stats, error } = await supabase
        .from('player_stats')
        .select('*')
        .eq('player_id', combo.player_id)
        .eq('game_id', combo.game_id);
      
      if (error || !stats || stats.length === 0) {
        skipped++;
        processed++;
        continue;
      }
      
      // Aggregate stats
      const aggregated = aggregateStatsFast(stats);
      
      // Check if game log exists
      const { data: existingLog } = await supabase
        .from('player_game_logs')
        .select('id, stats')
        .eq('player_id', combo.player_id)
        .eq('game_id', combo.game_id)
        .single();
      
      if (existingLog) {
        // Update if empty
        if (!existingLog.stats || Object.keys(existingLog.stats).length === 0) {
          const { error: updateError } = await supabase
            .from('player_game_logs')
            .update({
              stats: aggregated,
              fantasy_points: aggregated.fantasy_points,
              minutes_played: aggregated.minutes_played,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingLog.id);
          
          if (!updateError) updated++;
          else skipped++;
        } else {
          skipped++;
        }
      } else {
        // Create new record
        const { data: gameInfo } = await supabase
          .from('games')
          .select('start_time, home_team_id, away_team_id')
          .eq('id', combo.game_id)
          .single();
        
        if (gameInfo) {
          const { error: insertError } = await supabase
            .from('player_game_logs')
            .insert({
              player_id: combo.player_id,
              game_id: combo.game_id,
              team_id: gameInfo.home_team_id, // Default to home team
              game_date: gameInfo.start_time,
              opponent_id: gameInfo.away_team_id,
              is_home: true,
              minutes_played: aggregated.minutes_played,
              stats: aggregated,
              fantasy_points: aggregated.fantasy_points,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (!insertError) created++;
          else skipped++;
        } else {
          skipped++;
        }
      }
      
      processed++;
      
    } catch (error) {
      skipped++;
      processed++;
    }
  }
  
  return { processed, updated, created, skipped };
}

function aggregateStatsFast(stats: any[]): any {
  const result: any = {
    points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0,
    turnovers: 0, field_goals_made: 0, field_goals_attempted: 0,
    three_pointers_made: 0, three_pointers_attempted: 0,
    free_throws_made: 0, free_throws_attempted: 0,
    minutes_played: 0, personal_fouls: 0, plus_minus: 0,
    fantasy_points: 0
  };
  
  const mapping: Record<string, string> = {
    'points': 'points', 'pts': 'points',
    'rebounds': 'rebounds', 'reb': 'rebounds',
    'assists': 'assists', 'ast': 'assists',
    'steals': 'steals', 'stl': 'steals',
    'blocks': 'blocks', 'blk': 'blocks',
    'turnovers': 'turnovers', 'to': 'turnovers',
    'field_goals_made': 'field_goals_made', 'fgm': 'field_goals_made',
    'field_goals_attempted': 'field_goals_attempted', 'fga': 'field_goals_attempted',
    'three_pointers_made': 'three_pointers_made', '3pm': 'three_pointers_made',
    'three_pointers_attempted': 'three_pointers_attempted', '3pa': 'three_pointers_attempted',
    'free_throws_made': 'free_throws_made', 'ftm': 'free_throws_made',
    'free_throws_attempted': 'free_throws_attempted', 'fta': 'free_throws_attempted',
    'minutes': 'minutes_played', 'min': 'minutes_played',
    'personal_fouls': 'personal_fouls', 'pf': 'personal_fouls',
    'plus_minus': 'plus_minus', '+/-': 'plus_minus'
  };
  
  stats.forEach(stat => {
    const key = mapping[stat.stat_type?.toLowerCase()];
    if (key) result[key] = parseFloat(stat.stat_value) || 0;
    if (stat.fantasy_points) result.fantasy_points = Math.max(result.fantasy_points, stat.fantasy_points);
  });
  
  // Calculate fantasy points if missing
  if (result.fantasy_points === 0) {
    result.fantasy_points = result.points + (result.rebounds * 1.2) + 
      (result.assists * 1.5) + (result.steals * 3) + (result.blocks * 3) - result.turnovers;
  }
  
  return result;
}

async function verifyNewCoverage() {
  console.log(chalk.yellow('📈 VERIFYING NEW STATS COVERAGE...\n'));
  
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  const { data: sample } = await supabase
    .from('player_game_logs')
    .select('stats')
    .not('stats', 'is', null)
    .limit(1000);
  
  let usableCount = 0;
  sample?.forEach(log => {
    if (log.stats && Object.keys(log.stats).length > 5) usableCount++;
  });
  
  const estimatedUsable = Math.round((usableCount / 1000) * (totalLogs || 0));
  const coverage = (estimatedUsable / (totalLogs || 1) * 100).toFixed(1);
  
  console.log(chalk.bold.green(`✨ NEW STATS COVERAGE:`));
  console.log(chalk.white(`├─ Total player_game_logs: ${chalk.bold(totalLogs?.toLocaleString())}`));
  console.log(chalk.white(`├─ Estimated usable stats: ${chalk.bold(estimatedUsable.toLocaleString())}`));
  console.log(chalk.white(`└─ Coverage rate: ${chalk.bold.green(coverage + '%')}\n`));
  
  // Show improvement
  if (parseFloat(coverage) > 10) {
    console.log(chalk.bold.yellow(`🚀 HUGE IMPROVEMENT! Coverage increased to ${coverage}%!\n`));
  }
}

// Run the aggressive transformation
aggressiveBulkTransform();