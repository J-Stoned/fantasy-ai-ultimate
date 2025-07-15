#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createNBATables() {
  console.log('🏀 Creating NBA tables using Supabase SQL...\n');

  try {
    // Create nba_players table
    const createPlayersSQL = `
      CREATE TABLE IF NOT EXISTS nba_players (
        id SERIAL PRIMARY KEY,
        nba_player_id VARCHAR(50) UNIQUE NOT NULL,
        player_name VARCHAR(255) NOT NULL,
        position VARCHAR(50),
        jersey_number INTEGER,
        current_team VARCHAR(255),
        height VARCHAR(20),
        weight INTEGER,
        birthdate DATE,
        college VARCHAR(255),
        draft_year INTEGER,
        draft_round INTEGER,
        draft_pick INTEGER,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    const { error: playersError } = await supabase.rpc('exec_sql', {
      sql: createPlayersSQL
    });

    if (playersError) {
      console.log('⚠️  nba_players table might already exist or SQL exec not available');
    } else {
      console.log('✅ Created nba_players table');
    }

    // Create nba_stats table
    const createStatsSQL = `
      CREATE TABLE IF NOT EXISTS nba_stats (
        id SERIAL PRIMARY KEY,
        nba_player_id VARCHAR(50) NOT NULL,
        game_id INTEGER NOT NULL,
        stat_type VARCHAR(50) NOT NULL,
        stat_value DECIMAL(10, 2) NOT NULL,
        fantasy_points DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        FOREIGN KEY (game_id) REFERENCES games(id),
        UNIQUE(nba_player_id, game_id, stat_type)
      );
    `;

    const { error: statsError } = await supabase.rpc('exec_sql', {
      sql: createStatsSQL
    });

    if (statsError) {
      console.log('⚠️  nba_stats table might already exist or SQL exec not available');
    } else {
      console.log('✅ Created nba_stats table');
    }

    // Create indexes
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_nba_players_player_id ON nba_players(nba_player_id);
      CREATE INDEX IF NOT EXISTS idx_nba_players_name ON nba_players(player_name);
      CREATE INDEX IF NOT EXISTS idx_nba_players_team ON nba_players(current_team);
      CREATE INDEX IF NOT EXISTS idx_nba_stats_player_id ON nba_stats(nba_player_id);
      CREATE INDEX IF NOT EXISTS idx_nba_stats_game_id ON nba_stats(game_id);
      CREATE INDEX IF NOT EXISTS idx_nba_stats_type ON nba_stats(stat_type);
      CREATE INDEX IF NOT EXISTS idx_nba_stats_composite ON nba_stats(nba_player_id, game_id);
    `;

    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: createIndexesSQL
    });

    if (indexError) {
      console.log('⚠️  Some indexes might already exist');
    } else {
      console.log('✅ Created indexes');
    }

    console.log('\n📊 NBA tables setup complete!');
    console.log('\nNote: If tables already exist or SQL execution is not available,');
    console.log('the mega batch processor will use the existing player_stats table instead.');

  } catch (error) {
    console.error('Error creating tables:', error);
    console.log('\n⚠️  Will use existing player_stats table for NBA data');
  }
}

createNBATables().catch(console.error);