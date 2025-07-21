#!/usr/bin/env tsx
/**
 * Fix player positions based on their actual roles
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Known pitchers (expanded list)
const PITCHERS = [
  // From your data
  'Crochet', 'Strider', 'Skubal', 'Giolito', 'Cease', 'Sale', 'Greene', 'Fried', 
  'Steele', 'Bibee', 'Davies', 'Henry', 'Cecconi', 'Flaherty', 'Morton', 'Kelly', 
  'Crawford', 'Pivetta', 'Rodriguez', 'Elder', 'Gibson', 'Paxton', 'Wells',
  // Additional obvious pitchers
  'Wheeler', 'deGrom', 'Glasnow', 'Yamamoto', 'Springs', 'Woodruff', 'Valdez',
  'Gilbert', 'Schwellenbach', 'Misiorowski', 'Burnes', 'Webb', 'Nola', 'Bieber',
  'Kershaw', 'Verlander', 'Scherzer', 'Ohtani', 'Alcantara', 'Musgrove',
  'Gausman', 'Castillo', 'Ray', 'Rodon', 'Lynn', 'Bassitt', 'Snell'
];

// Known position players by typical position
const POSITION_PLAYERS = {
  C: ['Contreras', 'Realmuto', 'Smith', 'Rutschman', 'Murphy', 'Perez', 'Varsho'],
  '1B': ['Freeman', 'Goldschmidt', 'Olson', 'Alonso', 'Guerrero', 'Muncy', 'Bell'],
  '2B': ['Albies', 'Altuve', 'Semien', 'India', 'Edman', 'McNeil', 'Cronenworth'],
  '3B': ['Arenado', 'Machado', 'Ramirez', 'Riley', 'Devers', 'Turner', 'Chapman'],
  SS: ['Lindor', 'Correa', 'Seager', 'Bogaerts', 'Swanson', 'Story', 'Anderson'],
  OF: ['Acuna', 'Betts', 'Judge', 'Trout', 'Soto', 'Tucker', 'Robert', 'Carroll', 
       'Arozarena', 'Mullins', 'Reynolds', 'Nimmo', 'Springer', 'Yelich']
};

async function fixPlayerPositions() {
  console.log(chalk.cyan('🔧 Fixing Player Positions\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // First, update all known pitchers
    console.log(chalk.yellow('⚾ Updating pitcher positions...'));
    let pitcherCount = 0;
    for (const pitcher of PITCHERS) {
      const result = await client.query(`
        UPDATE dfs_salaries 
        SET position = 'P' 
        WHERE player_name ILIKE '%${pitcher}%'
        AND platform = 'draftkings'
        AND game_date = CURRENT_DATE;
      `);
      pitcherCount += result.rowCount || 0;
    }
    console.log(chalk.green(`✅ Updated ${pitcherCount} pitchers to position 'P'`));
    
    // Update known position players
    console.log(chalk.yellow('\n🏃 Updating position players...'));
    for (const [position, players] of Object.entries(POSITION_PLAYERS)) {
      let posCount = 0;
      for (const player of players) {
        const result = await client.query(`
          UPDATE dfs_salaries 
          SET position = $1
          WHERE player_name ILIKE '%${player}%'
          AND position != 'P'  -- Don't override pitchers
          AND platform = 'draftkings'
          AND game_date = CURRENT_DATE;
        `, [position]);
        posCount += result.rowCount || 0;
      }
      console.log(`  ${position}: Updated ${posCount} players`);
    }
    
    // For remaining players, try to infer from stats
    console.log(chalk.yellow('\n🔍 Inferring positions from stats...'));
    const inferQuery = `
      UPDATE dfs_salaries ds
      SET position = 
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM player_stats ps 
            WHERE ps.player_id::text = ds.player_id 
            AND ps.stat_type = 'pitching'
          ) THEN 'P'
          ELSE position  -- Keep existing if no pitching stats
        END
      WHERE position != 'P'
      AND platform = 'draftkings'
      AND game_date = CURRENT_DATE;
    `;
    const inferResult = await client.query(inferQuery);
    console.log(`Updated ${inferResult.rowCount} players based on stats`);
    
    // Show updated distribution
    console.log(chalk.yellow('\n📊 Updated Position Distribution:'));
    const posQuery = `
      SELECT position, COUNT(*) as count, 
             AVG(salary) as avg_salary,
             AVG(projected_points) as avg_points,
             (SELECT STRING_AGG(sub.player_name || ' (' || sub.projected_points::numeric(4,1) || ')', ', ')
              FROM (
                SELECT player_name, projected_points 
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
    const positions = await client.query(posQuery);
    positions.rows.forEach(row => {
      console.log(chalk.cyan(`\n${row.position}:`));
      console.log(`  Count: ${row.count} players`);
      console.log(`  Avg Salary: $${Math.round(Number(row.avg_salary))}`);
      console.log(`  Avg Points: ${Number(row.avg_points).toFixed(1)}`);
      console.log(`  Top Players: ${row.top_players}`);
    });
    
    // Check if we have enough players for each position
    console.log(chalk.yellow('\n✅ Position Requirements Check:'));
    const requirements = {
      'P': 2,
      'C': 1,
      '1B': 1,
      '2B': 1,
      '3B': 1,
      'SS': 1,
      'OF': 3
    };
    
    let canBuildLineup = true;
    for (const [pos, required] of Object.entries(requirements)) {
      const posData = positions.rows.find(r => r.position === pos);
      const available = posData ? posData.count : 0;
      const status = available >= required ? '✅' : '❌';
      console.log(`  ${pos}: Need ${required}, have ${available} ${status}`);
      if (available < required) canBuildLineup = false;
    }
    
    if (canBuildLineup) {
      console.log(chalk.green('\n✅ Ready to build lineups!'));
    } else {
      console.log(chalk.red('\n❌ Not enough players for some positions'));
      console.log(chalk.yellow('Consider adjusting position assignments or using UTIL spots'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  } finally {
    await client.end();
  }
}

fixPlayerPositions().catch(console.error);