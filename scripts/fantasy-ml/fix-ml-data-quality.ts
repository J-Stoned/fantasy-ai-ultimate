#!/usr/bin/env tsx
/**
 * 🔧 Fix ML Data Quality Issues
 * Clean up multi-sport contamination and improve predictions
 */

import chalk from 'chalk';
import { pgPool } from './config/database';

async function fixMLDataQuality() {
  console.log(chalk.cyan.bold('\n🔧 Fixing ML Data Quality Issues...\n'));
  
  try {
    // 1. Identify true baseball players
    console.log(chalk.cyan('⚾ Identifying true baseball players...'));
    
    // Check position patterns
    const positionPatterns = await pgPool.query(`
      SELECT 
        position,
        COUNT(*) as count
      FROM players
      WHERE sport = 'NCAA_BASEBALL'
      AND position IS NOT NULL
      GROUP BY position
      ORDER BY count DESC
      LIMIT 20
    `);
    
    console.log('Position patterns found:');
    positionPatterns.rows.forEach(p => {
      console.log(`  ${p.position}: ${p.count} players`);
    });
    
    // 2. Create cleaned view for baseball-only players
    console.log(chalk.cyan('\n🏗️ Creating cleaned baseball data view...'));
    
    await pgPool.query(`
      CREATE OR REPLACE VIEW v_baseball_players AS
      SELECT 
        p.id,
        p.name,
        p.sport,
        -- Extract position from JSON array if needed
        CASE 
          WHEN position LIKE '{%}' THEN 
            TRIM(BOTH '{}' FROM position)
          ELSE position
        END as clean_position,
        p.team,
        -- Identify pitchers by name pattern or position
        CASE 
          WHEN p.name LIKE '%- P %' THEN true
          WHEN position LIKE '%P%' THEN true
          ELSE false
        END as is_pitcher
      FROM players p
      WHERE (p.sport = 'NCAA_BASEBALL' OR p.sport = 'MiLB' OR p.sport LIKE '%BASEBALL%')
      -- Filter out obvious non-baseball positions
      AND (position IS NULL 
           OR (position NOT LIKE '%PG%'  -- Basketball point guard
               AND position NOT LIKE '%WR%'  -- Football wide receiver
               AND position NOT LIKE '%QB%'  -- Football quarterback
               AND position NOT LIKE '%SG%'  -- Basketball shooting guard
               AND position NOT LIKE '%SF%'  -- Basketball small forward
               AND position NOT LIKE '%PF%'))  -- Basketball power forward
    `);
    
    console.log(chalk.green('✅ Baseball players view created'));
    
    // 3. Create cleaned stats view
    console.log(chalk.cyan('\n📊 Creating cleaned stats view...'));
    
    await pgPool.query(`
      CREATE OR REPLACE VIEW v_baseball_stats AS
      SELECT 
        bp.id as player_id,
        bp.name,
        bp.clean_position,
        bp.is_pitcher,
        ps.stat_type,
        ps.fantasy_points,
        ps.stat_value,
        ps.created_at,
        -- Calculate position-specific averages
        AVG(ps.fantasy_points) OVER (
          PARTITION BY bp.is_pitcher, ps.player_id 
          ORDER BY ps.created_at 
          ROWS BETWEEN 10 PRECEDING AND CURRENT ROW
        ) as rolling_avg,
        -- Separate batting and pitching stats
        CASE 
          WHEN ps.stat_type = 'pitching' THEN ps.fantasy_points
          ELSE NULL
        END as pitching_points,
        CASE 
          WHEN ps.stat_type = 'batting' THEN ps.fantasy_points
          ELSE NULL
        END as batting_points
      FROM v_baseball_players bp
      JOIN player_stats ps ON bp.id = ps.player_id
      WHERE ps.fantasy_points IS NOT NULL
      AND ps.fantasy_points >= 0  -- Remove negative points
      AND ps.fantasy_points <= 100  -- Remove outliers
    `);
    
    console.log(chalk.green('✅ Baseball stats view created'));
    
    // 4. Analyze cleaned data
    console.log(chalk.cyan('\n📈 Analyzing cleaned data...'));
    
    const summary = await pgPool.query(`
      SELECT 
        COUNT(DISTINCT player_id) as total_players,
        COUNT(DISTINCT CASE WHEN is_pitcher THEN player_id END) as pitchers,
        COUNT(DISTINCT CASE WHEN NOT is_pitcher THEN player_id END) as batters,
        COUNT(*) as total_stats,
        AVG(fantasy_points) as avg_points,
        AVG(pitching_points) as avg_pitching_points,
        AVG(batting_points) as avg_batting_points
      FROM v_baseball_stats
    `);
    
    const s = summary.rows[0];
    console.log(chalk.yellow('\nCleaned Data Summary:'));
    console.log(`  Total Players: ${parseInt(s.total_players).toLocaleString()}`);
    console.log(`  Pitchers: ${parseInt(s.pitchers).toLocaleString()}`);
    console.log(`  Batters: ${parseInt(s.batters).toLocaleString()}`);
    console.log(`  Total Stats: ${parseInt(s.total_stats).toLocaleString()}`);
    console.log(`  Avg Points: ${parseFloat(s.avg_points).toFixed(1)}`);
    console.log(`  Avg Pitching: ${parseFloat(s.avg_pitching_points || 0).toFixed(1)}`);
    console.log(`  Avg Batting: ${parseFloat(s.avg_batting_points || 0).toFixed(1)}`);
    
    // 5. Show sample of cleaned data
    console.log(chalk.cyan('\n👥 Sample Cleaned Players:'));
    
    const samples = await pgPool.query(`
      SELECT 
        name,
        clean_position,
        is_pitcher,
        COUNT(*) as games,
        AVG(fantasy_points) as avg_points,
        MAX(fantasy_points) as best_game
      FROM v_baseball_stats
      GROUP BY player_id, name, clean_position, is_pitcher
      HAVING COUNT(*) > 10
      ORDER BY AVG(fantasy_points) DESC
      LIMIT 10
    `);
    
    samples.rows.forEach((p, i) => {
      console.log(`${i+1}. ${p.name} (${p.clean_position || 'Unknown'})${p.is_pitcher ? ' [P]' : ''}: ${p.games} games, ${parseFloat(p.avg_points).toFixed(1)} avg, ${parseFloat(p.best_game).toFixed(1)} best`);
    });
    
    console.log(chalk.green.bold('\n✅ Data quality fixes complete!\n'));
    console.log(chalk.yellow('Next: Run fantasy:train-clean to train on cleaned data'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error);
  } finally {
    await pgPool.end();
  }
}

fixMLDataQuality();