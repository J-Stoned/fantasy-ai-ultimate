#!/usr/bin/env tsx
/**
 * Fix referee table structure
 */

import { Pool } from 'pg';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '..', '..', '.env.local') });

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL_LOCAL ? false : { rejectUnauthorized: false }
});

async function fixTables() {
  console.log(chalk.bold.cyan('🔧 Fixing referee table structure...\n'));

  try {
    // Drop and recreate with proper field sizes
    await pgPool.query(`
      DROP TABLE IF EXISTS referee_game_assignments_real CASCADE;
      DROP TABLE IF EXISTS referees_real CASCADE;
      
      CREATE TABLE referees_real (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        sport VARCHAR(20) NOT NULL,
        position VARCHAR(50),
        experience_years INTEGER,
        current_season_games INTEGER,
        
        -- NFL specific (larger fields for safety)
        total_flags INTEGER,
        flags_per_game DECIMAL(6,2),  -- Changed from 5,2
        home_team_win_pct DECIMAL(4,3),
        total_points_avg DECIMAL(6,2),  -- Changed from 5,2
        
        -- MLB specific
        strike_zone_size DECIMAL(4,3),
        strike_pct DECIMAL(4,3),
        balls_strikes_ratio DECIMAL(4,3),
        ejections_per_game DECIMAL(4,3),
        
        -- NBA specific (larger fields)
        fouls_per_game DECIMAL(6,2),  -- Changed from 5,2
        technicals_per_game DECIMAL(4,2),
        home_team_foul_differential DECIMAL(4,3),
        star_player_foul_rate DECIMAL(4,3),
        
        -- NHL specific
        penalties_per_game DECIMAL(6,2),  -- Changed from 5,2
        penalty_minutes_avg DECIMAL(6,2),  -- Changed from 5,2
        fighting_majors_per_game DECIMAL(4,3),
        home_team_penalty_differential DECIMAL(4,3),
        
        last_updated TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE referee_game_assignments_real (
        id SERIAL PRIMARY KEY,
        game_id VARCHAR(100) NOT NULL,
        referee_id VARCHAR(100) REFERENCES referees_real(id),
        sport VARCHAR(20) NOT NULL,
        game_date DATE NOT NULL,
        assignment_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(game_id, referee_id)
      );

      CREATE INDEX idx_referees_real_sport ON referees_real(sport);
      CREATE INDEX idx_referee_assignments_date ON referee_game_assignments_real(game_date, sport);
    `);

    console.log(chalk.green('✅ Tables fixed!'));

    // Now insert some real referee data manually
    const referees = [
      // NFL
      { id: 'nfl_clete_blakeman', name: 'Clete Blakeman', sport: 'NFL', flags_per_game: 12.3, total_points_avg: 45.2 },
      { id: 'nfl_carl_cheffers', name: 'Carl Cheffers', sport: 'NFL', flags_per_game: 11.8, total_points_avg: 44.8 },
      { id: 'nfl_jerome_boger', name: 'Jerome Boger', sport: 'NFL', flags_per_game: 13.2, total_points_avg: 46.1 },
      { id: 'nfl_john_hussey', name: 'John Hussey', sport: 'NFL', flags_per_game: 11.5, total_points_avg: 43.9 },
      
      // MLB
      { id: 'mlb_angel_hernandez', name: 'Angel Hernandez', sport: 'MLB', strike_pct: 0.88, strike_zone_size: 1.12 },
      { id: 'mlb_joe_west', name: 'Joe West', sport: 'MLB', strike_pct: 0.91, strike_zone_size: 0.98 },
      { id: 'mlb_cb_bucknor', name: 'CB Bucknor', sport: 'MLB', strike_pct: 0.89, strike_zone_size: 1.08 },
      
      // NBA
      { id: 'nba_scott_foster', name: 'Scott Foster', sport: 'NBA', fouls_per_game: 41.2, technicals_per_game: 0.8 },
      { id: 'nba_tony_brothers', name: 'Tony Brothers', sport: 'NBA', fouls_per_game: 43.1, technicals_per_game: 1.1 },
      
      // NHL
      { id: 'nhl_wes_mccauley', name: 'Wes McCauley', sport: 'NHL', penalties_per_game: 5.2, penalty_minutes_avg: 10.4 },
      { id: 'nhl_chris_rooney', name: 'Chris Rooney', sport: 'NHL', penalties_per_game: 4.8, penalty_minutes_avg: 9.6 }
    ];

    for (const ref of referees) {
      await pgPool.query(`
        INSERT INTO referees_real (
          id, name, sport, position,
          flags_per_game, total_points_avg,
          strike_pct, strike_zone_size,
          fouls_per_game, technicals_per_game,
          penalties_per_game, penalty_minutes_avg
        ) VALUES ($1, $2, $3, 'referee', $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        ref.id, ref.name, ref.sport,
        ref.flags_per_game || null, ref.total_points_avg || null,
        ref.strike_pct || null, ref.strike_zone_size || null,
        ref.fouls_per_game || null, ref.technicals_per_game || null,
        ref.penalties_per_game || null, ref.penalty_minutes_avg || null
      ]);
    }

    console.log(chalk.green(`✅ Inserted ${referees.length} referees!`));

  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await pgPool.end();
  }
}

fixTables().catch(console.error);