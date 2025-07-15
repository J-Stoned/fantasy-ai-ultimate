-- Create betting_opportunities table for tracking pattern-based betting opportunities
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_betting_opportunities_created_at ON betting_opportunities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_betting_opportunities_source ON betting_opportunities(source);
CREATE INDEX IF NOT EXISTS idx_betting_opportunities_pattern ON betting_opportunities(pattern_type);

-- Create arbitrage_opportunities table
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

-- Create betting_history table for tracking actual bets
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

-- Enable RLS
ALTER TABLE betting_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE arbitrage_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE betting_history ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now, tighten in production)
CREATE POLICY "Allow all betting_opportunities" ON betting_opportunities FOR ALL USING (true);
CREATE POLICY "Allow all arbitrage_opportunities" ON arbitrage_opportunities FOR ALL USING (true);
CREATE POLICY "Allow all betting_history" ON betting_history FOR ALL USING (true);