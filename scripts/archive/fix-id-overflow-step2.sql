-- 🔐 STEP 2: Create secure user tables with UUID
-- Run this AFTER step 1 in Supabase SQL Editor

-- ========================================
-- Enable UUID extension
-- ========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- Create users table FIRST
-- ========================================
DO $$
BEGIN
    RAISE NOTICE '🔐 Creating secure user tables...';
    
    -- Create users table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        CREATE TABLE users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            username VARCHAR(100) UNIQUE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            is_active BOOLEAN DEFAULT true,
            profile_data JSONB DEFAULT '{}'::jsonb
        );
        RAISE NOTICE '✅ Created users table with UUID';
    ELSE
        RAISE NOTICE '✓ Users table already exists';
    END IF;
END $$;

-- ========================================
-- Create related user tables
-- ========================================
DO $$
BEGIN
    -- User teams table
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_teams') THEN
        CREATE TABLE user_teams (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            team_name VARCHAR(100) NOT NULL,
            league_type VARCHAR(50), -- 'standard', 'ppr', 'dynasty'
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            is_active BOOLEAN DEFAULT true,
            settings JSONB DEFAULT '{}'::jsonb
        );
        CREATE INDEX idx_user_teams_user ON user_teams(user_id);
        RAISE NOTICE '✅ Created user_teams table with UUID';
    ELSE
        RAISE NOTICE '✓ User_teams table already exists';
    END IF;
    
    -- User roster (links users to players)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_roster') THEN
        CREATE TABLE user_roster (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_team_id UUID REFERENCES user_teams(id) ON DELETE CASCADE,
            player_id BIGINT REFERENCES players(id),
            acquired_date TIMESTAMPTZ DEFAULT NOW(),
            acquisition_type VARCHAR(50), -- 'draft', 'trade', 'waiver'
            roster_position VARCHAR(20), -- 'starter', 'bench', 'ir'
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX idx_user_roster_team ON user_roster(user_team_id);
        CREATE INDEX idx_user_roster_player ON user_roster(player_id);
        RAISE NOTICE '✅ Created user_roster table (links to BIGINT player IDs)';
    ELSE
        RAISE NOTICE '✓ User_roster table already exists';
    END IF;
    
    -- User transactions
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_transactions') THEN
        CREATE TABLE user_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_team_id UUID REFERENCES user_teams(id) ON DELETE CASCADE,
            transaction_type VARCHAR(50) NOT NULL, -- 'add', 'drop', 'trade'
            player_id BIGINT REFERENCES players(id),
            transaction_data JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX idx_user_transactions_team ON user_transactions(user_team_id);
        CREATE INDEX idx_user_transactions_date ON user_transactions(created_at);
        RAISE NOTICE '✅ Created user_transactions table';
    ELSE
        RAISE NOTICE '✓ User_transactions table already exists';
    END IF;
    
    -- User leagues
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_leagues') THEN
        CREATE TABLE user_leagues (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            league_name VARCHAR(100) NOT NULL,
            commissioner_id UUID REFERENCES users(id),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            settings JSONB DEFAULT '{}'::jsonb,
            is_active BOOLEAN DEFAULT true
        );
        CREATE INDEX idx_user_leagues_commissioner ON user_leagues(commissioner_id);
        RAISE NOTICE '✅ Created user_leagues table';
    ELSE
        RAISE NOTICE '✓ User_leagues table already exists';
    END IF;
    
    -- League members
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'league_members') THEN
        CREATE TABLE league_members (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            league_id UUID REFERENCES user_leagues(id) ON DELETE CASCADE,
            user_team_id UUID REFERENCES user_teams(id) ON DELETE CASCADE,
            joined_at TIMESTAMPTZ DEFAULT NOW(),
            is_active BOOLEAN DEFAULT true,
            UNIQUE(league_id, user_team_id)
        );
        CREATE INDEX idx_league_members_league ON league_members(league_id);
        CREATE INDEX idx_league_members_team ON league_members(user_team_id);
        RAISE NOTICE '✅ Created league_members table';
    ELSE
        RAISE NOTICE '✓ League_members table already exists';
    END IF;
END $$;

-- ========================================
-- Final summary
-- ========================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 HYBRID ID STRATEGY COMPLETE!';
    RAISE NOTICE '===============================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Public Data Tables (BIGINT - fast & efficient):';
    RAISE NOTICE '  ✓ players - Can store 9 quintillion records';
    RAISE NOTICE '  ✓ games - Auto-incrementing IDs';
    RAISE NOTICE '  ✓ news_articles - No more overflow errors';
    RAISE NOTICE '';
    RAISE NOTICE '🔐 User Data Tables (UUID - secure & private):';
    RAISE NOTICE '  ✓ users - Impossible to enumerate';
    RAISE NOTICE '  ✓ user_teams - Hidden user counts';
    RAISE NOTICE '  ✓ user_roster - Links users to players';
    RAISE NOTICE '  ✓ user_transactions - Secure activity logs';
    RAISE NOTICE '  ✓ user_leagues - Private league data';
    RAISE NOTICE '  ✓ league_members - Secure associations';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Your infinite loader can now run forever!';
    RAISE NOTICE '✅ User data is secure with UUIDs!';
    RAISE NOTICE '';
    RAISE NOTICE 'Ready to start the infinite loader!';
END $$;

-- Show the final schema
SELECT 
    table_name,
    column_name,
    data_type,
    CASE 
        WHEN column_default LIKE '%uuid%' THEN 'UUID auto-generated'
        WHEN column_default LIKE '%seq%' THEN 'Auto-increment sequence'
        ELSE column_default
    END as id_generation
FROM information_schema.columns
WHERE table_schema = 'public' 
AND column_name = 'id'
AND table_name IN ('players', 'games', 'news_articles', 'users', 'user_teams', 'user_roster')
ORDER BY 
    CASE 
        WHEN data_type = 'bigint' THEN 1
        WHEN data_type = 'uuid' THEN 2
        ELSE 3
    END,
    table_name;