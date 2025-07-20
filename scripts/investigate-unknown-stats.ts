#!/usr/bin/env tsx
/**
 * 🔍 INVESTIGATE UNKNOWN STATS
 * 
 * Figure out what those 586K stats with NULL metadata are
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateUnknownStats() {
  console.log(chalk.bold.cyan('🔍 INVESTIGATING 586K UNKNOWN STATS\n'));
  
  // Get sample of stats with NULL metadata
  console.log(chalk.yellow('Sampling stats with NULL metadata...'));
  const { data: nullMetadataStats } = await supabase
    .from('player_game_logs')
    .select('*, game:games!game_id(sport, external_id, start_time), player:players!player_id(sport, external_id, name)')
    .is('metadata', null)
    .limit(20);
    
  if (!nullMetadataStats || nullMetadataStats.length === 0) {
    console.log(chalk.red('No stats with NULL metadata found!'));
    return;
  }
  
  console.log(chalk.green(`Found ${nullMetadataStats.length} sample stats with NULL metadata\n`));
  
  // Analyze by sport
  const sportCounts = new Map<string, number>();
  const samplesBySport = new Map<string, any[]>();
  
  for (const stat of nullMetadataStats) {
    const sport = stat.game?.sport || stat.player?.sport || 'UNKNOWN';
    sportCounts.set(sport, (sportCounts.get(sport) || 0) + 1);
    
    if (!samplesBySport.has(sport)) {
      samplesBySport.set(sport, []);
    }
    if (samplesBySport.get(sport)!.length < 3) {
      samplesBySport.get(sport)!.push(stat);
    }
  }
  
  console.log(chalk.bold.yellow('📊 NULL METADATA STATS BY SPORT:'));
  for (const [sport, count] of sportCounts) {
    console.log(chalk.green(`  ${sport}: ${count} stats`));
  }
  
  // Show samples for each sport
  console.log(chalk.bold.yellow('\n📋 SAMPLE STATS BY SPORT:'));
  
  for (const [sport, samples] of samplesBySport) {
    console.log(chalk.cyan(`\n${sport} Samples:`));
    
    for (const stat of samples.slice(0, 2)) {
      console.log(chalk.gray(`\n  Stat ID: ${stat.id}`));
      console.log(chalk.gray(`  Game: ${stat.game?.external_id} (${new Date(stat.game?.start_time).toLocaleDateString()})`));
      console.log(chalk.gray(`  Player: ${stat.player?.name} (${stat.player?.external_id})`));
      console.log(chalk.gray(`  Stats structure:`));
      
      // Show the stats object structure
      if (stat.stats) {
        const statKeys = Object.keys(stat.stats).slice(0, 10);
        console.log(chalk.gray(`    Keys: ${statKeys.join(', ')}${Object.keys(stat.stats).length > 10 ? '...' : ''}`));
        
        // Show a few stat values
        for (const key of statKeys.slice(0, 5)) {
          console.log(chalk.gray(`    ${key}: ${stat.stats[key]}`));
        }
      }
    }
  }
  
  // Check date ranges for NULL metadata stats
  console.log(chalk.bold.yellow('\n📅 DATE RANGE ANALYSIS:'));
  
  const { data: dateRange } = await supabase
    .from('player_game_logs')
    .select('game_date')
    .is('metadata', null)
    .order('game_date', { ascending: true })
    .limit(1);
    
  const { data: dateRangeEnd } = await supabase
    .from('player_game_logs')
    .select('game_date')
    .is('metadata', null)
    .order('game_date', { ascending: false })
    .limit(1);
    
  if (dateRange && dateRangeEnd) {
    console.log(chalk.green(`  Earliest: ${dateRange[0].game_date}`));
    console.log(chalk.green(`  Latest: ${dateRangeEnd[0].game_date}`));
  }
  
  // Count by year
  console.log(chalk.bold.yellow('\n📊 COUNT BY YEAR:'));
  
  const yearCounts = new Map<number, number>();
  let offset = 0;
  
  while (offset < 100000) { // Sample first 100K for speed
    const { data } = await supabase
      .from('player_game_logs')
      .select('game_date')
      .is('metadata', null)
      .range(offset, offset + 999);
      
    if (!data || data.length === 0) break;
    
    for (const stat of data) {
      const year = new Date(stat.game_date).getFullYear();
      yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
    }
    
    offset += data.length;
    if (data.length < 1000) break;
  }
  
  for (const [year, count] of Array.from(yearCounts).sort()) {
    console.log(chalk.green(`  ${year}: ${count.toLocaleString()} stats (sampled)`));
  }
  
  // Check if these are NBA stats by looking at game IDs
  console.log(chalk.bold.yellow('\n🏀 CHECKING IF THESE ARE NBA STATS:'));
  
  const { data: unknownGameSample } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .is('metadata', null)
    .limit(100);
    
  if (unknownGameSample) {
    const gameIds = unknownGameSample.map(s => s.game_id);
    
    const { data: games } = await supabase
      .from('games')
      .select('id, sport, external_id')
      .in('id', gameIds);
      
    if (games) {
      const gameSports = new Map<string, number>();
      games.forEach(g => {
        gameSports.set(g.sport, (gameSports.get(g.sport) || 0) + 1);
      });
      
      console.log(chalk.green('  Sports distribution in sample:'));
      for (const [sport, count] of gameSports) {
        console.log(chalk.gray(`    ${sport}: ${count} games`));
      }
    }
  }
  
  // Check stat structure to identify sport
  console.log(chalk.bold.yellow('\n🔍 STAT STRUCTURE ANALYSIS:'));
  
  const { data: statStructures } = await supabase
    .from('player_game_logs')
    .select('stats')
    .is('metadata', null)
    .limit(50);
    
  if (statStructures) {
    const keyPatterns = new Map<string, number>();
    
    for (const { stats } of statStructures) {
      if (stats) {
        const keys = Object.keys(stats).sort().join(',');
        keyPatterns.set(keys, (keyPatterns.get(keys) || 0) + 1);
      }
    }
    
    console.log(chalk.green(`  Found ${keyPatterns.size} different stat structures`));
    
    // Show most common patterns
    const sortedPatterns = Array.from(keyPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
      
    for (const [pattern, count] of sortedPatterns) {
      const keys = pattern.split(',');
      console.log(chalk.gray(`\n  Pattern (${count} occurrences):`));
      console.log(chalk.gray(`    ${keys.slice(0, 10).join(', ')}${keys.length > 10 ? '...' : ''}`));
      
      // Try to identify sport based on keys
      if (keys.includes('fg') && keys.includes('3pt') && keys.includes('ft')) {
        console.log(chalk.yellow(`    → Likely NBA (has fg, 3pt, ft)`));
      } else if (keys.includes('goals') && keys.includes('assists')) {
        console.log(chalk.yellow(`    → Likely NHL (has goals, assists)`));
      } else if (keys.includes('at_bats') || keys.includes('hits')) {
        console.log(chalk.yellow(`    → Likely MLB (has at_bats/hits)`));
      }
    }
  }
}

investigateUnknownStats()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });