#!/usr/bin/env tsx
/**
 * 🔍 Analyze Player Data Quality
 * Figure out what's actually in the database
 */

import chalk from 'chalk';
import { pgPool } from './config/database';

async function analyzePlayerData() {
  console.log(chalk.cyan.bold('\n🔍 Analyzing Player Data Quality...\n'));
  
  try {
    // 1. Check player name formats
    console.log(chalk.cyan('👤 Sample Player Names:'));
    const players = await pgPool.query(`
      SELECT 
        id,
        name,
        sport,
        position,
        team
      FROM players
      WHERE name IS NOT NULL
      AND name != ''
      ORDER BY RANDOM()
      LIMIT 20
    `);
    
    players.rows.forEach(p => {
      console.log(`  ID: ${p.id}, Name: "${p.name}", Pos: ${p.position || 'null'}, Team: ${p.team || 'null'}`);
    });
    
    // 2. Check fantasy points distribution
    console.log(chalk.cyan('\n📊 Fantasy Points Distribution:'));
    const distribution = await pgPool.query(`
      SELECT 
        CASE 
          WHEN fantasy_points < 0 THEN '< 0 (negative)'
          WHEN fantasy_points = 0 THEN '0 (zero)'
          WHEN fantasy_points < 5 THEN '0-5'
          WHEN fantasy_points < 10 THEN '5-10'
          WHEN fantasy_points < 20 THEN '10-20'
          WHEN fantasy_points < 30 THEN '20-30'
          ELSE '30+'
        END as range,
        COUNT(*) as count,
        AVG(fantasy_points) as avg_points
      FROM player_stats
      WHERE fantasy_points IS NOT NULL
      GROUP BY 1
      ORDER BY 
        CASE 
          WHEN range = '< 0 (negative)' THEN -1
          WHEN range = '0 (zero)' THEN 0
          WHEN range = '0-5' THEN 1
          WHEN range = '5-10' THEN 2
          WHEN range = '10-20' THEN 3
          WHEN range = '20-30' THEN 4
          ELSE 5
        END
    `);
    
    distribution.rows.forEach(d => {
      console.log(`  ${d.range}: ${parseInt(d.count).toLocaleString()} games (avg: ${parseFloat(d.avg_points).toFixed(1)})`);
    });
    
    // 3. Check batting vs pitching stats
    console.log(chalk.cyan('\n⚾ Batting vs Pitching Analysis:'));
    const byType = await pgPool.query(`
      SELECT 
        stat_type,
        COUNT(*) as games,
        AVG(fantasy_points) as avg_points,
        MIN(fantasy_points) as min_points,
        MAX(fantasy_points) as max_points,
        STDDEV(fantasy_points) as std_dev
      FROM player_stats
      WHERE fantasy_points IS NOT NULL
      GROUP BY stat_type
    `);
    
    byType.rows.forEach(t => {
      console.log(chalk.yellow(`\n${t.stat_type}:`));
      console.log(`  Games: ${parseInt(t.games).toLocaleString()}`);
      console.log(`  Avg: ${parseFloat(t.avg_points).toFixed(1)} pts`);
      console.log(`  Range: ${parseFloat(t.min_points).toFixed(1)} to ${parseFloat(t.max_points).toFixed(1)}`);
      console.log(`  Std Dev: ${parseFloat(t.std_dev).toFixed(1)}`);
    });
    
    // 4. Look at top single-game performances
    console.log(chalk.cyan('\n🌟 Top Single-Game Performances:'));
    const topGames = await pgPool.query(`
      SELECT 
        p.name,
        ps.stat_type,
        ps.fantasy_points,
        ps.stat_value,
        DATE(ps.created_at::TIMESTAMP) as game_date
      FROM player_stats ps
      JOIN players p ON ps.player_id = p.id
      WHERE ps.fantasy_points IS NOT NULL
      ORDER BY ps.fantasy_points DESC
      LIMIT 10
    `);
    
    topGames.rows.forEach((g, i) => {
      console.log(`${i+1}. ${g.name} (${g.stat_type}): ${g.fantasy_points} pts on ${g.game_date}`);
      if (g.stat_value) {
        const stats = JSON.parse(g.stat_value);
        console.log(`   Stats: ${JSON.stringify(stats)}`);
      }
    });
    
    // 5. Check for data quality issues
    console.log(chalk.cyan('\n⚠️  Data Quality Check:'));
    
    const nullNames = await pgPool.query(`
      SELECT COUNT(*) as count FROM players WHERE name IS NULL OR name = ''
    `);
    console.log(`  Players with no name: ${nullNames.rows[0].count}`);
    
    const negativePoints = await pgPool.query(`
      SELECT COUNT(*) as count FROM player_stats WHERE fantasy_points < 0
    `);
    console.log(`  Games with negative points: ${negativePoints.rows[0].count}`);
    
    const hugePoints = await pgPool.query(`
      SELECT COUNT(*) as count FROM player_stats WHERE fantasy_points > 50
    `);
    console.log(`  Games with 50+ points: ${hugePoints.rows[0].count}`);
    
    console.log(chalk.green.bold('\n✅ Analysis complete!\n'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  } finally {
    await pgPool.end();
  }
}

analyzePlayerData();