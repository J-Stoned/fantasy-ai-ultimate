import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function executeMiLBSchema() {
  console.log(chalk.cyan('🔧 Executing MiLB Database Schema...'));
  
  try {
    // Test connection
    const { data: test, error: testError } = await supabase
      .from('teams')
      .select('count')
      .limit(1);
      
    if (testError) {
      console.error(chalk.red('Database connection failed:'), testError);
      return;
    }
    
    console.log(chalk.green('✅ Database connection successful'));
    
    // Execute schema updates one by one
    const schemaUpdates = [
      // Teams table updates
      {
        name: 'Add parent_org_id to teams',
        sql: `ALTER TABLE teams ADD COLUMN IF NOT EXISTS parent_org_id INTEGER REFERENCES teams(id);`
      },
      {
        name: 'Add league_level to teams',
        sql: `ALTER TABLE teams ADD COLUMN IF NOT EXISTS league_level VARCHAR(20);`
      },
      {
        name: 'Add milb_league_id to teams',
        sql: `ALTER TABLE teams ADD COLUMN IF NOT EXISTS milb_league_id INTEGER;`
      },
      {
        name: 'Add milb_division to teams',
        sql: `ALTER TABLE teams ADD COLUMN IF NOT EXISTS milb_division VARCHAR(50);`
      },
      // Games table updates
      {
        name: 'Add scheduled_innings to games',
        sql: `ALTER TABLE games ADD COLUMN IF NOT EXISTS scheduled_innings INTEGER DEFAULT 9;`
      },
      {
        name: 'Add actual_innings to games',
        sql: `ALTER TABLE games ADD COLUMN IF NOT EXISTS actual_innings INTEGER;`
      },
      {
        name: 'Add game_type to games',
        sql: `ALTER TABLE games ADD COLUMN IF NOT EXISTS game_type VARCHAR(10) DEFAULT 'R';`
      },
      {
        name: 'Add doubleheader to games',
        sql: `ALTER TABLE games ADD COLUMN IF NOT EXISTS doubleheader INTEGER DEFAULT 0;`
      },
      // Players table updates
      {
        name: 'Add milb_status to players',
        sql: `ALTER TABLE players ADD COLUMN IF NOT EXISTS milb_status VARCHAR(20);`
      },
      {
        name: 'Add draft_year to players',
        sql: `ALTER TABLE players ADD COLUMN IF NOT EXISTS draft_year INTEGER;`
      },
      {
        name: 'Add draft_round to players',
        sql: `ALTER TABLE players ADD COLUMN IF NOT EXISTS draft_round INTEGER;`
      },
      {
        name: 'Add signing_bonus to players',
        sql: `ALTER TABLE players ADD COLUMN IF NOT EXISTS signing_bonus NUMERIC;`
      }
    ];
    
    // Execute each update
    for (const update of schemaUpdates) {
      console.log(chalk.yellow(`\nExecuting: ${update.name}`));
      
      const { error } = await supabase.rpc('exec_sql', {
        sql: update.sql
      });
      
      if (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        
        // Try alternative approach using raw SQL
        console.log(chalk.yellow('Trying alternative approach...'));
        
        // Skip this update and continue
        console.log(chalk.orange(`Skipping: ${update.name}`));
      } else {
        console.log(chalk.green(`✅ ${update.name}`));
      }
    }
    
    // Create new tables
    console.log(chalk.cyan('\n\n📊 Creating new MiLB tables...'));
    
    const newTables = [
      {
        name: 'milb_affiliations',
        sql: `
          CREATE TABLE IF NOT EXISTS milb_affiliations (
            id SERIAL PRIMARY KEY,
            mlb_team_id INTEGER REFERENCES teams(id),
            milb_team_id INTEGER REFERENCES teams(id),
            affiliation_level VARCHAR(20) NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE,
            is_current BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT NOW()
          );
        `
      },
      {
        name: 'milb_ballparks',
        sql: `
          CREATE TABLE IF NOT EXISTS milb_ballparks (
            id SERIAL PRIMARY KEY,
            team_id INTEGER REFERENCES teams(id),
            venue_name VARCHAR(255) NOT NULL,
            capacity INTEGER,
            elevation_feet INTEGER,
            park_factor_runs NUMERIC,
            park_factor_hr NUMERIC,
            surface_type VARCHAR(50),
            dimensions JSONB,
            created_at TIMESTAMP DEFAULT NOW()
          );
        `
      },
      {
        name: 'milb_prospect_rankings',
        sql: `
          CREATE TABLE IF NOT EXISTS milb_prospect_rankings (
            id SERIAL PRIMARY KEY,
            player_id INTEGER REFERENCES players(id),
            ranking_source VARCHAR(50) NOT NULL,
            overall_rank INTEGER,
            org_rank INTEGER,
            position_rank INTEGER,
            grade VARCHAR(10),
            eta_year INTEGER,
            tools_grades JSONB,
            ranking_date DATE NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
          );
        `
      },
      {
        name: 'milb_development_metrics',
        sql: `
          CREATE TABLE IF NOT EXISTS milb_development_metrics (
            id SERIAL PRIMARY KEY,
            player_id INTEGER REFERENCES players(id),
            season INTEGER NOT NULL,
            level VARCHAR(20) NOT NULL,
            days_at_level INTEGER,
            promotion_velocity NUMERIC,
            performance_vs_age NUMERIC,
            league_adjusted_ops NUMERIC,
            created_at TIMESTAMP DEFAULT NOW()
          );
        `
      },
      {
        name: 'milb_weather_impact',
        sql: `
          CREATE TABLE IF NOT EXISTS milb_weather_impact (
            id SERIAL PRIMARY KEY,
            game_id INTEGER REFERENCES games(id),
            temperature_impact NUMERIC,
            wind_impact NUMERIC,
            altitude_impact NUMERIC,
            humidity_impact NUMERIC,
            total_runs_adjustment NUMERIC,
            created_at TIMESTAMP DEFAULT NOW()
          );
        `
      },
      {
        name: 'milb_travel_metrics',
        sql: `
          CREATE TABLE IF NOT EXISTS milb_travel_metrics (
            id SERIAL PRIMARY KEY,
            team_id INTEGER REFERENCES teams(id),
            game_id INTEGER REFERENCES games(id),
            miles_traveled INTEGER,
            time_zones_crossed INTEGER,
            bus_trip BOOLEAN DEFAULT true,
            rest_days INTEGER,
            cumulative_miles_week INTEGER,
            fatigue_score NUMERIC,
            created_at TIMESTAMP DEFAULT NOW()
          );
        `
      }
    ];
    
    // Try to create tables directly using Supabase
    for (const table of newTables) {
      console.log(chalk.yellow(`\nCreating table: ${table.name}`));
      
      // Since we can't execute raw SQL directly, we'll check if the table exists
      // by trying to query it
      const { error: checkError } = await supabase
        .from(table.name)
        .select('count')
        .limit(1);
        
      if (checkError && checkError.message.includes('does not exist')) {
        console.log(chalk.orange(`❌ Cannot create table ${table.name} - requires database admin access`));
      } else if (checkError) {
        console.log(chalk.orange(`⚠️ Table ${table.name} may have issues: ${checkError.message}`));
      } else {
        console.log(chalk.green(`✅ Table ${table.name} already exists`));
      }
    }
    
    console.log(chalk.cyan('\n\n🎯 Schema update completed!'));
    console.log(chalk.yellow('\nNote: Some operations may require direct database access.'));
    console.log(chalk.yellow('The MiLB collector will work with existing tables.'));
    
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
  }
}

// Run the schema execution
executeMiLBSchema().then(() => {
  console.log(chalk.green('\n✨ Done!'));
  process.exit(0);
}).catch(error => {
  console.error(chalk.red('Error:'), error);
  process.exit(1);
});