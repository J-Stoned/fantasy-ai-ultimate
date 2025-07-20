#!/usr/bin/env tsx
/**
 * 🚀 FIX NULL METADATA STATS - PROPERLY PAGINATED
 * 
 * Respects 1K query limits with proper pagination
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

// 🔥 SETTINGS WITH 1K LIMITS IN MIND
const DB_LIMIT = pLimit(50); // Concurrent DB operations
const QUERY_LIMIT = 999; // Stay under 1K limit
const UPDATE_BATCH = 500; // Update 500 at once

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
  console.log(chalk.bold.cyan('🚀 FIX NULL METADATA - PAGINATED VERSION\n'));
  
  // Count total
  const { count: totalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .is('metadata', null);
    
  console.log(chalk.yellow(`Found ${totalCount?.toLocaleString()} stats with NULL metadata\n`));
  
  if (!totalCount || totalCount === 0) {
    console.log(chalk.green('No stats to fix!'));
    return;
  }
  
  // LOAD DATA WITH PROPER PAGINATION
  console.log(chalk.bold.yellow('📊 LOADING DATA WITH PAGINATION...\n'));
  
  // 1. Load all games (paginated)
  console.log(chalk.yellow('Loading games...'));
  const gameMap = new Map<number, string>();
  let offset = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('games')
      .select('id, sport')
      .range(offset, offset + QUERY_LIMIT)
      .order('id');
      
    if (error) {
      console.error(chalk.red('Error loading games:'), error);
      break;
    }
      
    if (!data || data.length === 0) break;
    
    data.forEach(g => gameMap.set(g.id, g.sport));
    offset += data.length;
    
    process.stdout.write(chalk.gray(`  Loaded ${gameMap.size.toLocaleString()} games...\r`));
    
    if (data.length <= QUERY_LIMIT) break; // Last page
  }
  console.log(chalk.green(`\n✅ Loaded ${gameMap.size.toLocaleString()} games`));
  
  // 2. Load all players (paginated)
  console.log(chalk.yellow('\nLoading players...'));
  const playerMap = new Map<number, string>();
  offset = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('players')
      .select('id, sport')
      .range(offset, offset + QUERY_LIMIT)
      .order('id');
      
    if (error) {
      console.error(chalk.red('Error loading players:'), error);
      break;
    }
      
    if (!data || data.length === 0) break;
    
    data.forEach(p => playerMap.set(p.id, p.sport));
    offset += data.length;
    
    process.stdout.write(chalk.gray(`  Loaded ${playerMap.size.toLocaleString()} players...\r`));
    
    if (data.length <= QUERY_LIMIT) break; // Last page
  }
  console.log(chalk.green(`\n✅ Loaded ${playerMap.size.toLocaleString()} players\n`));
  
  // Progress bar for processing
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} | Fixed: {fixed} | Speed: {speed}/sec | ETA: {eta}s',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  });
  
  progressBar.start(totalCount, 0, { fixed: 0, speed: 0, eta: 0 });
  
  let processed = 0;
  let fixed = 0;
  const startTime = Date.now();
  const sportCounts = new Map<string, number>();
  
  // 3. Process stats in batches
  while (processed < totalCount) {
    // Get batch of NULL metadata stats
    const { data: batch, error } = await supabase
      .from('player_game_logs')
      .select('id, stats, game_id, player_id')
      .is('metadata', null)
      .range(0, UPDATE_BATCH - 1) // Always get first batch since we'll update them
      .order('id');
      
    if (error) {
      console.error(chalk.red('\nError fetching batch:'), error);
      break;
    }
    
    if (!batch || batch.length === 0) {
      console.log(chalk.yellow('\nNo more records to process'));
      break;
    }
    
    // Process batch in memory
    const updates: any[] = [];
    
    for (const stat of batch) {
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
            collection_source: 'paginated-fix'
          }
        });
      }
    }
    
    // Update this batch
    if (updates.length > 0) {
      // Split into smaller chunks to avoid timeouts
      for (let i = 0; i < updates.length; i += 100) {
        const chunk = updates.slice(i, i + 100);
        
        await DB_LIMIT(async () => {
          try {
            // Update each record
            const promises = chunk.map(update => 
              supabase
                .from('player_game_logs')
                .update({ metadata: update.metadata })
                .eq('id', update.id)
            );
            
            const results = await Promise.all(promises);
            const successful = results.filter(r => !r.error).length;
            fixed += successful;
            
          } catch (err) {
            console.error(chalk.red('\nUpdate error:'), err);
          }
        });
      }
    }
    
    processed += batch.length;
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = Math.round(processed / elapsed);
    const eta = Math.round((totalCount - processed) / speed);
    
    progressBar.update(processed, { 
      fixed: fixed,
      speed: speed,
      eta: eta
    });
    
    // Show progress every 10K records
    if (processed % 10000 === 0) {
      const sportSummary = Array.from(sportCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([s, c]) => `${s}:${c}`)
        .join(', ');
      console.log(chalk.gray(`\n  Top sports: ${sportSummary}`));
    }
  }
  
  progressBar.stop();
  
  // Display results
  console.log(chalk.bold.green('\n✅ METADATA FIX COMPLETE!\n'));
  console.log(chalk.cyan('📊 Stats fixed by sport:'));
  
  for (const [sport, count] of Array.from(sportCounts).sort((a, b) => b[1] - a[1])) {
    console.log(chalk.green(`  ${sport}: ${count.toLocaleString()}`));
  }
  
  console.log(chalk.yellow(`\n📈 Total processed: ${processed.toLocaleString()}`));
  console.log(chalk.yellow(`📈 Total fixed: ${fixed.toLocaleString()}`));
  
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(chalk.blue(`⏱️  Time: ${totalTime}s (${(totalTime / 60).toFixed(1)} minutes)`));
  console.log(chalk.blue(`🚀 Speed: ${Math.round(fixed / totalTime)} updates/sec`));
  
  // Verification
  console.log(chalk.bold.yellow('\n🔍 VERIFICATION:'));
  
  const { count: remainingNull } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .is('metadata', null);
    
  console.log(chalk.gray(`  Remaining NULL metadata: ${remainingNull?.toLocaleString()}`));
  
  if (sportCounts.has('NBA')) {
    console.log(chalk.green(`  🏀 NBA stats fixed: ${sportCounts.get('NBA')?.toLocaleString()}`));
  }
}

fixNullMetadata()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });