#!/usr/bin/env tsx
/**
 * 🏗️ PROPER BETTING TABLES SETUP
 * 
 * This script outputs the EXACT SQL needed to create betting tables
 * Copy and paste this SQL into your Supabase SQL editor
 */

import * as dotenv from 'dotenv';
dotenv.config();

const BETTING_TABLES_SQL = `
-- ============================================
-- BETTING INTEGRATION TABLES
-- ============================================
-- Copy and run this entire SQL block in Supabase SQL editor

-- 1. Betting Opportunities Table
-- Stores pattern-based betting opportunities from our analysis
CREATE TABLE IF NOT EXISTS betting_opportunities (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL, -- 'draftkings', 'fanduel', etc.
  event_name VARCHAR(255),
  pattern_type VARCHAR(100), -- 'back_to_back_fade', 'altitude_advantage', etc.
  confidence DECIMAL(5,4), -- Pattern confidence (0.0000 to 1.0000)
  expected_value DECIMAL(10,4), -- Expected value percentage
  bet_type VARCHAR(20), -- 'spread', 'total', 'moneyline'
  selection VARCHAR(100), -- 'home', 'away', 'over', 'under'
  market_type VARCHAR(50),
  odds INTEGER, -- American odds format
  kelly_size DECIMAL(5,2), -- Recommended bet size as % of bankroll
  suggested_wager DECIMAL(10,2), -- Dollar amount
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_betting_opportunities_created_at 
  ON betting_opportunities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_betting_opportunities_source 
  ON betting_opportunities(source);
CREATE INDEX IF NOT EXISTS idx_betting_opportunities_pattern 
  ON betting_opportunities(pattern_type);
CREATE INDEX IF NOT EXISTS idx_betting_opportunities_ev 
  ON betting_opportunities(expected_value DESC);

-- 2. Arbitrage Opportunities Table
-- Stores risk-free arbitrage opportunities between sportsbooks
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
  id SERIAL PRIMARY KEY,
  event_name VARCHAR(255) NOT NULL,
  sport VARCHAR(50),
  book1 VARCHAR(50) NOT NULL, -- First sportsbook
  book2 VARCHAR(50) NOT NULL, -- Second sportsbook
  bet1_type VARCHAR(50), -- Type of bet at book1
  bet1_selection VARCHAR(100), -- Selection at book1
  bet1_odds INTEGER, -- Odds at book1
  bet2_type VARCHAR(50), -- Type of bet at book2
  bet2_selection VARCHAR(100), -- Selection at book2
  bet2_odds INTEGER, -- Odds at book2
  profit_percent DECIMAL(6,2), -- Guaranteed profit percentage
  total_stake DECIMAL(10,2), -- Total amount to bet
  book1_stake DECIMAL(10,2), -- Amount to bet at book1
  book2_stake DECIMAL(10,2), -- Amount to bet at book2
  expires_at TIMESTAMP WITH TIME ZONE, -- When the opportunity expires
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_created_at 
  ON arbitrage_opportunities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_profit 
  ON arbitrage_opportunities(profit_percent DESC);

-- 3. Betting History Table
-- Tracks actual bets placed and their outcomes
CREATE TABLE IF NOT EXISTS betting_history (
  id SERIAL PRIMARY KEY,
  opportunity_id INTEGER REFERENCES betting_opportunities(id),
  user_id UUID, -- Optional: link to users table
  bet_placed BOOLEAN DEFAULT FALSE,
  bet_amount DECIMAL(10,2),
  actual_odds INTEGER,
  sportsbook VARCHAR(50),
  bet_slip_id VARCHAR(255), -- Reference from sportsbook
  result VARCHAR(20), -- 'won', 'lost', 'push', 'pending', 'cancelled'
  profit_loss DECIMAL(10,2),
  placed_at TIMESTAMP WITH TIME ZONE,
  settled_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_betting_history_result 
  ON betting_history(result);
CREATE INDEX IF NOT EXISTS idx_betting_history_placed_at 
  ON betting_history(placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_betting_history_user 
  ON betting_history(user_id);

-- 4. Bankroll Management Table
-- Tracks bankroll over time
CREATE TABLE IF NOT EXISTS bankroll_management (
  id SERIAL PRIMARY KEY,
  user_id UUID,
  starting_balance DECIMAL(10,2) NOT NULL,
  current_balance DECIMAL(10,2) NOT NULL,
  total_deposited DECIMAL(10,2) DEFAULT 0,
  total_withdrawn DECIMAL(10,2) DEFAULT 0,
  total_wagered DECIMAL(10,2) DEFAULT 0,
  total_profit_loss DECIMAL(10,2) DEFAULT 0,
  roi_percent DECIMAL(6,2) DEFAULT 0,
  kelly_fraction DECIMAL(4,2) DEFAULT 0.25, -- Fractional Kelly (25% default)
  max_bet_percent DECIMAL(4,2) DEFAULT 5.00, -- Max 5% per bet
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Live Odds Cache Table
-- Caches live odds for fast access
CREATE TABLE IF NOT EXISTS live_odds_cache (
  id SERIAL PRIMARY KEY,
  event_id VARCHAR(255) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  sport VARCHAR(50),
  sportsbook VARCHAR(50) NOT NULL,
  market_type VARCHAR(50), -- 'spread', 'total', 'moneyline'
  home_line DECIMAL(5,1),
  away_line DECIMAL(5,1),
  home_odds INTEGER,
  away_odds INTEGER,
  over_line DECIMAL(5,1),
  under_line DECIMAL(5,1),
  over_odds INTEGER,
  under_odds INTEGER,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_odds_cache_event 
  ON live_odds_cache(event_id, sportsbook);
CREATE INDEX IF NOT EXISTS idx_live_odds_cache_expires 
  ON live_odds_cache(expires_at);

-- Enable Row Level Security
ALTER TABLE betting_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE arbitrage_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE betting_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE bankroll_management ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_odds_cache ENABLE ROW LEVEL SECURITY;

-- Create basic policies (adjust based on your auth setup)
CREATE POLICY "Public read betting opportunities" 
  ON betting_opportunities FOR SELECT USING (true);
  
CREATE POLICY "Public read arbitrage opportunities" 
  ON arbitrage_opportunities FOR SELECT USING (true);
  
CREATE POLICY "Users manage own betting history" 
  ON betting_history FOR ALL 
  USING (auth.uid() = user_id OR user_id IS NULL);
  
CREATE POLICY "Users manage own bankroll" 
  ON bankroll_management FOR ALL 
  USING (auth.uid() = user_id);
  
CREATE POLICY "Public read odds cache" 
  ON live_odds_cache FOR SELECT USING (true);

-- Create update timestamp function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers
CREATE TRIGGER update_betting_opportunities_updated_at 
  BEFORE UPDATE ON betting_opportunities 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
CREATE TRIGGER update_bankroll_management_updated_at 
  BEFORE UPDATE ON bankroll_management 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- END OF BETTING TABLES SETUP
-- ============================================
`;

console.log('📋 BETTING TABLES SQL SETUP');
console.log('=' .repeat(80));
console.log('\n1. Copy the SQL below');
console.log('2. Go to your Supabase dashboard');
console.log('3. Navigate to SQL Editor');
console.log('4. Paste and run the entire script');
console.log('5. All betting tables will be created with proper indexes and RLS\n');
console.log('=' .repeat(80));
console.log(BETTING_TABLES_SQL);
console.log('=' .repeat(80));
console.log('\n✅ After running this SQL, your betting integration will be fully functional!');
console.log('\n🎯 Tables created:');
console.log('  - betting_opportunities: Store pattern-based plays');
console.log('  - arbitrage_opportunities: Store risk-free arbs');
console.log('  - betting_history: Track actual bets and results');
console.log('  - bankroll_management: Manage betting bankroll');
console.log('  - live_odds_cache: Cache odds for performance\n');