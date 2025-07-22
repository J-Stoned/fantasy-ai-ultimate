#!/usr/bin/env tsx
/**
 * Generate DFS data directly from player_stats table
 * This uses the REAL baseball data instead of mismatched game logs
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// MLB position mapping for known players
const POSITION_MAP: Record<string, string> = {
  // Catchers
  'Salvador Perez': 'C', 'J.T. Realmuto': 'C', 'Will Smith': 'C', 
  'Adley Rutschman': 'C', 'Sean Murphy': 'C', 'Willson Contreras': 'C',
  
  // First Base
  'Freddie Freeman': '1B', 'Paul Goldschmidt': '1B', 'Matt Olson': '1B',
  'Pete Alonso': '1B', 'Vladimir Guerrero': '1B', 'Jose Abreu': '1B',
  
  // Second Base
  'Jose Altuve': '2B', 'Marcus Semien': '2B', 'Ozzie Albies': '2B',
  'Gleyber Torres': '2B', 'Jazz Chisholm': '2B', 'Luis Arraez': '2B',
  
  // Third Base
  'Manny Machado': '3B', 'Nolan Arenado': '3B', 'Jose Ramirez': '3B',
  'Austin Riley': '3B', 'Rafael Devers': '3B', 'Matt Chapman': '3B',
  
  // Shortstop
  'Trea Turner': 'SS', 'Francisco Lindor': 'SS', 'Corey Seager': 'SS',
  'Bo Bichette': 'SS', 'Xander Bogaerts': 'SS', 'Carlos Correa': 'SS',
  
  // Outfielders
  'Ronald Acuna': 'OF', 'Mookie Betts': 'OF', 'Aaron Judge': 'OF',
  'Mike Trout': 'OF', 'Juan Soto': 'OF', 'Julio Rodriguez': 'OF',
  'Kyle Tucker': 'OF', 'Corbin Carroll': 'OF', 'Luis Robert': 'OF'
};

async function generateDFSFromBaseballStats() {
  console.log(chalk.cyan('⚾ DFS Generator from Baseball Stats\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Clear existing DFS data
    console.log(chalk.yellow('🧹 Clearing existing DFS data...'));
    await client.query('TRUNCATE TABLE dfs_salaries;');
    
    // Generate pitcher DFS entries from pitching stats
    console.log(chalk.yellow('⚾ Generating pitcher entries...'));
    const pitcherQuery = `
      WITH pitcher_stats AS (
        SELECT 
          ps.player_id,
          COALESCE(
            NULLIF(TRIM(CONCAT(p.firstname, ' ', p.lastname)), ''),
            p.name,
            'Player ' || p.id::text
          ) as player_name,
          'P' as position,
          COALESCE(t.abbreviation, 'FA') as team,
          -- Extract relevant stats from stat_value TEXT JSON
          COALESCE(
            (ps.stat_value::json->>'era')::numeric,
            3.50
          ) as era,
          COALESCE(
            (ps.stat_value::json->>'so')::numeric,  -- strikeouts
            5
          ) as strikeouts,
          COALESCE(
            (ps.stat_value::json->>'h')::numeric,   -- hits allowed
            5
          ) as hits,
          COALESCE(
            (ps.stat_value::json->>'ip')::numeric,  -- innings pitched
            1
          ) as innings
        FROM player_stats ps
        JOIN players p ON ps.player_id = p.id
        LEFT JOIN teams t ON p.team_id = t.id
        WHERE ps.stat_type = 'pitching'
        LIMIT 200  -- Top 200 pitchers
      )
      INSERT INTO dfs_salaries (
        player_id, player_name, position, team, platform,
        salary, projected_points, projected_ownership, game_date
      )
      SELECT 
        player_id::varchar,
        player_name,
        position,
        team,
        'draftkings',
        -- Calculate salary based on performance metrics
        CASE 
          WHEN era = 0 AND strikeouts > 0 THEN 9000  -- Great performance
          WHEN era < 2.00 THEN 8500
          WHEN era < 3.00 THEN 7500
          WHEN era < 4.00 THEN 6000
          ELSE 4500
        END as salary,
        -- Project points based on typical DFS scoring
        GREATEST(
          5.0,
          10.0 + (strikeouts * 2) - (hits * 0.5) + (innings * 3)
        ) as projected_points,
        -- Ownership based on performance
        LEAST(30, GREATEST(5, 35 - era * 5)) as projected_ownership,
        CURRENT_DATE
      FROM pitcher_stats
      WHERE innings > 0  -- Any innings pitched
      ON CONFLICT (player_id, platform, game_date) DO NOTHING;
    `;
    
    const pitcherResult = await client.query(pitcherQuery);
    console.log(chalk.green(`✅ Generated ${pitcherResult.rowCount} pitcher entries`));
    
    // Generate batter DFS entries from batting stats
    console.log(chalk.yellow('\n🏏 Generating batter entries...'));
    const batterQuery = `
      WITH batter_stats AS (
        SELECT 
          ps.player_id,
          COALESCE(
            NULLIF(TRIM(CONCAT(p.firstname, ' ', p.lastname)), ''),
            p.name,
            'Player ' || p.id::text
          ) as player_name,
          COALESCE(t.abbreviation, 'FA') as team,
          -- Extract batting stats from TEXT JSON
          COALESCE(
            (ps.stat_value::json->>'avg')::numeric,
            0.250
          ) as avg,
          COALESCE(
            (ps.stat_value::json->>'hr')::numeric,
            0
          ) as hr,
          COALESCE(
            (ps.stat_value::json->>'rbi')::numeric,
            0
          ) as rbi,
          COALESCE(
            (ps.stat_value::json->>'sb')::numeric,
            0
          ) as sb,
          COALESCE(
            (ps.stat_value::json->>'r')::numeric,
            0
          ) as runs
        FROM player_stats ps
        JOIN players p ON ps.player_id = p.id
        LEFT JOIN teams t ON p.team_id = t.id
        WHERE ps.stat_type = 'batting'
        LIMIT 400  -- Top 400 batters
      )
      INSERT INTO dfs_salaries (
        player_id, player_name, position, team, platform,
        salary, projected_points, projected_ownership, game_date
      )
      SELECT 
        player_id::varchar,
        player_name,
        -- Assign position based on known players or distribute
        CASE 
          WHEN player_name ILIKE ANY(ARRAY['%Perez%', '%Realmuto%', '%Rutschman%', '%Murphy%', '%Contreras%']) THEN 'C'
          WHEN player_name ILIKE ANY(ARRAY['%Freeman%', '%Goldschmidt%', '%Olson%', '%Alonso%', '%Guerrero%']) THEN '1B'
          WHEN player_name ILIKE ANY(ARRAY['%Altuve%', '%Semien%', '%Albies%', '%Torres%', '%Arraez%']) THEN '2B'
          WHEN player_name ILIKE ANY(ARRAY['%Machado%', '%Arenado%', '%Ramirez%', '%Riley%', '%Devers%']) THEN '3B'
          WHEN player_name ILIKE ANY(ARRAY['%Turner%', '%Lindor%', '%Seager%', '%Bichette%', '%Bogaerts%']) THEN 'SS'
          WHEN player_name ILIKE ANY(ARRAY['%Acuna%', '%Betts%', '%Judge%', '%Trout%', '%Soto%', '%Rodriguez%']) THEN 'OF'
          -- Distribute remaining players
          WHEN MOD(player_id::integer, 6) = 0 THEN 'C'
          WHEN MOD(player_id::integer, 6) = 1 THEN '1B'
          WHEN MOD(player_id::integer, 6) = 2 THEN '2B'
          WHEN MOD(player_id::integer, 6) = 3 THEN '3B'
          WHEN MOD(player_id::integer, 6) = 4 THEN 'SS'
          ELSE 'OF'
        END as position,
        team,
        'draftkings',
        -- Calculate salary based on performance
        CASE 
          WHEN avg > 0.300 AND hr > 30 THEN 9000 + (hr * 30)
          WHEN avg > 0.280 AND hr > 20 THEN 7500 + (hr * 35)
          WHEN avg > 0.260 THEN 6000 + (hr * 40) + (sb * 50)
          WHEN avg > 0.240 THEN 4500 + (hr * 45) + (sb * 60)
          ELSE 3000 + (hr * 50) + (sb * 70)
        END as salary,
        -- Project points based on typical DFS scoring
        GREATEST(
          3.0,
          (avg * 40) + (hr * 0.5) + (rbi * 0.05) + (runs * 0.05) + (sb * 0.3)
        ) as projected_points,
        -- Ownership based on performance
        LEAST(35, GREATEST(5, avg * 100 - 15)) as projected_ownership,
        CURRENT_DATE
      FROM batter_stats
      ON CONFLICT (player_id, platform, game_date) DO NOTHING;
    `;
    
    const batterResult = await client.query(batterQuery);
    console.log(chalk.green(`✅ Generated ${batterResult.rowCount} batter entries`));
    
    // Show position distribution
    console.log(chalk.yellow('\n📊 Position Distribution:'));
    const distQuery = `
      SELECT 
        position,
        COUNT(*) as count,
        AVG(salary) as avg_salary,
        MIN(salary) as min_salary,
        MAX(salary) as max_salary,
        AVG(projected_points) as avg_points,
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
        END;
    `;
    
    const dist = await client.query(distQuery);
    dist.rows.forEach(row => {
      console.log(
        `  ${row.position}: ${row.count} players, ` +
        `$${Math.round(Number(row.min_salary))}-$${Math.round(Number(row.max_salary))} ` +
        `(avg $${Math.round(Number(row.avg_salary))}), ` +
        `${Number(row.avg_points).toFixed(1)} avg pts (max ${Number(row.max_points).toFixed(1)})`
      );
    });
    
    // Show top players by position
    console.log(chalk.yellow('\n⭐ Top Players by Position:'));
    for (const pos of ['P', 'C', '1B', '2B', '3B', 'SS', 'OF']) {
      const topQuery = `
        SELECT player_name, team, salary, projected_points
        FROM dfs_salaries
        WHERE position = $1
        AND platform = 'draftkings'
        AND game_date = CURRENT_DATE
        ORDER BY projected_points DESC
        LIMIT 3;
      `;
      const top = await client.query(topQuery, [pos]);
      if (top.rows.length > 0) {
        console.log(chalk.cyan(`\n${pos}:`));
        top.rows.forEach(p => {
          console.log(`  ${p.player_name} (${p.team}) - $${p.salary} - ${Number(p.projected_points).toFixed(1)} pts`);
        });
      }
    }
    
    // Verify we can build lineups
    console.log(chalk.yellow('\n✅ Lineup Requirements Check:'));
    const requirements = { 'P': 2, 'C': 1, '1B': 1, '2B': 1, '3B': 1, 'SS': 1, 'OF': 3 };
    let canBuild = true;
    
    for (const [pos, needed] of Object.entries(requirements)) {
      const row = dist.rows.find(r => r.position === pos);
      const have = row ? Number(row.count) : 0;
      const status = have >= needed ? '✅' : '❌';
      console.log(`  ${pos}: Need ${needed}, have ${have} ${status}`);
      if (have < needed) canBuild = false;
    }
    
    console.log(canBuild ? chalk.green('\n✅ Ready to optimize lineups!') : chalk.red('\n❌ Need adjustments'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
  }
}

generateDFSFromBaseballStats().catch(console.error);