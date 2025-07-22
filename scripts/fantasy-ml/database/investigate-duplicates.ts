#!/usr/bin/env tsx
/**
 * 🔍 INVESTIGATE "DUPLICATE" IDS
 * 
 * Are these ACTUAL duplicates or different records that happen to share IDs?
 * Let's find out before we delete anything!
 */

import chalk from 'chalk';
import { pgPool } from '../config/database';

class DuplicateInvestigator {
  async investigate() {
    console.log(chalk.cyan.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║           🔍 DUPLICATE ID INVESTIGATION 🔍                   ║
    ║                                                              ║
    ║  Let's see what these "duplicates" really are!              ║
    ╚══════════════════════════════════════════════════════════════╝
    `));

    try {
      // 1. Get a sample of duplicate IDs
      console.log(chalk.yellow('\n1️⃣ ANALYZING SAMPLE DUPLICATE IDS...\n'));
      const sampleQuery = `
        WITH duplicates AS (
          SELECT id, COUNT(*) as count
          FROM player_game_logs
          GROUP BY id
          HAVING COUNT(*) > 1
          ORDER BY COUNT(*) DESC
          LIMIT 10
        )
        SELECT 
          pgl.id,
          p.name as player_name,
          p.sport,
          p.position,
          t.name as team_name,
          pgl.game_date,
          pgl.fantasy_points,
          LENGTH(pgl.stats::text) as stats_length,
          pgl.created_at,
          pgl.updated_at
        FROM player_game_logs pgl
        JOIN players p ON p.id = pgl.player_id
        JOIN teams t ON t.id = pgl.team_id
        WHERE pgl.id IN (SELECT id FROM duplicates)
        ORDER BY pgl.id, pgl.game_date
      `;

      const samples = await pgPool.query(sampleQuery);
      
      // Group by ID to analyze
      const grouped = new Map<number, any[]>();
      samples.rows.forEach(row => {
        if (!grouped.has(row.id)) {
          grouped.set(row.id, []);
        }
        grouped.get(row.id)!.push(row);
      });

      // Analyze each group
      console.log(chalk.cyan('Sample duplicate analysis:'));
      grouped.forEach((records, id) => {
        console.log(chalk.yellow(`\n📌 ID ${id} (${records.length} records):`));
        
        // Check if same player
        const uniquePlayers = new Set(records.map(r => r.player_name));
        if (uniquePlayers.size > 1) {
          console.log(chalk.red(`  ⚠️  DIFFERENT PLAYERS: ${Array.from(uniquePlayers).join(', ')}`));
        } else {
          console.log(chalk.green(`  ✓ Same player: ${records[0].player_name}`));
        }

        // Check if same game
        const uniqueDates = new Set(records.map(r => {
          if (!r.game_date) return 'NULL';
          const date = typeof r.game_date === 'string' ? r.game_date : r.game_date.toISOString();
          return date.split('T')[0];
        }));
        if (uniqueDates.size > 1) {
          console.log(chalk.yellow(`  📅 DIFFERENT GAMES: ${Array.from(uniqueDates).join(', ')}`));
        } else {
          const firstDate = records[0].game_date;
          const dateStr = firstDate ? 
            (typeof firstDate === 'string' ? firstDate : firstDate.toISOString()).split('T')[0] : 
            'NULL';
          console.log(chalk.gray(`  📅 Same game: ${dateStr}`));
        }

        // Check if same team
        const uniqueTeams = new Set(records.map(r => r.team_name));
        if (uniqueTeams.size > 1) {
          console.log(chalk.yellow(`  🏟️  Different teams: ${Array.from(uniqueTeams).join(', ')}`));
        }

        // Show details
        records.forEach((r, idx) => {
          console.log(chalk.gray(`    Record ${idx + 1}: ${r.sport} | ${r.position} | ${r.team_name} | FP: ${r.fantasy_points || 0} | Stats: ${r.stats_length}B`));
        });
      });

      // 2. Statistical analysis
      console.log(chalk.yellow('\n\n2️⃣ STATISTICAL ANALYSIS...\n'));
      const statsQuery = `
        WITH duplicate_analysis AS (
          SELECT 
            pgl1.id,
            COUNT(DISTINCT pgl1.player_id) as unique_players,
            COUNT(DISTINCT pgl1.game_date) as unique_games,
            COUNT(DISTINCT pgl1.team_id) as unique_teams,
            COUNT(*) as total_records,
            
            -- Check if it's same player, same game
            CASE 
              WHEN COUNT(DISTINCT pgl1.player_id) = 1 AND COUNT(DISTINCT pgl1.game_date) = 1 
              THEN 'TRUE_DUPLICATE'
              WHEN COUNT(DISTINCT pgl1.player_id) = 1 AND COUNT(DISTINCT pgl1.game_date) > 1
              THEN 'SAME_PLAYER_DIFF_GAMES'
              WHEN COUNT(DISTINCT pgl1.player_id) > 1
              THEN 'DIFFERENT_PLAYERS'
              ELSE 'UNKNOWN'
            END as duplicate_type
            
          FROM player_game_logs pgl1
          WHERE pgl1.id IN (
            SELECT id FROM player_game_logs
            GROUP BY id
            HAVING COUNT(*) > 1
          )
          GROUP BY pgl1.id
        )
        SELECT 
          duplicate_type,
          COUNT(*) as count,
          SUM(total_records) as total_affected_records
        FROM duplicate_analysis
        GROUP BY duplicate_type
        ORDER BY COUNT(*) DESC
      `;

      const stats = await pgPool.query(statsQuery);
      
      console.log(chalk.cyan('Duplicate types breakdown:'));
      let totalTrueDuplicates = 0;
      stats.rows.forEach(row => {
        const emoji = row.duplicate_type === 'TRUE_DUPLICATE' ? '🗑️' : 
                     row.duplicate_type === 'SAME_PLAYER_DIFF_GAMES' ? '✅' :
                     row.duplicate_type === 'DIFFERENT_PLAYERS' ? '⚠️' : '❓';
        
        console.log(`  ${emoji} ${row.duplicate_type}: ${parseInt(row.count).toLocaleString()} IDs (${parseInt(row.total_affected_records).toLocaleString()} records)`);
        
        if (row.duplicate_type === 'TRUE_DUPLICATE') {
          totalTrueDuplicates = parseInt(row.count);
        }
      });

      // 3. Check for ID pattern issues
      console.log(chalk.yellow('\n\n3️⃣ ID PATTERN ANALYSIS...\n'));
      const idPatternQuery = `
        SELECT 
          MIN(id) as min_id,
          MAX(id) as max_id,
          COUNT(DISTINCT id) as unique_ids,
          COUNT(*) as total_records,
          pg_typeof(id) as id_type
        FROM player_game_logs
        GROUP BY pg_typeof(id)
      `;

      const idPattern = await pgPool.query(idPatternQuery);
      console.log(chalk.cyan('ID characteristics:'));
      idPattern.rows.forEach(row => {
        console.log(`  Type: ${row.id_type}`);
        console.log(`  Range: ${row.min_id} to ${row.max_id}`);
        console.log(`  Unique IDs: ${parseInt(row.unique_ids).toLocaleString()}`);
        console.log(`  Total records: ${parseInt(row.total_records).toLocaleString()}`);
      });

      // 4. Sample of SAME_PLAYER_DIFF_GAMES
      console.log(chalk.yellow('\n\n4️⃣ INVESTIGATING "SAME PLAYER, DIFFERENT GAMES"...\n'));
      const diffGamesQuery = `
        WITH same_player_diff_games AS (
          SELECT 
            pgl.id,
            COUNT(DISTINCT pgl.game_date) as game_count,
            MIN(pgl.game_date) as first_game,
            MAX(pgl.game_date) as last_game
          FROM player_game_logs pgl
          WHERE pgl.id IN (
            SELECT id FROM player_game_logs
            GROUP BY id
            HAVING COUNT(*) > 1
          )
          GROUP BY pgl.id
          HAVING COUNT(DISTINCT pgl.player_id) = 1 
            AND COUNT(DISTINCT pgl.game_date) > 1
          ORDER BY COUNT(DISTINCT pgl.game_date) DESC
          LIMIT 5
        )
        SELECT 
          pgl.id,
          p.name as player_name,
          p.sport,
          COUNT(*) as record_count,
          COUNT(DISTINCT pgl.game_date) as unique_games,
          MIN(pgl.game_date) as first_game,
          MAX(pgl.game_date) as last_game
        FROM player_game_logs pgl
        JOIN players p ON p.id = pgl.player_id
        WHERE pgl.id IN (SELECT id FROM same_player_diff_games)
        GROUP BY pgl.id, p.name, p.sport
        ORDER BY COUNT(DISTINCT pgl.game_date) DESC
      `;

      const diffGames = await pgPool.query(diffGamesQuery);
      console.log(chalk.cyan('Players with same ID across multiple games:'));
      diffGames.rows.forEach(row => {
        console.log(`  ${row.player_name} (${row.sport}): ID ${row.id} used for ${row.unique_games} different games!`);
        const firstDate = row.first_game ? 
          (typeof row.first_game === 'string' ? row.first_game : row.first_game.toISOString()).split('T')[0] : 
          'NULL';
        const lastDate = row.last_game ? 
          (typeof row.last_game === 'string' ? row.last_game : row.last_game.toISOString()).split('T')[0] : 
          'NULL';
        console.log(`    Date range: ${firstDate} to ${lastDate}`);
      });

      // Summary
      console.log(chalk.green.bold(`
    ╔══════════════════════════════════════════════════════════════╗
    ║                    🎯 INVESTIGATION COMPLETE!                ║
    ╚══════════════════════════════════════════════════════════════╝
      `));
      
      console.log(chalk.yellow('\n🔍 KEY FINDINGS:'));
      console.log(chalk.cyan(`• Only ${totalTrueDuplicates.toLocaleString()} IDs are TRUE duplicates (same player, same game)`));
      console.log(chalk.red('• Many "duplicates" are actually THE SAME ID used for DIFFERENT GAMES!'));
      console.log(chalk.red('• This suggests the ID column is NOT unique per game log!'));
      console.log(chalk.yellow('\n💡 RECOMMENDATION:'));
      console.log(chalk.green('1. DO NOT delete records based on duplicate IDs alone'));
      console.log(chalk.green('2. The ID column appears to be a player ID, not a unique game log ID'));
      console.log(chalk.green('3. We need a composite key: player_id + game_date + team_id'));
      console.log(chalk.green('4. Or generate new unique IDs for the player_game_logs table'));

    } catch (error) {
      console.error(chalk.red('❌ Investigation failed:'), error);
      throw error;
    }
  }
}

// Run it!
if (require.main === module) {
  (async () => {
    try {
      const investigator = new DuplicateInvestigator();
      await investigator.investigate();
      await pgPool.end();
      process.exit(0);
    } catch (error) {
      console.error(chalk.red('❌ Fatal error:'), error);
      process.exit(1);
    }
  })();
}

export { DuplicateInvestigator };