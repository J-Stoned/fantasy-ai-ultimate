#!/usr/bin/env tsx
/**
 * 🚀 FIX NULL METADATA STATS - FINAL VERSION
 * 
 * Uses loosened criteria (1 match) for better identification
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
const DB_LIMIT = pLimit(50);
const QUERY_LIMIT = 999; // Stay under 1K limit
const UPDATE_BATCH = 500; // Process 500 at once

// Sport identification by stat keys - EXPANDED with 1 match requirement
const SPORT_IDENTIFIERS = {
  NBA: ['field_goals_made', 'field_goals_attempted', 'three_pointers_made', 'free_throws_made', 
        'assists', 'rebounds', 'points', 'steals', 'blocks', 'turnovers', 'minutes_played',
        'offensive_rebounds', 'defensive_rebounds', 'personal_fouls', 'plus_minus'],
  NHL: ['goals', 'assists', 'shots_on_goal', 'plus_minus', 'penalty_minutes', 'shots', 'hits',
        'blocked_shots', 'takeaways', 'giveaways', 'faceoff_wins', 'faceoff_losses',
        'time_on_ice', 'power_play_goals', 'short_handed_goals', 'game_winning_goals'],
  MLB_BATTING: ['at_bats', 'hits', 'runs_batted_in', 'batting_average', 'home_runs', 'runs', 
                'walks', 'strikeouts', 'stolen_bases', 'doubles', 'triples', 'singles',
                'on_base_percentage', 'slugging_percentage', 'obp', 'slg', 'avg', 'rbis'],
  MLB_PITCHING: ['earned_run_average', 'strikeouts', 'innings_pitched', 'earned_runs', 'era', 
                 'wins', 'losses', 'saves', 'hits_allowed', 'runs_allowed', 'walks_allowed',
                 'home_runs_allowed', 'whip', 'pitches', 'strikes'],
  NFL_PASSING: ['passing_yards', 'passing_touchdowns', 'completions', 'interceptions',
                'pass_attempts', 'completion_percentage', 'quarterback_rating', 'sacks_taken'],
  NFL_RUSHING: ['rushing_yards', 'rushing_attempts', 'rushing_touchdowns', 'carries',
                'yards_per_carry', 'longest_rush', 'fumbles'],
  NFL_RECEIVING: ['receptions', 'receiving_yards', 'receiving_touchdowns', 'targets',
                  'yards_per_reception', 'longest_reception', 'drops'],
  NFL_DEFENSE: ['tackles', 'sacks', 'interceptions', 'total_tackles', 'solo_tackles',
                'tackles_for_loss', 'qb_hits', 'passes_defended', 'forced_fumbles',
                'defensive_touchdowns', 'assisted_tackles']
};

// Special handling for simple stat objects
const SIMPLE_PATTERNS = {
  defense: 'NFL' // For stats that just have { defense: {...} }
};

function identifySportByStats(stats: any): string {
  if (!stats || typeof stats !== 'object') return 'UNKNOWN';
  
  const statKeys = Object.keys(stats);
  
  // Check simple patterns first
  for (const [pattern, sport] of Object.entries(SIMPLE_PATTERNS)) {
    if (statKeys.includes(pattern)) {
      return sport;
    }
  }
  
  // Check each sport's identifiers with 1 match requirement
  let bestMatch = { sport: 'UNKNOWN', matches: 0 };
  
  for (const [sport, identifiers] of Object.entries(SPORT_IDENTIFIERS)) {
    const matches = identifiers.filter(key => statKeys.includes(key)).length;
    if (matches > bestMatch.matches) {
      bestMatch = {
        sport: sport.startsWith('MLB_') ? 'MLB' : 
               sport.startsWith('NFL_') ? 'NFL' : 
               sport,
        matches: matches
      };
    }
  }
  
  // Return if we have at least 1 match
  return bestMatch.matches >= 1 ? bestMatch.sport : 'UNKNOWN';
}

async function fixNullMetadata() {
  console.log(chalk.bold.cyan('🚀 FIX NULL METADATA - FINAL VERSION\n'));
  
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
  
  // Load all games (paginated)
  console.log(chalk.yellow('Loading all games...'));
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
    
    if (data.length <= QUERY_LIMIT) break;
  }
  console.log(chalk.green(`\n✅ Loaded ${gameMap.size.toLocaleString()} games`));
  
  // Load all players (paginated)
  console.log(chalk.yellow('\nLoading all players...'));
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
    
    if (data.length <= QUERY_LIMIT) break;
  }
  console.log(chalk.green(`\n✅ Loaded ${playerMap.size.toLocaleString()} players\n`));
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} | Fixed: {fixed} | Speed: {speed}/sec | ETA: {eta}s',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  });
  
  progressBar.start(totalCount, 0, { fixed: 0, speed: 0, eta: 0 });
  
  let processed = 0;
  let fixed = 0;
  let skipped = 0;
  const startTime = Date.now();
  const sportCounts = new Map<string, number>();
  
  // Process stats in batches
  while (processed < totalCount) {
    // Get batch of NULL metadata stats
    const { data: batch, error } = await supabase
      .from('player_game_logs')
      .select('id, stats, game_id, player_id')
      .is('metadata', null)
      .range(0, UPDATE_BATCH - 1)
      .order('id');
      
    if (error) {
      console.error(chalk.red('\nError fetching batch:'), error);
      break;
    }
    
    if (!batch || batch.length === 0) {
      console.log(chalk.yellow('\nNo more records to process'));
      break;
    }
    
    // Process batch
    const updates: any[] = [];
    
    for (const stat of batch) {
      let sport = 'UNKNOWN';
      
      // 1. Try game sport first (most reliable)
      if (gameMap.has(stat.game_id)) {
        sport = gameMap.get(stat.game_id)!;
      } 
      // 2. Try player sport
      else if (playerMap.has(stat.player_id)) {
        sport = playerMap.get(stat.player_id)!;
      } 
      // 3. Try to identify by stat structure (loosened criteria)
      else {
        sport = identifySportByStats(stat.stats);
      }
      
      if (sport !== 'UNKNOWN') {
        sportCounts.set(sport, (sportCounts.get(sport) || 0) + 1);
        updates.push({
          id: stat.id,
          metadata: {
            sport: sport,
            stat_group: 'players',
            collection_source: 'final-fix'
          }
        });
      } else {
        skipped++;
      }
    }
    
    // Update this batch
    if (updates.length > 0) {
      // Update in chunks
      for (let i = 0; i < updates.length; i += 100) {
        const chunk = updates.slice(i, i + 100);
        
        await DB_LIMIT(async () => {
          try {
            const promises = chunk.map(update => 
              supabase
                .from('player_game_logs')
                .update({ metadata: update.metadata })
                .eq('id', update.id)
            );
            
            const results = await Promise.all(promises);
            const successful = results.filter(r => !r.error).length;
            fixed += successful;
            
            if (results.some(r => r.error)) {
              const errors = results.filter(r => r.error);
              console.error(chalk.red(`\n${errors.length} updates failed`));
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
    
    // Show progress every 25K records
    if (processed % 25000 === 0) {
      const sportSummary = Array.from(sportCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([s, c]) => `${s}:${c.toLocaleString()}`)
        .join(', ');
      console.log(chalk.gray(`\n  Progress: ${sportSummary}`));
      console.log(chalk.gray(`  Skipped: ${skipped.toLocaleString()} unidentifiable stats`));
    }
  }
  
  progressBar.stop();
  
  // Display results
  console.log(chalk.bold.green('\n✅ METADATA FIX COMPLETE!\n'));
  console.log(chalk.cyan('📊 Stats fixed by sport:'));
  
  const sortedSports = Array.from(sportCounts).sort((a, b) => b[1] - a[1]);
  for (const [sport, count] of sortedSports) {
    console.log(chalk.green(`  ${sport}: ${count.toLocaleString()}`));
  }
  
  console.log(chalk.yellow(`\n📈 Summary:`));
  console.log(chalk.yellow(`  Total processed: ${processed.toLocaleString()}`));
  console.log(chalk.yellow(`  Total fixed: ${fixed.toLocaleString()}`));
  console.log(chalk.yellow(`  Total skipped: ${skipped.toLocaleString()}`));
  
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(chalk.blue(`\n⏱️  Time: ${totalTime}s (${(totalTime / 60).toFixed(1)} minutes)`));
  console.log(chalk.blue(`🚀 Speed: ${Math.round(fixed / totalTime)} updates/sec`));
  
  // Verification
  console.log(chalk.bold.yellow('\n🔍 FINAL VERIFICATION:'));
  
  const { count: remainingNull } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .is('metadata', null);
    
  console.log(chalk.gray(`  Remaining NULL metadata: ${remainingNull?.toLocaleString()}`));
  
  if (sportCounts.has('NBA')) {
    console.log(chalk.green(`  🏀 NBA stats fixed: ${sportCounts.get('NBA')?.toLocaleString()}`));
  }
  
  // Check NBA coverage
  console.log(chalk.bold.cyan('\n🏀 NBA COVERAGE CHECK:'));
  
  const { count: nbaStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .eq("metadata->>'sport'", 'NBA');
    
  console.log(chalk.green(`  Total NBA stats in database: ${nbaStats?.toLocaleString()}`));
}

fixNullMetadata()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });