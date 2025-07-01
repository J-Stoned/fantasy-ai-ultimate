-- 🔐 CREATE USER TABLES WITH UUID
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table FIRST (outside of DO block)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    profile_data JSONB DEFAULT '{}'::jsonb
);

-- Now create dependent tables
CREATE TABLE IF NOT EXISTS user_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team_name VARCHAR(100) NOT NULL,
    league_type VARCHAR(50), -- 'standard', 'ppr', 'dynasty'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS user_roster (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_team_id UUID REFERENCES user_teams(id) ON DELETE CASCADE,
    player_id BIGINT REFERENCES players(id),
    acquired_date TIMESTAMPTZ DEFAULT NOW(),
    acquisition_type VARCHAR(50), -- 'draft', 'trade', 'waiver'
    roster_position VARCHAR(20), -- 'starter', 'bench', 'ir'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_team_id UUID REFERENCES user_teams(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- 'add', 'drop', 'trade'
    player_id BIGINT REFERENCES players(id),
    transaction_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_name VARCHAR(100) NOT NULL,
    commissioner_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    settings JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS league_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID REFERENCES user_leagues(id) ON DELETE CASCADE,
    user_team_id UUID REFERENCES user_teams(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    UNIQUE(league_id, user_team_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_teams_user ON user_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roster_team ON user_roster(user_team_id);
CREATE INDEX IF NOT EXISTS idx_user_roster_player ON user_roster(player_id);
CREATE INDEX IF NOT EXISTS idx_user_transactions_team ON user_transactions(user_team_id);
CREATE INDEX IF NOT EXISTS idx_user_transactions_date ON user_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_user_leagues_commissioner ON user_leagues(commissioner_id);
CREATE INDEX IF NOT EXISTS idx_league_members_league ON league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_team ON league_members(user_team_id);

-- Show results
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('users', 'user_teams', 'user_roster', 'user_transactions', 'user_leagues', 'league_members');
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ USER TABLES CREATED SUCCESSFULLY!';
    RAISE NOTICE '===================================';
    RAISE NOTICE '';
    RAISE NOTICE '🔐 Created % user-related tables:', table_count;
    RAISE NOTICE '  • users (UUID primary key)';
    RAISE NOTICE '  • user_teams';
    RAISE NOTICE '  • user_roster';
    RAISE NOTICE '  • user_transactions';
    RAISE NOTICE '  • user_leagues';
    RAISE NOTICE '  • league_members';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Your hybrid schema is complete:';
    RAISE NOTICE '  • Public data uses BIGINT (fast)';
    RAISE NOTICE '  • User data uses UUID (secure)';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Ready for production!';
END $$;

-- Verify the schema
SELECT 
    table_name,
    column_name,
    data_type,
    CASE 
        WHEN column_default LIKE '%uuid%' THEN 'UUID auto-generated'
        WHEN column_default LIKE '%seq%' THEN 'Auto-increment sequence'
        ELSE column_default
    END as id_strategy
FROM information_schema.columns
WHERE table_schema = 'public' 
AND column_name = 'id'
ORDER BY 
    CASE 
        WHEN table_name LIKE 'user%' THEN 1
        WHEN table_name LIKE 'league%' THEN 2
        ELSE 3
    END,
    table_name;