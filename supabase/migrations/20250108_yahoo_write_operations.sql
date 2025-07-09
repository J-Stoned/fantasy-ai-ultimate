-- Add new columns to platform_connections for write operations
ALTER TABLE platform_connections 
ADD COLUMN IF NOT EXISTS scopes TEXT,
ADD COLUMN IF NOT EXISTS lastWriteAt TIMESTAMP WITH TIME ZONE;

-- Create table for tracking Yahoo transactions
CREATE TABLE IF NOT EXISTS yahoo_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  league_key VARCHAR(255) NOT NULL,
  team_key VARCHAR(255) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'add', 'drop', 'add_drop', 'trade'
  players JSONB NOT NULL,
  response_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for tracking lineup changes
CREATE TABLE IF NOT EXISTS fantasy_lineup_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  league_id VARCHAR(255) NOT NULL,
  team_key VARCHAR(255) NOT NULL,
  changes JSONB NOT NULL,
  coverage_type VARCHAR(20) NOT NULL, -- 'week' or 'date'
  coverage_value VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create table for general fantasy transactions
CREATE TABLE IF NOT EXISTS fantasy_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  league_key VARCHAR(255) NOT NULL,
  team_key VARCHAR(255) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,
  transaction_data JSONB NOT NULL,
  transaction_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_yahoo_transactions_user_id ON yahoo_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_yahoo_transactions_league_key ON yahoo_transactions(league_key);
CREATE INDEX IF NOT EXISTS idx_yahoo_transactions_created_at ON yahoo_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fantasy_lineup_changes_user_id ON fantasy_lineup_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineup_changes_platform ON fantasy_lineup_changes(platform);
CREATE INDEX IF NOT EXISTS idx_fantasy_lineup_changes_created_at ON fantasy_lineup_changes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_user_id ON fantasy_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_platform ON fantasy_transactions(platform);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_status ON fantasy_transactions(status);
CREATE INDEX IF NOT EXISTS idx_fantasy_transactions_created_at ON fantasy_transactions(created_at DESC);

-- Update platform_connections to set default scopes for Yahoo
UPDATE platform_connections 
SET scopes = 'fspt-w' 
WHERE platform = 'yahoo' AND scopes IS NULL;