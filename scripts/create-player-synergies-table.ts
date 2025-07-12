#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import chalk from 'chalk'

config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function createTable() {
  console.log(chalk.cyan.bold('\n📊 Creating Player Synergies Table\n'))
  
  // Create the table
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS player_synergies (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        player1_id INTEGER NOT NULL,
        player2_id INTEGER NOT NULL,
        synergy_type TEXT NOT NULL DEFAULT 'offensive',
        synergy_score FLOAT NOT NULL,
        games_together INTEGER NOT NULL DEFAULT 0,
        total_fantasy_points FLOAT,
        sample_size INTEGER,
        season INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT unique_player_pair_season UNIQUE(player1_id, player2_id, season)
      );
      
      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_synergies_player1 ON player_synergies(player1_id);
      CREATE INDEX IF NOT EXISTS idx_synergies_player2 ON player_synergies(player2_id);
      CREATE INDEX IF NOT EXISTS idx_synergies_score ON player_synergies(synergy_score DESC);
      CREATE INDEX IF NOT EXISTS idx_synergies_games ON player_synergies(games_together DESC);
    `
  })
  
  if (error) {
    console.error(chalk.red('Error creating table:'), error)
    
    // Try a simpler approach
    console.log(chalk.yellow('\nTrying direct SQL...'))
    
    // Note: This won't work directly through Supabase client
    // You'll need to run this SQL in the Supabase dashboard
    console.log(chalk.cyan('\nPlease run this SQL in your Supabase SQL Editor:\n'))
    console.log(chalk.white(`
CREATE TABLE IF NOT EXISTS player_synergies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player1_id INTEGER NOT NULL,
  player2_id INTEGER NOT NULL,
  synergy_type TEXT NOT NULL DEFAULT 'offensive',
  synergy_score FLOAT NOT NULL,
  games_together INTEGER NOT NULL DEFAULT 0,
  total_fantasy_points FLOAT,
  sample_size INTEGER,
  season INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_player_pair_season UNIQUE(player1_id, player2_id, season)
);

CREATE INDEX IF NOT EXISTS idx_synergies_player1 ON player_synergies(player1_id);
CREATE INDEX IF NOT EXISTS idx_synergies_player2 ON player_synergies(player2_id);
CREATE INDEX IF NOT EXISTS idx_synergies_score ON player_synergies(synergy_score DESC);
CREATE INDEX IF NOT EXISTS idx_synergies_games ON player_synergies(games_together DESC);
    `))
  } else {
    console.log(chalk.green('✅ Table created successfully!'))
    
    // Test insert
    const { error: insertError } = await supabase
      .from('player_synergies')
      .insert({
        player1_id: 1,
        player2_id: 2,
        synergy_score: 25.5,
        games_together: 10,
        season: 2024
      })
    
    if (insertError) {
      console.error(chalk.red('Test insert failed:'), insertError)
    } else {
      console.log(chalk.green('✅ Test insert successful!'))
    }
  }
}

createTable().catch(console.error)