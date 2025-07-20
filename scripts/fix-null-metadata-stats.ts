#!/usr/bin/env tsx
/**
 * 🔧 FIX NULL METADATA STATS
 * 
 * Add proper metadata to 586K stats that are missing it
 * Optimized for Ryzen 5 7600X + 32GB RAM with proper pagination
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

// 🔥 10X PERFORMANCE SETTINGS
const DB_LIMIT = pLimit(50); // 50 concurrent DB operations
const BATCH_SIZE = 1000; // Update 1K records at once (Supabase limit)

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
  console.log(chalk.bold.cyan('🔧 FIXING NULL METADATA STATS\n'));
  
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
  
  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: chalk.cyan('{bar}') + ' | {percentage}% | {value}/{total} | Fixed: {fixed} | Speed: {speed}/sec',
    barCompleteChar: '█',
    barIncompleteChar: '░'
  });
  
  progressBar.start(totalCount, 0, { fixed: 0, speed: 0 });
  
  let processed = 0;
  let fixed = 0;
  const startTime = Date.now();
  const sportCounts = new Map<string, number>();
  
  // Process in batches with pagination
  while (processed < totalCount) {
    // Fetch batch with joins to get game and player info
    const { data: batch, error } = await supabase
      .from('player_game_logs')
      .select(`
        id,
        stats,
        game_id,
        games!game_id (
          sport,
          external_id
        ),
        player_id,
        players!player_id (
          sport,
          external_id
        )
      `)
      .is('metadata', null)
      .range(0, BATCH_SIZE - 1) // Always get first batch since we'll update them
      .order('id');
      
    if (error) {
      console.error(chalk.red('\nError fetching batch:'), error);
      break;
    }
    
    if (!batch || batch.length === 0) break;
    
    // Prepare updates
    const updates: any[] = [];
    
    for (const stat of batch) {
      // Determine sport from multiple sources
      let sport = 'UNKNOWN';
      
      // 1. Try game sport first (most reliable)
      if (stat.games?.sport) {
        sport = stat.games.sport;
      }
      // 2. Try player sport
      else if (stat.players?.sport) {
        sport = stat.players.sport;
      }
      // 3. Try to identify by stat structure
      else {
        sport = identifySportByStats(stat.stats);
      }
      
      // Skip if we couldn't identify the sport
      if (sport === 'UNKNOWN') continue;
      
      // Track sport counts
      sportCounts.set(sport, (sportCounts.get(sport) || 0) + 1);
      
      // Prepare update with metadata
      updates.push({
        id: stat.id,
        metadata: {
          sport: sport,
          stat_group: 'players', // Default group
          collection_source: 'metadata-fix-2025'
        }
      });
    }
    
    // Update in smaller chunks for better performance
    if (updates.length > 0) {
      for (let i = 0; i < updates.length; i += 100) {
        const chunk = updates.slice(i, i + 100);
        
        await DB_LIMIT(async () => {
          // Update each record individually to handle errors gracefully
          for (const update of chunk) {
            const { error: updateError } = await supabase
              .from('player_game_logs')
              .update({ metadata: update.metadata })
              .eq('id', update.id);
              
            if (!updateError) {
              fixed++;
            }
          }
        });
      }
    }
    
    processed += batch.length;
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = Math.round(processed / elapsed);
    
    progressBar.update(processed, { 
      fixed: fixed,
      speed: speed
    });
  }
  
  progressBar.stop();
  
  // Display results
  console.log(chalk.bold.green('\n✅ METADATA FIX COMPLETE!\n'));
  console.log(chalk.cyan('📊 Stats fixed by sport:'));
  
  for (const [sport, count] of Array.from(sportCounts).sort((a, b) => b[1] - a[1])) {
    console.log(chalk.green(`  ${sport}: ${count.toLocaleString()}`));
  }
  
  console.log(chalk.yellow(`\n📈 Total fixed: ${fixed.toLocaleString()} / ${totalCount.toLocaleString()}`));
  
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(chalk.blue(`⏱️  Time: ${totalTime}s (${(totalTime / 60).toFixed(1)} minutes)`));
  console.log(chalk.blue(`🚀 Speed: ${Math.round(fixed / totalTime)} updates/sec`));
  
  // Verify fix
  console.log(chalk.bold.yellow('\n🔍 VERIFICATION:'));
  
  const { count: remainingNull } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .is('metadata', null);
    
  const { count: nbaCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .eq("metadata->>'sport'", 'NBA');
    
  console.log(chalk.gray(`  Remaining NULL metadata: ${remainingNull?.toLocaleString()}`));
  console.log(chalk.green(`  NBA stats with metadata: ${nbaCount?.toLocaleString()}`));
}

fixNullMetadata()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });