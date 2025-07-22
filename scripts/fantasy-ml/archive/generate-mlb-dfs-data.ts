#!/usr/bin/env tsx
/**
 * Generate DFS data from actual MLB players
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function generateMLBDFSData() {
  console.log(chalk.cyan('⚾ Generating DFS Data from MLB Players\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Clear existing DFS data
    console.log(chalk.yellow('🧹 Clearing existing DFS data...'));
    await client.query('TRUNCATE TABLE dfs_salaries;');
    
    // Get MLB players with positions
    console.log(chalk.yellow('⚾ Getting MLB players...'));
    const mlbPlayersQuery = `
      SELECT 
        p.id,
        p.firstname,
        p.lastname,
        p.position,
        t.name as team_name,
        t.abbreviation as team_abbr
      FROM players p
      JOIN teams t ON p.team_id = t.id
      WHERE p.sport_id = 'MLB' OR p.sport_id = 'mlb'
      AND p.position IS NOT NULL
      AND p.position != '{}'
      ORDER BY p.id;
    `;
    
    const mlbPlayers = await client.query(mlbPlayersQuery);
    console.log(`Found ${mlbPlayers.rows.length} MLB players with positions`);
    
    // Process players and create DFS entries
    console.log(chalk.yellow('\n💰 Creating DFS entries...'));
    let inserted = 0;
    
    for (const player of mlbPlayers.rows) {
      const playerName = `${player.firstname} ${player.lastname}`.trim();
      
      // Extract position from array (PostgreSQL array format)
      let position = 'UTIL';
      if (player.position) {
        // Handle PostgreSQL array format {"SP"} or {SP}
        const posMatch = player.position.toString().match(/[{"']?([^}"']+)[}"']?/);
        if (posMatch) {
          position = posMatch[1];
        }
      }
      
      // Map positions to DFS format
      const dfsPosition = mapToDFSPosition(position);
      
      // Calculate salary based on position
      const baseSalary = getBaseSalary(dfsPosition);
      const salary = baseSalary + Math.floor(Math.random() * 3000);
      
      // Calculate projected points
      const projectedPoints = calculateProjectedPoints(dfsPosition, salary);
      
      // Calculate ownership
      const ownership = 5 + Math.random() * 25;
      
      const insertQuery = `
        INSERT INTO dfs_salaries (
          player_id, player_name, position, team, platform,
          salary, projected_points, projected_ownership, game_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (player_id, platform, game_date) DO NOTHING;
      `;
      
      await client.query(insertQuery, [
        player.id.toString(),
        playerName,
        dfsPosition,
        player.team_abbr || 'FA',
        'draftkings',
        salary,
        projectedPoints,
        ownership,
        new Date().toISOString().split('T')[0]
      ]);
      
      inserted++;
    }
    
    console.log(chalk.green(`✅ Inserted ${inserted} DFS entries`));
    
    // Add some more players if we don't have enough
    if (inserted < 200) {
      console.log(chalk.yellow('\n🎲 Generating additional players to meet requirements...'));
      
      // Get player stats to generate more realistic DFS data
      const statsQuery = `
        SELECT 
          ps.player_id,
          p.firstname,
          p.lastname,
          ps.stat_type,
          ps.stat_value,
          t.abbreviation as team_abbr
        FROM player_stats ps
        JOIN players p ON ps.player_id = p.id
        LEFT JOIN teams t ON p.team_id = t.id
        WHERE ps.stat_type IN ('batting', 'pitching')
        AND p.id NOT IN (
          SELECT CAST(player_id AS INTEGER) 
          FROM dfs_salaries 
          WHERE platform = 'draftkings' 
          AND game_date = CURRENT_DATE
        )
        LIMIT 300;
      `;
      
      const stats = await client.query(statsQuery);
      console.log(`Found ${stats.rows.length} players with stats`);
      
      for (const player of stats.rows) {
        const playerName = `${player.firstname} ${player.lastname}`.trim() || `Player ${player.player_id}`;
        const position = player.stat_type === 'pitching' ? 'P' : getRandomPosition();
        
        // Parse stats if available
        let statBonus = 0;
        try {
          const statData = JSON.parse(player.stat_value);
          if (player.stat_type === 'pitching' && statData.era) {
            statBonus = Math.max(0, (4.5 - parseFloat(statData.era)) * 500);
          } else if (player.stat_type === 'batting' && statData.avg) {
            statBonus = parseFloat(statData.avg) * 10000;
          }
        } catch (e) {
          // Ignore parse errors
        }
        
        const baseSalary = getBaseSalary(position);
        const salary = Math.min(10000, baseSalary + statBonus + Math.floor(Math.random() * 2000));
        const projectedPoints = calculateProjectedPoints(position, salary);
        const ownership = 5 + Math.random() * 20;
        
        await client.query(insertQuery, [
          player.player_id.toString(),
          playerName,
          position,
          player.team_abbr || 'FA',
          'draftkings',
          salary,
          projectedPoints,
          ownership,
          new Date().toISOString().split('T')[0]
        ]);
        
        inserted++;
      }
    }
    
    // Show final distribution
    console.log(chalk.yellow('\n📊 Final Position Distribution:'));
    const distQuery = `
      SELECT 
        position,
        COUNT(*) as count,
        AVG(salary)::INTEGER as avg_salary,
        MIN(salary) as min_salary,
        MAX(salary) as max_salary,
        AVG(projected_points)::NUMERIC(5,1) as avg_points
      FROM dfs_salaries
      WHERE platform = 'draftkings'
      AND game_date = CURRENT_DATE
      GROUP BY position
      ORDER BY position;
    `;
    
    const dist = await client.query(distQuery);
    dist.rows.forEach(row => {
      console.log(
        `  ${row.position}: ${row.count} players, ` +
        `$${row.min_salary}-$${row.max_salary} ` +
        `(avg $${row.avg_salary}), ` +
        `${row.avg_points} avg pts`
      );
    });
    
    // Verify lineup requirements
    console.log(chalk.yellow('\n✅ Lineup Requirements Check:'));
    const requirements = {
      'P': 2, 'C': 1, '1B': 1, '2B': 1, '3B': 1, 'SS': 1, 'OF': 3
    };
    
    let canBuild = true;
    for (const [pos, needed] of Object.entries(requirements)) {
      const row = dist.rows.find(r => r.position === pos);
      const have = row ? Number(row.count) : 0;
      const status = have >= needed ? '✅' : '❌';
      console.log(`  ${pos}: Need ${needed}, have ${have} ${status}`);
      if (have < needed) canBuild = false;
    }
    
    console.log(canBuild ? 
      chalk.green('\n✅ Ready to optimize lineups!') : 
      chalk.red('\n❌ Need to adjust position distribution')
    );
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
    console.error('Details:', error);
  } finally {
    await client.end();
  }
}

function mapToDFSPosition(position: string): string {
  // Map various position formats to standard DFS positions
  const positionMap: Record<string, string> = {
    'SP': 'P', 'RP': 'P', 'CL': 'P', 'P': 'P',
    'C': 'C',
    '1B': '1B',
    '2B': '2B',
    '3B': '3B',
    'SS': 'SS',
    'OF': 'OF', 'LF': 'OF', 'CF': 'OF', 'RF': 'OF',
    'DH': 'UTIL', 'UTIL': 'UTIL'
  };
  
  return positionMap[position] || 'UTIL';
}

function getBaseSalary(position: string): number {
  const salaryMap: Record<string, number> = {
    'P': 6000,
    'C': 4000,
    '1B': 4500,
    '2B': 4000,
    '3B': 4500,
    'SS': 4500,
    'OF': 4000,
    'UTIL': 3500
  };
  
  return salaryMap[position] || 3500;
}

function calculateProjectedPoints(position: string, salary: number): number {
  // Base points by position
  const basePoints: Record<string, number> = {
    'P': 15,
    'C': 8,
    '1B': 10,
    '2B': 9,
    '3B': 10,
    'SS': 9,
    'OF': 9,
    'UTIL': 8
  };
  
  const base = basePoints[position] || 8;
  const salaryFactor = (salary - 3000) / 7000; // 0-1 scale
  const variance = Math.random() * 5 - 2.5; // -2.5 to +2.5
  
  return Math.max(3, base + (salaryFactor * 10) + variance);
}

function getRandomPosition(): string {
  const positions = ['C', '1B', '2B', '3B', 'SS', 'OF', 'OF', 'OF'];
  return positions[Math.floor(Math.random() * positions.length)];
}

generateMLBDFSData().catch(console.error);