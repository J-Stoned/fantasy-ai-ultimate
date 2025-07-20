#!/usr/bin/env tsx
/**
 * 🔧 FIX NULL METADATA STATS - OPTIMIZED
 * 
 * Lighter version that avoids heavy joins
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

// 🔥 OPTIMIZED SETTINGS
const DB_LIMIT = pLimit(20); // Reduced concurrent DB operations
const BATCH_SIZE = 500; // Smaller batches as requested
const UPDATE_CHUNK = 50; // Update 50 records at once

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
  
  // Check each sport's identifiers
  for (const [sport, identifiers] of Object.entries(SPORT_IDENTIFIERS)) {
    const matches = identifiers.filter(key => statKeys.includes(key)).length;
    if (matches >= 2) {
      // For MLB and NFL, return the base sport
      if (sport.startsWith('MLB_')) return 'MLB';
      if (sport.startsWith('NFL_')) return 'NFL';
      return sport;
    }
  }
  
  return 'UNKNOWN';
}

async function fixNullMetadata() {
  console.log(chalk.bold.cyan('🔧 FIXING NULL METADATA STATS - OPTIMIZED\n'));
  
  // First, count total stats to fix
  const { count: totalCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .is('metadata', null);
    
  console.log(chalk.yellow(`Found ${totalCount?.toLocaleString()} stats with NULL metadata\n`));
  
  if (!totalCount || totalCount === 0) {
    console.log(chalk.green('No stats to fix!'));
    return;
  }
  
  // Load games and players into memory for fast lookups
  console.log(chalk.yellow('Loading game and player data...'));
  
  // Load all games with pagination
  const gameMap = new Map<number, string>(); // game_id -> sport
  let offset = 0;
  
  while (true) {
    const { data: games } = await supabase
      .from('games')
      .select('id, sport')
      .range(offset, offset + 999)
      .order('id');
      
    if (!games || games.length === 0) break;
    
    games.forEach(g => gameMap.set(g.id, g.sport));
    offset += games.length;
    
    if (games.length < 1000) break;
  }
  
  console.log(chalk.green(`  Loaded ${gameMap.size} games`));
  
  // Load all players with pagination
  const playerMap = new Map<number, string>(); // player_id -> sport
  offset = 0;
  
  while (true) {
    const { data: players } = await supabase
      .from('players')
      .select('id, sport')
      .range(offset, offset + 999)
      .order('id');
      
    if (!players || players.length === 0) break;
    
    players.forEach(p => playerMap.set(p.id, p.sport));
    offset += players.length;
    
    if (players.length < 1000) break;
  }
  
  console.log(chalk.green(`  Loaded ${playerMap.size} players\n`));
  
  // Progress bar
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
  
  // Process in batches
  while (processed < totalCount) {
    // Simple query without joins
    const { data: batch, error } = await supabase
      .from('player_game_logs')
      .select('id, stats, game_id, player_id')
      .is('metadata', null)
      .range(0, BATCH_SIZE - 1)
      .order('id');
      
    if (error) {
      console.error(chalk.red('\nError fetching batch:'), error);
      break;
    }
    
    if (!batch || batch.length === 0) {
      console.log(chalk.yellow('\nNo more records to process'));
      break;
    }
    
    // Prepare updates
    const updates: any[] = [];
    
    for (const stat of batch) {
      // Determine sport from our in-memory maps
      let sport = 'UNKNOWN';
      
      // 1. Try game sport first (most reliable)
      if (gameMap.has(stat.game_id)) {
        sport = gameMap.get(stat.game_id)!;
      }
      // 2. Try player sport
      else if (playerMap.has(stat.player_id)) {
        sport = playerMap.get(stat.player_id)!;
      }
      // 3. Try to identify by stat structure
      else {
        sport = identifySportByStats(stat.stats);
      }
      
      // Skip if we couldn't identify the sport
      if (sport === 'UNKNOWN') continue;
      
      // Track sport counts
      sportCounts.set(sport, (sportCounts.get(sport) || 0) + 1);
      
      // Prepare update
      updates.push({
        id: stat.id,
        metadata: {
          sport: sport,
          stat_group: 'players',
          collection_source: 'metadata-fix-optimized'
        }
      });
    }
    
    // Update in small chunks
    if (updates.length > 0) {
      for (let i = 0; i < updates.length; i += UPDATE_CHUNK) {
        const chunk = updates.slice(i, i + UPDATE_CHUNK);
        
        await DB_LIMIT(async () => {
          try {
            // Update each record
            for (const update of chunk) {
              const { error: updateError } = await supabase
                .from('player_game_logs')
                .update({ metadata: update.metadata })
                .eq('id', update.id);
                
              if (!updateError) {
                fixed++;
              } else if (updateError.message.includes('timeout')) {
                console.log(chalk.yellow(`\nTimeout on record ${update.id}, skipping...`));
              }
            }
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
    
    // Show detailed progress every 5000 records
    if (processed % 5000 === 0) {
      console.log(chalk.gray(`\n  Sports so far: ${Array.from(sportCounts.entries()).map(([s, c]) => `${s}:${c}`).join(', ')}`));
    }
  }
  
  progressBar.stop();
  
  // Display results
  console.log(chalk.bold.green('\n✅ METADATA FIX COMPLETE!\n'));
  console.log(chalk.cyan('📊 Stats fixed by sport:'));
  
  for (const [sport, count] of Array.from(sportCounts).sort((a, b) => b[1] - a[1])) {
    console.log(chalk.green(`  ${sport}: ${count.toLocaleString()}`));
  }
  
  console.log(chalk.yellow(`\n📈 Total fixed: ${fixed.toLocaleString()} / ${processed.toLocaleString()}`));
  
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(chalk.blue(`⏱️  Time: ${totalTime}s (${(totalTime / 60).toFixed(1)} minutes)`));
  console.log(chalk.blue(`🚀 Speed: ${Math.round(fixed / totalTime)} updates/sec`));
  
  // Quick verification
  console.log(chalk.bold.yellow('\n🔍 QUICK CHECK:'));
  
  const { count: remainingNull } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .is('metadata', null);
    
  console.log(chalk.gray(`  Remaining NULL metadata: ${remainingNull?.toLocaleString()}`));
  
  if (sportCounts.has('NBA')) {
    console.log(chalk.green(`  NBA stats fixed: ${sportCounts.get('NBA')?.toLocaleString()}`));
  }
}

fixNullMetadata()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });