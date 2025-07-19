#!/usr/bin/env tsx
/**
 * 🔍 INVESTIGATE THE 548K ORPHANED STATS
 * 
 * Find out what sport/games these stats belong to
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateOrphanedStats() {
  console.log(chalk.bold.cyan('🔍 INVESTIGATING 548K ORPHANED STATS\n'));

  try {
    // 1. Get all game IDs that have stats
    console.log(chalk.blue('1️⃣ Getting unique game IDs from player_game_logs...'));
    
    const allGameIds = new Set<number>();
    let offset = 0;
    
    while (true) {
      const { data: batch } = await supabase
        .from('player_game_logs')
        .select('game_id')
        .range(offset, offset + 9999);
      
      if (!batch || batch.length === 0) break;
      
      batch.forEach(log => allGameIds.add(log.game_id));
      offset += 10000;
      
      if (offset % 100000 === 0) {
        console.log(chalk.gray(`Processed ${offset} logs...`));
      }
    }
    
    console.log(chalk.green(`Found ${allGameIds.size.toLocaleString()} unique game IDs in stats`));

    // 2. Check which of these game IDs exist in games table
    console.log(chalk.blue('\n2️⃣ Checking which game IDs exist in games table...'));
    
    const gameIdArray = Array.from(allGameIds);
    const existingGameIds = new Set<number>();
    
    // Check in batches
    for (let i = 0; i < gameIdArray.length; i += 1000) {
      const batch = gameIdArray.slice(i, i + 1000);
      const { data: games } = await supabase
        .from('games')
        .select('id')
        .in('id', batch);
      
      games?.forEach(g => existingGameIds.add(g.id));
    }
    
    console.log(chalk.green(`Found ${existingGameIds.size.toLocaleString()} of these games in games table`));
    
    const missingGameIds = gameIdArray.filter(id => !existingGameIds.has(id));
    console.log(chalk.red(`Missing ${missingGameIds.length.toLocaleString()} games!`));

    // 3. Sample the orphaned stats
    console.log(chalk.blue('\n3️⃣ Sampling orphaned stats...'));
    
    if (missingGameIds.length > 0) {
      const sampleIds = missingGameIds.slice(0, 10);
      
      const { data: orphanedStats } = await supabase
        .from('player_game_logs')
        .select('*')
        .in('game_id', sampleIds)
        .limit(20);
      
      console.log(chalk.yellow('\nSample of orphaned stats:'));
      orphanedStats?.slice(0, 5).forEach(stat => {
        console.log(`  Game ID: ${stat.game_id}, Player ID: ${stat.player_id}, Date: ${stat.game_date}`);
        if (stat.stats) {
          const fields = Object.keys(stat.stats).slice(0, 5);
          console.log(`    Stats fields: ${fields.join(', ')}...`);
        }
      });
    }

    // 4. Check player IDs to infer sport
    console.log(chalk.blue('\n4️⃣ Checking player IDs to infer sport...'));
    
    const { data: sampleOrphaned } = await supabase
      .from('player_game_logs')
      .select('player_id')
      .in('game_id', missingGameIds.slice(0, 100))
      .limit(100);
    
    if (sampleOrphaned) {
      const playerIds = [...new Set(sampleOrphaned.map(s => s.player_id))];
      
      const { data: players } = await supabase
        .from('players')
        .select('id, sport, external_id, name')
        .in('id', playerIds)
        .limit(20);
      
      if (players && players.length > 0) {
        console.log(chalk.yellow('\nPlayers associated with orphaned stats:'));
        const sportCounts: Record<string, number> = {};
        
        players.forEach(p => {
          console.log(`  ${p.name} (${p.sport}) - ${p.external_id}`);
          sportCounts[p.sport] = (sportCounts[p.sport] || 0) + 1;
        });
        
        console.log(chalk.cyan('\nSport distribution:'));
        Object.entries(sportCounts).forEach(([sport, count]) => {
          console.log(`  ${sport}: ${count}`);
        });
      }
    }

    // 5. Check date patterns
    console.log(chalk.blue('\n5️⃣ Analyzing date patterns of orphaned stats...'));
    
    const { data: dateSample } = await supabase
      .from('player_game_logs')
      .select('game_date')
      .in('game_id', missingGameIds.slice(0, 1000))
      .order('game_date', { ascending: true });
    
    if (dateSample && dateSample.length > 0) {
      const dates = dateSample.map(d => new Date(d.game_date));
      const minDate = dates[0];
      const maxDate = dates[dates.length - 1];
      
      console.log(`Date range: ${minDate.toISOString().split('T')[0]} to ${maxDate.toISOString().split('T')[0]}`);
      
      // Count by year
      const yearCounts: Record<number, number> = {};
      dates.forEach(d => {
        const year = d.getFullYear();
        yearCounts[year] = (yearCounts[year] || 0) + 1;
      });
      
      console.log(chalk.yellow('\nStats by year:'));
      Object.entries(yearCounts).sort().forEach(([year, count]) => {
        console.log(`  ${year}: ${count}`);
      });
    }

    // 6. Look for MLB/MiLB connection
    console.log(chalk.blue('\n6️⃣ Checking for MLB/MiLB games...'));
    
    const { count: mlbGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'MLB');
    
    const { count: milbGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', 'MILB');
    
    console.log(`MLB games in database: ${mlbGames?.toLocaleString()}`);
    console.log(`MiLB games in database: ${milbGames?.toLocaleString()}`);

    // 7. Direct count by joining with players
    console.log(chalk.blue('\n7️⃣ Counting stats by player sport...'));
    
    // Get a broader sample
    const sportStats: Record<string, number> = {};
    
    // Sample approach - check first 10K stats
    const { data: statSample } = await supabase
      .from('player_game_logs')
      .select('player_id')
      .limit(10000);
    
    if (statSample) {
      const playerIds = [...new Set(statSample.map(s => s.player_id))];
      
      // Get sports for these players
      const { data: players } = await supabase
        .from('players')
        .select('id, sport')
        .in('id', playerIds);
      
      const playerSportMap = new Map(players?.map(p => [p.id, p.sport]) || []);
      
      statSample.forEach(stat => {
        const sport = playerSportMap.get(stat.player_id) || 'UNKNOWN';
        sportStats[sport] = (sportStats[sport] || 0) + 1;
      });
      
      console.log(chalk.yellow('\nStats by player sport (10K sample):'));
      Object.entries(sportStats).sort(([,a], [,b]) => b - a).forEach(([sport, count]) => {
        const percentage = (count / 10000 * 100).toFixed(1);
        console.log(`  ${sport}: ${count} (${percentage}%)`);
      });
    }

    // Summary
    console.log(chalk.bold.cyan('\n\n📊 ORPHANED STATS ANALYSIS\n'));
    console.log(chalk.gray('='.repeat(80)));
    
    console.log(chalk.yellow('KEY FINDINGS:'));
    console.log(`1. Total unique game IDs in stats: ${allGameIds.size.toLocaleString()}`);
    console.log(`2. Game IDs that exist in games table: ${existingGameIds.size.toLocaleString()}`);
    console.log(`3. Missing game IDs: ${missingGameIds.length.toLocaleString()}`);
    console.log(`4. This accounts for the 548K "orphaned" stats`);
    
    console.log(chalk.yellow('\n\nLIKELY CAUSE:'));
    console.log('- Games were deleted but stats remained (no cascade delete)');
    console.log('- MLB/MiLB games might have been removed during cleanup');
    console.log('- NCAA Baseball games might have been deleted');
    console.log('- Historical data cleanup removed games but kept stats');

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

// Run investigation
investigateOrphanedStats().catch(console.error);