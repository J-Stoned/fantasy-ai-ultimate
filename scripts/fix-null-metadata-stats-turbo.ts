#!/usr/bin/env tsx
/**
 * 🚀 FIX NULL METADATA STATS - TURBO MODE
 * 
 * Loads ALL data into RAM and uses bulk operations
 * Optimized for Ryzen 5 7600X + 32GB RAM
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🔥 TURBO SETTINGS - USE ALL THE RAM!
const DB_LIMIT = pLimit(100); // Much higher concurrency
const LOAD_BATCH = 5000; // Load 5K records at once
const UPDATE_BATCH = 1000; // Update 1K at once (Supabase limit)

// Sport identification by stat keys
const SPORT_IDENTIFIERS = {
  NBA: ['field_goals_made', 'field_goals_attempted', 'three_pointers_made', 'free_throws_made'],
  NHL: ['goals', 'assists', 'shots_on_goal', 'plus_minus', 'penalty_minutes'],
  MLB_BATTING: ['at_bats', 'hits', 'runs_batted_in', 'batting_average'],
  MLB_PITCHING: ['earned_run_average', 'strikeouts', 'innings_pitched', 'earned_runs'],
  NFL_PASSING: ['passing_yards', 'passing_touchdowns', 'completions'],
  NFL_RUSHING: ['rushing_yards', 'rushing_attempts', 'rushing_touchdowns'],
  NFL_RECEIVING: ['receptions', 'receiving_yards', 'receiving_touchdowns'],
  NFL_DEFENSE: ['tackles', 'sacks', 'interceptions']
};

function identifySportByStats(stats: any): string {
  if (!stats || typeof stats !== 'object') return 'UNKNOWN';
  
  const statKeys = Object.keys(stats);
  
  for (const [sport, identifiers] of Object.entries(SPORT_IDENTIFIERS)) {
    const matches = identifiers.filter(key => statKeys.includes(key)).length;
    if (matches >= 2) {
      if (sport.startsWith('MLB_')) return 'MLB';
      if (sport.startsWith('NFL_')) return 'NFL';
      return sport;
    }
  }
  
  return 'UNKNOWN';
}

async function fixNullMetadata() {
  console.log(chalk.bold.cyan('🚀 TURBO METADATA FIX - USING ALL 32GB RAM!\n'));
  
  // Count total
  const { count: totalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .is('metadata', null);
    
  console.log(chalk.yellow(`Found ${totalCount?.toLocaleString()} stats to fix\n`));
  
  if (!totalCount || totalCount === 0) {
    console.log(chalk.green('No stats to fix!'));
    return;
  }
  
  // LOAD EVERYTHING INTO RAM!
  console.log(chalk.bold.yellow('🧠 LOADING ALL DATA INTO RAM...\n'));
  
  // 1. Load all games
  console.log(chalk.yellow('Loading games...'));
  const gameMap = new Map<number, string>();
  let offset = 0;
  
  while (true) {
    const { data } = await supabase
      .from('games')
      .select('id, sport')
      .range(offset, offset + 4999);
      
    if (!data || data.length === 0) break;
    data.forEach(g => gameMap.set(g.id, g.sport));
    offset += data.length;
    
    process.stdout.write(chalk.gray(`  Loaded ${gameMap.size.toLocaleString()} games...\r`));
    if (data.length < 5000) break;
  }
  console.log(chalk.green(`\n✅ Loaded ${gameMap.size.toLocaleString()} games`));
  
  // 2. Load all players
  console.log(chalk.yellow('\nLoading players...'));
  const playerMap = new Map<number, string>();
  offset = 0;
  
  while (true) {
    const { data } = await supabase
      .from('players')
      .select('id, sport')
      .range(offset, offset + 4999);
      
    if (!data || data.length === 0) break;
    data.forEach(p => playerMap.set(p.id, p.sport));
    offset += data.length;
    
    process.stdout.write(chalk.gray(`  Loaded ${playerMap.size.toLocaleString()} players...\r`));
    if (data.length < 5000) break;
  }
  console.log(chalk.green(`\n✅ Loaded ${playerMap.size.toLocaleString()} players`));
  
  // 3. Load ALL NULL metadata stats into RAM
  console.log(chalk.yellow('\nLoading all NULL metadata stats into RAM...'));
  const allStats: any[] = [];
  offset = 0;
  
  const loadProgress = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} stats loaded',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  });
  
  loadProgress.start(totalCount, 0);
  
  while (offset < totalCount) {
    const { data } = await supabase
      .from('player_game_logs')
      .select('id, stats, game_id, player_id')
      .is('metadata', null)
      .range(offset, offset + LOAD_BATCH - 1)
      .order('id');
      
    if (!data || data.length === 0) break;
    
    allStats.push(...data);
    offset += data.length;
    loadProgress.update(offset);
    
    if (data.length < LOAD_BATCH) break;
  }
  
  loadProgress.stop();
  console.log(chalk.green(`\n✅ Loaded ${allStats.length.toLocaleString()} stats into RAM`));
  
  // Calculate memory usage
  const memUsage = process.memoryUsage();
  console.log(chalk.gray(`  Memory used: ${Math.round(memUsage.heapUsed / 1024 / 1024)} MB\n`));
  
  // 4. Process all stats IN MEMORY
  console.log(chalk.bold.yellow('🔥 PROCESSING IN MEMORY...\n'));
  
  const updates: any[] = [];
  const sportCounts = new Map<string, number>();
  
  for (const stat of allStats) {
    let sport = 'UNKNOWN';
    
    // Determine sport
    if (gameMap.has(stat.game_id)) {
      sport = gameMap.get(stat.game_id)!;
    } else if (playerMap.has(stat.player_id)) {
      sport = playerMap.get(stat.player_id)!;
    } else {
      sport = identifySportByStats(stat.stats);
    }
    
    if (sport !== 'UNKNOWN') {
      sportCounts.set(sport, (sportCounts.get(sport) || 0) + 1);
      updates.push({
        id: stat.id,
        metadata: {
          sport: sport,
          stat_group: 'players',
          collection_source: 'turbo-metadata-fix'
        }
      });
    }
  }
  
  console.log(chalk.cyan('📊 Stats by sport:'));
  for (const [sport, count] of Array.from(sportCounts).sort((a, b) => b[1] - a[1])) {
    console.log(chalk.green(`  ${sport}: ${count.toLocaleString()}`));
  }
  
  console.log(chalk.yellow(`\n📝 Prepared ${updates.length.toLocaleString()} updates\n`));
  
  // 5. BULK UPDATE with progress
  console.log(chalk.bold.yellow('💾 BULK UPDATING DATABASE...\n'));
  
  const updateProgress = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} | Speed: {speed}/sec',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  });
  
  updateProgress.start(updates.length, 0, { speed: 0 });
  
  let updated = 0;
  const startTime = Date.now();
  
  // Process updates in parallel batches
  const updateBatches = [];
  for (let i = 0; i < updates.length; i += UPDATE_BATCH) {
    updateBatches.push(updates.slice(i, i + UPDATE_BATCH));
  }
  
  // Execute batches with concurrency limit
  for (let i = 0; i < updateBatches.length; i += 10) {
    const concurrentBatches = updateBatches.slice(i, i + 10);
    
    await Promise.all(
      concurrentBatches.map(batch => 
        DB_LIMIT(async () => {
          try {
            // Use upsert for better performance
            const { error, count } = await supabase
              .from('player_game_logs')
              .upsert(
                batch.map(u => ({ id: u.id, metadata: u.metadata })),
                { onConflict: 'id', count: 'exact' }
              );
              
            if (!error && count) {
              updated += count;
            } else if (error) {
              console.error(chalk.red(`\nBatch error: ${error.message}`));
            }
          } catch (err) {
            console.error(chalk.red('\nUpdate error:'), err);
          }
          
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = Math.round(updated / elapsed);
          updateProgress.update(updated, { speed });
        })
      )
    );
  }
  
  updateProgress.stop();
  
  // Final results
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  
  console.log(chalk.bold.green('\n✅ TURBO FIX COMPLETE!\n'));
  console.log(chalk.green(`📊 Updated: ${updated.toLocaleString()} stats`));
  console.log(chalk.blue(`⏱️  Time: ${totalTime}s (${(totalTime / 60).toFixed(1)} minutes)`));
  console.log(chalk.blue(`🚀 Speed: ${Math.round(updated / totalTime)} updates/sec`));
  
  // Memory stats
  const finalMem = process.memoryUsage();
  console.log(chalk.gray(`\n💾 Peak memory: ${Math.round(finalMem.heapUsed / 1024 / 1024)} MB`));
  
  // Verification
  const { count: remainingNull } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .is('metadata', null);
    
  console.log(chalk.yellow(`\n🔍 Remaining NULL metadata: ${remainingNull?.toLocaleString()}`));
  
  if (sportCounts.has('NBA')) {
    console.log(chalk.green(`🏀 NBA stats fixed: ${sportCounts.get('NBA')?.toLocaleString()}`));
  }
}

fixNullMetadata()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });