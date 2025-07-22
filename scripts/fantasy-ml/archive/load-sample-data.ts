#!/usr/bin/env tsx
/**
 * Load Sample Data for Fantasy ML Testing
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function loadSampleData() {
  console.log(chalk.cyan('📊 Loading Sample Fantasy ML Data...\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'fantasy_ai_local',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres'
  });
  
  try {
    await client.connect();
    console.log(chalk.green('✅ Connected to database\n'));
    
    // Load sample DFS data
    console.log(chalk.yellow('Loading DFS player data...'));
    const dfsPlayers = [
      { player_id: 'lebron-james', name: 'LeBron James', position: 'SF', team: 'LAL', dk_salary: 11000, fd_salary: 11200, projected_points: 55, projected_ownership: 25 },
      { player_id: 'giannis-antetokounmpo', name: 'Giannis Antetokounmpo', position: 'PF', team: 'MIL', dk_salary: 12000, fd_salary: 12300, projected_points: 60, projected_ownership: 30 },
      { player_id: 'stephen-curry', name: 'Stephen Curry', position: 'PG', team: 'GSW', dk_salary: 10000, fd_salary: 10500, projected_points: 48, projected_ownership: 20 },
      { player_id: 'nikola-jokic', name: 'Nikola Jokic', position: 'C', team: 'DEN', dk_salary: 11500, fd_salary: 11800, projected_points: 58, projected_ownership: 22 },
      { player_id: 'damian-lillard', name: 'Damian Lillard', position: 'PG', team: 'MIL', dk_salary: 8500, fd_salary: 8800, projected_points: 42, projected_ownership: 15 },
      { player_id: 'devin-booker', name: 'Devin Booker', position: 'SG', team: 'PHX', dk_salary: 8000, fd_salary: 8300, projected_points: 40, projected_ownership: 12 },
      { player_id: 'anthony-davis', name: 'Anthony Davis', position: 'PF', team: 'LAL', dk_salary: 9500, fd_salary: 9800, projected_points: 48, projected_ownership: 16 },
      { player_id: 'jayson-tatum', name: 'Jayson Tatum', position: 'SF', team: 'BOS', dk_salary: 9000, fd_salary: 9300, projected_points: 45, projected_ownership: 18 }
    ];
    
    // Insert DFS salaries
    for (const player of dfsPlayers) {
      await client.query(`
        INSERT INTO dfs_salaries (
          player_id, player_name, position, team, platform, 
          salary, projected_points, projected_ownership, game_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)
        ON CONFLICT (player_id, platform, game_date) DO UPDATE
        SET salary = $6, projected_points = $7, projected_ownership = $8
      `, [
        player.player_id, player.name, player.position, player.team,
        'draftkings', player.dk_salary, player.projected_points, player.projected_ownership
      ]);
      
      await client.query(`
        INSERT INTO dfs_salaries (
          player_id, player_name, position, team, platform, 
          salary, projected_points, projected_ownership, game_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)
        ON CONFLICT (player_id, platform, game_date) DO UPDATE
        SET salary = $6, projected_points = $7, projected_ownership = $8
      `, [
        player.player_id, player.name, player.position, player.team,
        'fanduel', player.fd_salary, player.projected_points, player.projected_ownership
      ]);
    }
    console.log(chalk.green(`✅ Loaded ${dfsPlayers.length * 2} DFS salary records`));
    
    // Load sample player projections
    console.log(chalk.yellow('\nLoading player projections...'));
    const projections = [
      { player_id: 'lebron-james', points: 28.5, rebounds: 7.5, assists: 8.2, steals: 1.2, blocks: 0.8, turnovers: 3.5, minutes: 35 },
      { player_id: 'giannis-antetokounmpo', points: 31.2, rebounds: 11.5, assists: 5.8, steals: 1.1, blocks: 1.3, turnovers: 3.2, minutes: 36 },
      { player_id: 'stephen-curry', points: 27.8, rebounds: 5.2, assists: 6.5, steals: 1.0, blocks: 0.3, turnovers: 2.8, minutes: 34 },
      { player_id: 'nikola-jokic', points: 26.5, rebounds: 12.3, assists: 9.1, steals: 1.3, blocks: 0.7, turnovers: 3.1, minutes: 35 },
      { player_id: 'damian-lillard', points: 24.8, rebounds: 4.2, assists: 7.3, steals: 0.9, blocks: 0.3, turnovers: 2.7, minutes: 35 },
      { player_id: 'devin-booker', points: 25.1, rebounds: 4.5, assists: 5.2, steals: 0.8, blocks: 0.4, turnovers: 2.5, minutes: 34 },
      { player_id: 'anthony-davis', points: 24.9, rebounds: 10.5, assists: 3.1, steals: 1.2, blocks: 2.3, turnovers: 2.1, minutes: 34 },
      { player_id: 'jayson-tatum', points: 26.2, rebounds: 8.1, assists: 4.9, steals: 1.0, blocks: 0.6, turnovers: 2.8, minutes: 36 }
    ];
    
    for (const proj of projections) {
      await client.query(`
        INSERT INTO player_projections (
          player_id, sport, projection_date, points, rebounds, assists, 
          steals, blocks, turnovers, minutes_played, fantasy_points
        ) VALUES ($1, 'NBA', CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (player_id, projection_date) DO UPDATE
        SET points = $2, rebounds = $3, assists = $4, steals = $5, 
            blocks = $6, turnovers = $7, minutes_played = $8, fantasy_points = $9
      `, [
        proj.player_id, proj.points, proj.rebounds, proj.assists,
        proj.steals, proj.blocks, proj.turnovers, proj.minutes,
        // DraftKings scoring: PTS + REB*1.25 + AST*1.5 + STL*2 + BLK*2 - TO*0.5
        proj.points + proj.rebounds * 1.25 + proj.assists * 1.5 + 
        proj.steals * 2 + proj.blocks * 2 - proj.turnovers * 0.5
      ]);
    }
    console.log(chalk.green(`✅ Loaded ${projections.length} player projections`));
    
    // Count total records
    console.log(chalk.yellow('\n📊 Data Summary:'));
    const counts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM dfs_salaries) as dfs_salaries,
        (SELECT COUNT(*) FROM player_projections) as projections,
        (SELECT COUNT(*) FROM dfs_lineups) as lineups,
        (SELECT COUNT(*) FROM ml_features) as ml_features
    `);
    
    const row = counts.rows[0];
    console.log(`DFS Salaries: ${row.dfs_salaries}`);
    console.log(`Player Projections: ${row.projections}`);
    console.log(`DFS Lineups: ${row.lineups}`);
    console.log(`ML Features: ${row.ml_features}`);
    
    console.log(chalk.green('\n✅ Sample data loaded successfully!'));
    console.log(chalk.yellow('\nYou can now:'));
    console.log('1. Test the optimizer: npm run fantasy:test');
    console.log('2. Train models: npm run fantasy:train');
    console.log('3. Start the API: npm run fantasy:api');
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to load data:'));
    console.error(error.message);
  } finally {
    await client.end();
  }
}

// Run loader
loadSampleData().catch(console.error);