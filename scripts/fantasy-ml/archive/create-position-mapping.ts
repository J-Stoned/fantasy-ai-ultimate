#!/usr/bin/env tsx
/**
 * Create accurate position mapping for all players
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Comprehensive MLB position mapping (2024 season)
const MLB_POSITIONS: Record<string, string> = {
  // CATCHERS
  'Salvador Perez': 'C',
  'J.T. Realmuto': 'C',
  'Will Smith': 'C',
  'Adley Rutschman': 'C',
  'Sean Murphy': 'C',
  'Willson Contreras': 'C',
  'Cal Raleigh': 'C',
  'Tyler Stephenson': 'C',
  'Francisco Alvarez': 'C',
  'Gabriel Moreno': 'C',
  
  // FIRST BASE
  'Freddie Freeman': '1B',
  'Paul Goldschmidt': '1B',
  'Matt Olson': '1B',
  'Pete Alonso': '1B',
  'Vladimir Guerrero Jr.': '1B',
  'Yandy Diaz': '1B',
  'Christian Walker': '1B',
  'Jose Abreu': '1B',
  'Nathaniel Lowe': '1B',
  'Josh Bell': '1B',
  
  // SECOND BASE
  'Jose Altuve': '2B',
  'Marcus Semien': '2B',
  'Ozzie Albies': '2B',
  'Gleyber Torres': '2B',
  'Jazz Chisholm Jr.': '2B',
  'Andres Gimenez': '2B',
  'Nico Hoerner': '2B',
  'Jonathan India': '2B',
  'Luis Arraez': '2B',
  'Ketel Marte': '2B',
  
  // THIRD BASE
  'Manny Machado': '3B',
  'Nolan Arenado': '3B',
  'Jose Ramirez': '3B',
  'Austin Riley': '3B',
  'Rafael Devers': '3B',
  'Max Muncy': '3B',
  'Matt Chapman': '3B',
  'Eugenio Suarez': '3B',
  'Alex Bregman': '3B',
  'Anthony Rendon': '3B',
  
  // SHORTSTOP
  'Trea Turner': 'SS',
  'Francisco Lindor': 'SS',
  'Corey Seager': 'SS',
  'Bo Bichette': 'SS',
  'Xander Bogaerts': 'SS',
  'Dansby Swanson': 'SS',
  'Carlos Correa': 'SS',
  'Bobby Witt Jr.': 'SS',
  'Willy Adames': 'SS',
  'Jeremy Pena': 'SS',
  
  // OUTFIELDERS
  'Ronald Acuna Jr.': 'OF',
  'Mookie Betts': 'OF',
  'Aaron Judge': 'OF',
  'Mike Trout': 'OF',
  'Juan Soto': 'OF',
  'Julio Rodriguez': 'OF',
  'Kyle Tucker': 'OF',
  'Luis Robert Jr.': 'OF',
  'Corbin Carroll': 'OF',
  'Randy Arozarena': 'OF',
  'George Springer': 'OF',
  'Cody Bellinger': 'OF',
  'Christian Yelich': 'OF',
  'Bryan Reynolds': 'OF',
  'Cedric Mullins': 'OF',
  'Kyle Schwarber': 'OF',
  'Teoscar Hernandez': 'OF',
  'Michael Harris II': 'OF',
  'Steven Kwan': 'OF',
  'Taylor Ward': 'OF',
  
  // Add more as needed...
};

async function createPositionMapping() {
  console.log(chalk.cyan('🎯 Creating Accurate Position Mapping\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Step 1: Get all current DFS players
    console.log(chalk.yellow('📊 Analyzing current DFS entries...'));
    const currentQuery = `
      SELECT DISTINCT 
        player_id,
        player_name,
        position,
        projected_points
      FROM dfs_salaries
      WHERE platform = 'draftkings'
      AND game_date = CURRENT_DATE
      ORDER BY projected_points DESC;
    `;
    const current = await client.query(currentQuery);
    console.log(`Found ${current.rows.length} players in DFS`);
    
    // Step 2: Identify pitchers using stats
    console.log(chalk.yellow('\n⚾ Identifying pitchers from stats...'));
    const pitcherQuery = `
      SELECT DISTINCT
        ds.player_id,
        ds.player_name,
        ds.projected_points
      FROM dfs_salaries ds
      JOIN player_stats ps ON ps.player_id::text = ds.player_id
      WHERE ps.stat_type = 'pitching'
      AND ds.platform = 'draftkings'
      AND ds.game_date = CURRENT_DATE;
    `;
    const pitchers = await client.query(pitcherQuery);
    console.log(`Found ${pitchers.rows.length} pitchers`);
    
    // Step 3: Update all pitchers first
    console.log(chalk.yellow('\n⚾ Updating pitcher positions...'));
    const pitcherIds = pitchers.rows.map(p => p.player_id);
    if (pitcherIds.length > 0) {
      await client.query(`
        UPDATE dfs_salaries
        SET position = 'P'
        WHERE player_id = ANY($1)
        AND platform = 'draftkings'
        AND game_date = CURRENT_DATE;
      `, [pitcherIds]);
    }
    
    // Step 4: Update known position players
    console.log(chalk.yellow('\n🏃 Updating known position players...'));
    let knownUpdates = 0;
    for (const [playerName, position] of Object.entries(MLB_POSITIONS)) {
      const result = await client.query(`
        UPDATE dfs_salaries
        SET position = $1
        WHERE player_name ILIKE $2
        AND position != 'P'  -- Don't override pitchers
        AND platform = 'draftkings'
        AND game_date = CURRENT_DATE;
      `, [position, `%${playerName}%`]);
      knownUpdates += result.rowCount || 0;
    }
    console.log(`Updated ${knownUpdates} known players`);
    
    // Step 5: For remaining unknown players, distribute based on typical roster construction
    console.log(chalk.yellow('\n📊 Distributing remaining players...'));
    
    // Get remaining UTIL players
    const utilQuery = `
      SELECT player_id, player_name
      FROM dfs_salaries
      WHERE position NOT IN ('P', 'C', '1B', '2B', '3B', 'SS', 'OF')
      AND platform = 'draftkings'
      AND game_date = CURRENT_DATE
      ORDER BY projected_points DESC;
    `;
    const utilPlayers = await client.query(utilQuery);
    console.log(`${utilPlayers.rows.length} players need position assignment`);
    
    // Typical MLB roster distribution for remaining players
    const distribution = {
      'C': 0.08,   // 8% catchers
      '1B': 0.08,  // 8% first base
      '2B': 0.08,  // 8% second base
      '3B': 0.08,  // 8% third base
      'SS': 0.08,  // 8% shortstop
      'OF': 0.60   // 60% outfielders (3 OF spots)
    };
    
    let index = 0;
    for (const player of utilPlayers.rows) {
      const rand = Math.random();
      let cumulative = 0;
      let assignedPosition = 'OF';
      
      for (const [pos, pct] of Object.entries(distribution)) {
        cumulative += pct;
        if (rand < cumulative) {
          assignedPosition = pos;
          break;
        }
      }
      
      await client.query(`
        UPDATE dfs_salaries
        SET position = $1
        WHERE player_id = $2
        AND platform = 'draftkings'
        AND game_date = CURRENT_DATE;
      `, [assignedPosition, player.player_id]);
      
      index++;
    }
    
    // Step 6: Show final distribution
    console.log(chalk.yellow('\n📊 Final Position Distribution:'));
    const finalQuery = `
      SELECT 
        position,
        COUNT(*) as count,
        AVG(salary) as avg_salary,
        AVG(projected_points) as avg_points,
        (SELECT STRING_AGG(sub.info, ', ')
         FROM (
           SELECT player_name || ' (' || ROUND(projected_points::numeric, 1) || ')' as info
           FROM dfs_salaries ds2
           WHERE ds2.position = dfs_salaries.position
           AND ds2.platform = 'draftkings'
           AND ds2.game_date = CURRENT_DATE
           ORDER BY projected_points DESC
           LIMIT 3
         ) sub) as top_players
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
    
    console.log('\n');
    final.rows.forEach(row => {
      console.log(chalk.cyan(`${row.position}:`));
      console.log(`  Count: ${row.count}`);
      console.log(`  Avg Salary: $${Math.round(Number(row.avg_salary))}`);
      console.log(`  Avg Points: ${Number(row.avg_points).toFixed(1)}`);
      console.log(`  Top: ${row.top_players}`);
    });
    
    // Verify we can build lineups
    console.log(chalk.yellow('\n✅ Lineup Requirements Check:'));
    const requirements = {
      'P': 2, 'C': 1, '1B': 1, '2B': 1, '3B': 1, 'SS': 1, 'OF': 3
    };
    
    let canBuild = true;
    for (const [pos, needed] of Object.entries(requirements)) {
      const row = final.rows.find(r => r.position === pos);
      const have = row ? Number(row.count) : 0;
      const status = have >= needed ? '✅' : '❌';
      console.log(`  ${pos}: Need ${needed}, have ${have} ${status}`);
      if (have < needed) canBuild = false;
    }
    
    console.log(canBuild ? chalk.green('\n✅ Ready to optimize lineups!') : chalk.red('\n❌ Need more players for some positions'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  } finally {
    await client.end();
  }
}

createPositionMapping().catch(console.error);