-- 🚀 HYBRID ID STRATEGY FOR FANTASY AI ULTIMATE
-- Public data: BIGINT for performance
-- User data: UUID for security
-- Run this in Supabase SQL Editor

-- ========================================
-- STEP 1: Fix existing tables with BIGINT
-- ========================================
DO $$
BEGIN
    RAISE NOTICE '🔧 Converting public data tables to BIGINT...';
    
    -- Players table
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'players' AND column_name = 'id' 
               AND data_type = 'integer') THEN
        ALTER TABLE players ALTER COLUMN id TYPE BIGINT;
        RAISE NOTICE '✅ Players: ID converted to BIGINT';
    END IF;
    
    -- Games table  
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'games' AND column_name = 'id' 
               AND data_type = 'integer') THEN
        ALTER TABLE games ALTER COLUMN id TYPE BIGINT;
        RAISE NOTICE '✅ Games: ID converted to BIGINT';
    END IF;
    
    -- News articles table
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'news_articles' AND column_name = 'id' 
               AND data_type = 'integer') THEN
        ALTER TABLE news_articles ALTER COLUMN id TYPE BIGINT;
        RAISE NOTICE '✅ News Articles: ID converted to BIGINT';
    END IF;
    
    -- Teams table
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'teams' AND column_name = 'id' 
               AND data_type = 'integer') THEN
        ALTER TABLE teams ALTER COLUMN id TYPE BIGINT;
        RAISE NOTICE '✅ Teams: ID converted to BIGINT';
    END IF;
    
    -- Player stats (if exists)
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_name = 'player_stats') THEN
        ALTER TABLE player_stats ALTER COLUMN id TYPE BIGINT;
        RAISE NOTICE '✅ Player Stats: ID converted to BIGINT';
    END IF;
END $$;

-- ========================================
-- STEP 2: Create sequences for auto-increment
-- ========================================
DO $$
DECLARE
    max_player_id BIGINT;
    max_game_id BIGINT;
    max_news_id BIGINT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Setting up auto-increment sequences...';
    
    -- Get current max IDs
    SELECT COALESCE(MAX(id), 2000000) INTO max_player_id FROM players;
    SELECT COALESCE(MAX(id), 2000000) INTO max_game_id FROM games;
    SELECT COALESCE(MAX(id), 2000000) INTO max_news_id FROM news_articles;
    
    -- Create sequences starting after current max
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS players_id_seq START %s', max_player_id + 1);
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS games_id_seq START %s', max_game_id + 1);
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS news_articles_id_seq START %s', max_news_id + 1);
    
    -- Set defaults to use sequences
    ALTER TABLE players ALTER COLUMN id SET DEFAULT nextval('players_id_seq');
    ALTER TABLE games ALTER COLUMN id SET DEFAULT nextval('games_id_seq');
    ALTER TABLE news_articles ALTER COLUMN id SET DEFAULT nextval('news_articles_id_seq');
    
    RAISE NOTICE '✅ Auto-increment sequences created';
END $$;

-- ========================================
-- STEP 3: Enable UUID extension
-- ========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- STEP 4: Create user-related tables with UUID
-- ========================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔐 Creating secure user tables with UUID...';
    
    -- Users table
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
    END IF;
    
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
        RAISE NOTICE '✅ Created user_roster table with UUID';
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
        RAISE NOTICE '✅ Created user_transactions table with UUID';
    END IF;
END $$;

-- ========================================
-- STEP 5: Add RLS policies for user tables
-- ========================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔒 Setting up Row Level Security...';
    
    -- Enable RLS on user tables
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_teams ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_roster ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_transactions ENABLE ROW LEVEL SECURITY;
    
    -- Create basic policies (you'll expand these later)
    CREATE POLICY "Users can view own profile" ON users
        FOR SELECT USING (auth.uid() = id);
    
    CREATE POLICY "Users can update own profile" ON users
        FOR UPDATE USING (auth.uid() = id);
    
    CREATE POLICY "Users can view own teams" ON user_teams
        FOR SELECT USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can manage own teams" ON user_teams
        FOR ALL USING (auth.uid() = user_id);
    
    RAISE NOTICE '✅ RLS policies created';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️  RLS policies may need auth setup first';
END $$;

-- ========================================
-- STEP 6: Show final status
-- ========================================
DO $$
DECLARE
    player_count BIGINT;
    game_count BIGINT;
    news_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO player_count FROM players;
    SELECT COUNT(*) INTO game_count FROM games;
    SELECT COUNT(*) INTO news_count FROM news_articles;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 HYBRID ID STRATEGY IMPLEMENTED!';
    RAISE NOTICE '===================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Public Data (BIGINT IDs):';
    RAISE NOTICE '  • Players: % records', player_count;
    RAISE NOTICE '  • Games: % records', game_count;
    RAISE NOTICE '  • News: % records', news_count;
    RAISE NOTICE '';
    RAISE NOTICE '🔐 User Data (UUID IDs):';
    RAISE NOTICE '  • users table ready';
    RAISE NOTICE '  • user_teams table ready';
    RAISE NOTICE '  • user_roster table ready';
    RAISE NOTICE '  • user_transactions table ready';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Your collectors can now run forever!';
    RAISE NOTICE '✅ User data is secure with UUIDs!';
END $$;

-- Show the new schema
SELECT 
    table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name IN ('players', 'games', 'news_articles', 'users', 'user_teams')
AND column_name = 'id'
ORDER BY table_name;