#!/usr/bin/env tsx
/**
 * 📊 VERIFY STATS WITH PROPER PAGINATION
 * 
 * Gets accurate counts by handling database pagination limits
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function countUniquePlayerGameCombos(sport: string): Promise<number> {
  console.log(chalk.gray(`  Counting unique player-game combinations...`));
  
  const uniqueCombos = new Set<string>();
  let offset = 0;
  let totalProcessed = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('player_game_logs')
      .select('player_id, game_id')
      .eq('metadata->>sport', sport)
      .range(offset, offset + 999) // 1K limit
      .order('id');
      
    if (error) {
      console.error(chalk.red(`    Error: ${error.message}`));
      break;
    }
    
    if (!data || data.length === 0) break;
    
    data.forEach(record => {
      uniqueCombos.add(`${record.player_id}_${record.game_id}`);
    });
    
    totalProcessed += data.length;
    offset += data.length;
    
    if (totalProcessed % 10000 === 0) {
      console.log(chalk.gray(`    Processed ${totalProcessed.toLocaleString()} records...`));
    }
    
    if (data.length < 1000) break; // Last batch
  }
  
  return uniqueCombos.size;
}

async function countUniqueGames(sport: string): Promise<number> {
  console.log(chalk.gray(`  Counting unique games with stats...`));
  
  const uniqueGames = new Set<number>();
  let offset = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .eq('metadata->>sport', sport)
      .range(offset, offset + 999)
      .order('game_id');
      
    if (error) {
      console.error(chalk.red(`    Error: ${error.message}`));
      break;
    }
    
    if (!data || data.length === 0) break;
    
    data.forEach(record => {
      uniqueGames.add(record.game_id);
    });
    
    offset += data.length;
    if (data.length < 1000) break;
  }
  
  return uniqueGames.size;
}

async function verifyStatsWithPagination() {
  console.log(chalk.bold.cyan('📊 VERIFYING STATS WITH PROPER PAGINATION\n'));
  
  const sports = ['NHL', 'NBA', 'MLB'];
  const results = [];
  
  for (const sport of sports) {
    console.log(chalk.yellow(`${sport} Analysis:`));
    
    // Get total stats count
    const { count: totalStats } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('metadata->>sport', sport);
      
    console.log(chalk.green(`  Total stats: ${totalStats?.toLocaleString()}`));
    
    // Count unique player-game combinations with pagination
    const uniqueCombos = await countUniquePlayerGameCombos(sport);
    console.log(chalk.green(`  Unique player-game combinations: ${uniqueCombos.toLocaleString()}`));
    
    // Count unique games
    const uniqueGames = await countUniqueGames(sport);
    console.log(chalk.green(`  Unique games with stats: ${uniqueGames}`));
    
    // Calculate stats per game
    const statsPerGame = uniqueGames > 0 ? Math.round((totalStats || 0) / uniqueGames) : 0;
    console.log(chalk.cyan(`  Average stats per game: ${statsPerGame}`));
    
    // Check for actual duplicates
    if (totalStats && totalStats > uniqueCombos) {
      const actualDuplicates = totalStats - uniqueCombos;
      const duplicateRatio = (actualDuplicates / totalStats * 100).toFixed(1);
      console.log(chalk.red(`  ⚠️  Actual duplicates: ${actualDuplicates.toLocaleString()} (${duplicateRatio}%)`));
    } else {
      console.log(chalk.green(`  ✅ No duplicates found!`));
    }
    
    // Get expected number of 2021 season games
    let expectedGames = 0;
    if (sport === 'NHL') {
      const { count } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport', 'NHL')
        .gte('start_time', '2021-10-12')
        .lte('start_time', '2022-06-26');
      expectedGames = count || 0;
    } else if (sport === 'NBA') {
      const { count } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport', 'NBA')
        .gte('start_time', '2021-10-19')
        .lte('start_time', '2022-06-16');
      expectedGames = count || 0;
    } else if (sport === 'MLB') {
      const { count } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport', 'MLB')
        .gte('start_time', '2021-04-01')
        .lte('start_time', '2021-11-02');
      expectedGames = count || 0;
    }
    
    const coverage = expectedGames > 0 ? (uniqueGames / expectedGames * 100).toFixed(1) : '0.0';
    console.log(chalk.blue(`  Coverage: ${uniqueGames}/${expectedGames} games (${coverage}%)\n`));
    
    results.push({
      sport,
      totalStats: totalStats || 0,
      uniqueCombos,
      uniqueGames,
      expectedGames,
      statsPerGame,
      actualDuplicates: totalStats && totalStats > uniqueCombos ? totalStats - uniqueCombos : 0,
      coverage
    });
  }
  
  // Summary
  console.log(chalk.bold.green('\n📊 FINAL VERIFICATION SUMMARY'));
  console.log(chalk.bold.green('='.repeat(80)));
  console.log(chalk.cyan('Sport | Total Stats | Unique Combos | Duplicates | Games | Stats/Game | Coverage'));
  console.log(chalk.gray('-'.repeat(80)));
  
  let grandTotalStats = 0;
  let grandTotalDuplicates = 0;
  let grandTotalGames = 0;
  
  for (const r of results) {
    console.log(
      `${r.sport.padEnd(5)} | ${r.totalStats.toLocaleString().padStart(11)} | ${r.uniqueCombos.toLocaleString().padStart(13)} | ${r.actualDuplicates.toLocaleString().padStart(10)} | ${r.uniqueGames.toString().padStart(5)} | ${r.statsPerGame.toString().padStart(10)} | ${r.coverage.padStart(8)}%`
    );
    grandTotalStats += r.totalStats;
    grandTotalDuplicates += r.actualDuplicates;
    grandTotalGames += r.uniqueGames;
  }
  
  console.log(chalk.gray('-'.repeat(80)));
  console.log(chalk.bold.white(
    `TOTAL | ${grandTotalStats.toLocaleString().padStart(11)} | ${' '.padStart(13)} | ${grandTotalDuplicates.toLocaleString().padStart(10)} | ${grandTotalGames.toString().padStart(5)} |`
  ));
  
  if (grandTotalDuplicates > 0) {
    console.log(chalk.yellow(`\n⚠️  Found ${grandTotalDuplicates.toLocaleString()} total duplicate records that could be removed`));
  } else {
    console.log(chalk.green(`\n✅ No duplicate records found! The data is clean.`));
  }
}

verifyStatsWithPagination()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });