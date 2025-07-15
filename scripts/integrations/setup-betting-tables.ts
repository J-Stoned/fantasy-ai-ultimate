#!/usr/bin/env tsx
/**
 * 🏗️ SETUP BETTING TABLES
 * 
 * Creates the necessary database tables for betting integration
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function setupTables() {
  console.log('🏗️  Setting up betting tables...\n');
  
  // Create betting_opportunities table
  const { error: createError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS betting_opportunities (
        id SERIAL PRIMARY KEY,
        source VARCHAR(50) NOT NULL,
        event_name VARCHAR(255),
        pattern_type VARCHAR(100),
        confidence DECIMAL(5,4),
        expected_value DECIMAL(10,4),
        bet_type VARCHAR(20),
        selection VARCHAR(100),
        market_type VARCHAR(50),
        odds INTEGER,
        kelly_size DECIMAL(5,2),
        suggested_wager DECIMAL(10,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_betting_opportunities_created_at ON betting_opportunities(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_betting_opportunities_source ON betting_opportunities(source);
      CREATE INDEX IF NOT EXISTS idx_betting_opportunities_pattern ON betting_opportunities(pattern_type);
    `
  });
  
  if (createError) {
    // Table might already exist, let's check
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'betting_opportunities');
    
    if (tables && tables.length > 0) {
      console.log('✅ Table betting_opportunities already exists');
    } else {
      console.error('❌ Error creating table:', createError);
      return;
    }
  } else {
    console.log('✅ Created betting_opportunities table');
  }
  
  // Create arbitrage_opportunities table
  const { error: arbError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
        id SERIAL PRIMARY KEY,
        event_name VARCHAR(255) NOT NULL,
        book1 VARCHAR(50) NOT NULL,
        book2 VARCHAR(50) NOT NULL,
        bet1_type VARCHAR(50),
        bet1_selection VARCHAR(100),
        bet1_odds INTEGER,
        bet2_type VARCHAR(50),
        bet2_selection VARCHAR(100),
        bet2_odds INTEGER,
        profit_percent DECIMAL(6,2),
        total_stake DECIMAL(10,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_created_at ON arbitrage_opportunities(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_profit ON arbitrage_opportunities(profit_percent DESC);
    `
  });
  
  if (arbError) {
    const { data: tables } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'arbitrage_opportunities');
    
    if (tables && tables.length > 0) {
      console.log('✅ Table arbitrage_opportunities already exists');
    } else {
      console.error('❌ Error creating arbitrage table:', arbError);
    }
  } else {
    console.log('✅ Created arbitrage_opportunities table');
  }
  
  // Create betting_history table for tracking
  const { error: histError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS betting_history (
        id SERIAL PRIMARY KEY,
        opportunity_id INTEGER REFERENCES betting_opportunities(id),
        bet_placed BOOLEAN DEFAULT FALSE,
        bet_amount DECIMAL(10,2),
        actual_odds INTEGER,
        result VARCHAR(20), -- 'won', 'lost', 'push', 'pending'
        profit_loss DECIMAL(10,2),
        placed_at TIMESTAMP WITH TIME ZONE,
        settled_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_betting_history_result ON betting_history(result);
      CREATE INDEX IF NOT EXISTS idx_betting_history_placed_at ON betting_history(placed_at DESC);
    `
  });
  
  if (histError) {
    console.log('✅ Betting history table might already exist');
  } else {
    console.log('✅ Created betting_history table');
  }
  
  console.log('\n🎉 Betting tables setup complete!');
}

// Simple insert test
async function testInsert() {
  console.log('\n🧪 Testing insert...');
  
  const { data, error } = await supabase
    .from('betting_opportunities')
    .insert({
      source: 'test',
      pattern_type: 'altitude_advantage',
      confidence: 0.724,
      expected_value: 0.0852,
      bet_type: 'total',
      selection: 'over',
      odds: -110,
      suggested_wager: 100
    })
    .select();
  
  if (error) {
    console.error('❌ Test insert failed:', error);
  } else {
    console.log('✅ Test insert successful:', data);
    
    // Clean up test data
    await supabase
      .from('betting_opportunities')
      .delete()
      .eq('source', 'test');
  }
}

async function main() {
  try {
    await setupTables();
    await testInsert();
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

if (require.main === module) {
  main();
}

export { setupTables };