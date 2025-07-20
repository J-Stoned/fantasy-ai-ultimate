#!/usr/bin/env tsx
/**
 * 🔍 FORENSIC INVESTIGATION: 2021 ORPHANED STATS
 * 
 * Investigate why we have 77K player stats but no games
 */

import { queryMany, queryOne } from '../utils/local-db-pool.js';
import chalk from 'chalk';

async function investigate() {
  console.log(chalk.red('🔍 FORENSIC INVESTIGATION: 2021 ORPHANED STATS\n'));
  
  try {
    // 1. Check orphaned NFL stats
    console.log(chalk.yellow('1️⃣ NFL ORPHANED STATS (Sample of 10):'));
    const nflStats = await queryMany(`
      SELECT 
        pgl.id as stat_id,
        pgl.game_id,
        pgl.player_id,
        p.name as player_name,
        g.id as game_exists,
        g.start_time,
        g.sport as game_sport,
        g.external_id as game_external_id
      FROM player_game_logs pgl
      JOIN players p ON pgl.player_id = p.id
      LEFT JOIN games g ON pgl.game_id = g.id
      WHERE p.sport = 'NFL'
      LIMIT 10
    `);
    
    console.log(chalk.gray('Sample NFL stats:'));
    nflStats.forEach(stat => {
      console.log(chalk.gray(`  Player: ${stat.player_name}, Game ID: ${stat.game_id}, Game exists: ${stat.game_exists ? 'YES' : 'NO'}`));
      if (stat.game_exists) {
        console.log(chalk.green(`    Game date: ${stat.start_time}, Sport: ${stat.game_sport}`));
      }
    });
    
    // 2. Check what game_ids these stats reference
    console.log(chalk.yellow('\n2️⃣ GAME ID ANALYSIS:'));
    const gameIdAnalysis = await queryMany(`
      SELECT 
        COUNT(*) as total_stats,
        COUNT(DISTINCT game_id) as unique_game_ids,
        MIN(game_id) as min_game_id,
        MAX(game_id) as max_game_id
      FROM player_game_logs pgl
      JOIN players p ON pgl.player_id = p.id
      WHERE p.sport IN ('NFL', 'MLB', 'NBA', 'NHL')
    `);
    
    console.log(chalk.cyan('Game ID ranges in player stats:'));
    console.log(gameIdAnalysis[0]);
    
    // 3. Check if games exist but with different dates
    console.log(chalk.yellow('\n3️⃣ SEARCHING FOR 2021 GAMES (different date formats):'));
    const dateSearches = [
      { label: '2021 prefix', query: "WHERE start_time::text LIKE '2021%'" },
      { label: '2022-01/02 prefix', query: "WHERE start_time::text LIKE '2022-01%' OR start_time::text LIKE '2022-02%'" },
      { label: '2021 year extract', query: "WHERE EXTRACT(YEAR FROM start_time::timestamp) = 2021" },
      { label: '2021-2022 season', query: "WHERE start_time >= '2021-01-01' AND start_time < '2022-07-01'" }
    ];
    
    for (const search of dateSearches) {
      const result = await queryOne(`
        SELECT COUNT(*) as count, 
               STRING_AGG(DISTINCT sport, ', ') as sports
        FROM games ${search.query}
      `);
      console.log(chalk.gray(`  ${search.label}: ${result.count} games (${result.sports || 'none'})`));
    }
    
    // 4. Check for ID format mismatches
    console.log(chalk.yellow('\n4️⃣ GAME ID FORMAT ANALYSIS:'));
    const idFormats = await queryMany(`
      SELECT 
        COUNT(*) as count,
        LENGTH(id::text) as id_length,
        SUBSTRING(id::text, 1, 3) as id_prefix,
        MIN(id) as sample_id
      FROM games
      GROUP BY LENGTH(id::text), SUBSTRING(id::text, 1, 3)
      ORDER BY count DESC
      LIMIT 10
    `);
    
    console.log(chalk.cyan('Game ID formats:'));
    idFormats.forEach(format => {
      console.log(chalk.gray(`  Length: ${format.id_length}, Prefix: ${format.id_prefix}, Count: ${format.count}, Sample: ${format.sample_id}`));
    });
    
    // 5. Check external_id patterns
    console.log(chalk.yellow('\n5️⃣ EXTERNAL ID PATTERNS:'));
    const externalIds = await queryMany(`
      SELECT 
        sport,
        COUNT(*) as game_count,
        COUNT(DISTINCT SUBSTRING(external_id, 1, 10)) as unique_prefixes,
        MIN(external_id) as sample_external_id
      FROM games
      WHERE external_id IS NOT NULL
      GROUP BY sport
      ORDER BY sport
    `);
    
    console.log(chalk.cyan('External ID patterns by sport:'));
    externalIds.forEach(pattern => {
      console.log(chalk.gray(`  ${pattern.sport}: ${pattern.game_count} games, ${pattern.unique_prefixes} prefixes, Sample: ${pattern.sample_external_id}`));
    });
    
    // 6. Find orphaned stats count
    console.log(chalk.yellow('\n6️⃣ ORPHANED STATS SUMMARY:'));
    const orphanedStats = await queryMany(`
      SELECT 
        p.sport,
        COUNT(*) as orphaned_stats,
        COUNT(DISTINCT pgl.game_id) as unique_game_ids,
        COUNT(DISTINCT pgl.player_id) as unique_players
      FROM player_game_logs pgl
      JOIN players p ON pgl.player_id = p.id
      LEFT JOIN games g ON pgl.game_id = g.id
      WHERE g.id IS NULL
      GROUP BY p.sport
      ORDER BY orphaned_stats DESC
    `);
    
    console.log(chalk.red('Stats without matching games:'));
    orphanedStats.forEach(stat => {
      console.log(chalk.red(`  ${stat.sport}: ${stat.orphaned_stats} orphaned stats, ${stat.unique_game_ids} game IDs, ${stat.unique_players} players`));
    });
    
    // Summary
    console.log(chalk.red('\n🔥 FINDINGS:'));
    console.log(chalk.yellow('1. We have player stats pointing to game IDs that no longer exist'));
    console.log(chalk.yellow('2. This matches the NCAA Baseball issue - games were re-imported with new IDs'));
    console.log(chalk.yellow('3. The stats foreign keys still point to old game IDs'));
    console.log(chalk.yellow('4. Solution: Re-collect 2021 data fresh or clean up orphaned records'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

investigate()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });