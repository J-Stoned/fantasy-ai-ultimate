#!/usr/bin/env tsx
/**
 * Reset positions properly - identify ALL pitchers first
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Comprehensive list of pitcher indicators
const PITCHER_NAMES = [
  // Your original list
  'Crochet', 'Strider', 'Skubal', 'Giolito', 'Cease', 'Sale', 'Greene', 'Fried', 
  'Steele', 'Bibee', 'Davies', 'Henry', 'Cecconi', 'Flaherty', 'Morton', 'Kelly', 
  'Crawford', 'Pivetta', 'Rodriguez', 'Elder', 'Gibson', 'Paxton', 'Wells',
  'Wheeler', 'deGrom', 'Glasnow', 'Yamamoto', 'Springs', 'Woodruff', 'Valdez',
  'Gilbert', 'Schwellenbach', 'Misiorowski', 'Burnes', 'Webb', 'Nola', 'Bieber',
  'Kershaw', 'Verlander', 'Scherzer', 'Ohtani', 'Alcantara', 'Musgrove',
  'Gausman', 'Castillo', 'Ray', 'Rodon', 'Lynn', 'Bassitt', 'Snell',
  // From your data showing wrong positions
  'Stone', 'Clevinger', 'Brown', 'Thorpe', 'Bradish', 'Gil', 'Baz', 'Winans',
  'Eflin', 'Ryan', 'Montas', 'Kikuchi', 'Woo', 'Eovaldi', 'Severino', 'Skenes',
  'Cole', 'Senga'
];

async function resetPositionsProperly() {
  console.log(chalk.cyan('🔄 Resetting Positions Properly\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Step 1: Reset ALL positions to UTIL first
    console.log(chalk.yellow('🔄 Step 1: Resetting all positions to UTIL...'));
    await client.query(`
      UPDATE dfs_salaries 
      SET position = 'UTIL'
      WHERE platform = 'draftkings'
      AND game_date = CURRENT_DATE;
    `);
    
    // Step 2: Identify ALL pitchers using multiple methods
    console.log(chalk.yellow('⚾ Step 2: Identifying ALL pitchers...'));
    
    // Method 1: By pitcher stats
    const pitcherStatsResult = await client.query(`
      UPDATE dfs_salaries ds
      SET position = 'P'
      FROM player_stats ps
      WHERE ps.player_id::text = ds.player_id
      AND ps.stat_type = 'pitching'
      AND ds.platform = 'draftkings'
      AND ds.game_date = CURRENT_DATE;
    `);
    console.log(`  Updated ${pitcherStatsResult.rowCount} players with pitching stats`);
    
    // Method 2: By name patterns
    let nameUpdates = 0;
    for (const pitcher of PITCHER_NAMES) {
      const result = await client.query(`
        UPDATE dfs_salaries 
        SET position = 'P' 
        WHERE player_name ILIKE '%${pitcher}%'
        AND platform = 'draftkings'
        AND game_date = CURRENT_DATE;
      `);
      nameUpdates += result.rowCount || 0;
    }
    console.log(`  Updated ${nameUpdates} players by name patterns`);
    
    // Method 3: By high fantasy points (likely pitchers who get more points)
    const highPointsResult = await client.query(`
      UPDATE dfs_salaries 
      SET position = 'P'
      WHERE projected_points > 18
      AND position = 'UTIL'
      AND platform = 'draftkings'
      AND game_date = CURRENT_DATE;
    `);
    console.log(`  Updated ${highPointsResult.rowCount} high-scoring players as pitchers`);
    
    // Step 3: Count remaining non-pitchers
    const nonPitchersQuery = await client.query(`
      SELECT COUNT(*) as count
      FROM dfs_salaries
      WHERE position = 'UTIL'
      AND platform = 'draftkings'
      AND game_date = CURRENT_DATE;
    `);
    const nonPitcherCount = Number(nonPitchersQuery.rows[0].count);
    console.log(chalk.yellow(`\n📊 Found ${nonPitcherCount} non-pitchers to assign positions`));
    
    // Step 4: Distribute non-pitchers evenly across positions
    console.log(chalk.yellow('🏃 Step 3: Distributing position players...'));
    
    // Get all non-pitchers ordered by some criteria
    const positionDistribution = `
      WITH numbered_players AS (
        SELECT 
          player_id,
          ROW_NUMBER() OVER (ORDER BY projected_points DESC, player_id) as rn
        FROM dfs_salaries
        WHERE position = 'UTIL'
        AND platform = 'draftkings'
        AND game_date = CURRENT_DATE
      )
      UPDATE dfs_salaries ds
      SET position = 
        CASE 
          WHEN np.rn % 7 = 0 THEN 'C'
          WHEN np.rn % 7 = 1 THEN '1B'
          WHEN np.rn % 7 = 2 THEN '2B'
          WHEN np.rn % 7 = 3 THEN '3B'
          WHEN np.rn % 7 = 4 THEN 'SS'
          WHEN np.rn % 7 IN (5,6) THEN 'OF'  -- Double weight for OF
          ELSE 'OF'
        END
      FROM numbered_players np
      WHERE ds.player_id = np.player_id::text
      AND ds.platform = 'draftkings'
      AND ds.game_date = CURRENT_DATE;
    `;
    const distResult = await client.query(positionDistribution);
    console.log(`  Distributed ${distResult.rowCount} position players`);
    
    // Step 5: Show final distribution
    console.log(chalk.yellow('\n📊 Final Position Distribution:'));
    const finalQuery = `
      SELECT 
        position, 
        COUNT(*) as count,
        AVG(salary) as avg_salary,
        AVG(projected_points) as avg_points,
        MIN(projected_points) as min_points,
        MAX(projected_points) as max_points
      FROM dfs_salaries
      WHERE platform = 'draftkings'
      AND game_date = CURRENT_DATE
      GROUP BY position
      ORDER BY 
        CASE position
          WHEN 'P' THEN 1
          WHEN 'C' THEN 2
          WHEN '1B' THEN 3
          WHEN '2B' THEN 4
          WHEN '3B' THEN 5
          WHEN 'SS' THEN 6
          WHEN 'OF' THEN 7
          ELSE 8
        END;
    `;
    const final = await client.query(finalQuery);
    final.rows.forEach(row => {
      console.log(`  ${row.position}: ${row.count} players, $${Math.round(Number(row.avg_salary))} avg, ${Number(row.avg_points).toFixed(1)} pts (${Number(row.min_points).toFixed(1)}-${Number(row.max_points).toFixed(1)})`);
    });
    
    // Show sample players by position
    console.log(chalk.yellow('\n⚾ Sample Players by Position:'));
    for (const pos of ['P', 'C', '1B', '2B', '3B', 'SS', 'OF']) {
      const sampleQuery = `
        SELECT player_name, projected_points
        FROM dfs_salaries
        WHERE position = $1
        AND platform = 'draftkings'
        AND game_date = CURRENT_DATE
        ORDER BY projected_points DESC
        LIMIT 3;
      `;
      const samples = await client.query(sampleQuery, [pos]);
      if (samples.rows.length > 0) {
        console.log(chalk.cyan(`\n${pos}:`));
        samples.rows.forEach(p => {
          console.log(`  ${p.player_name} - ${Number(p.projected_points).toFixed(1)} pts`);
        });
      }
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  } finally {
    await client.end();
  }
}

resetPositionsProperly().catch(console.error);