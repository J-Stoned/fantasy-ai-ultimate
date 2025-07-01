-- 🚀 STEP 1: Fix ID overflow for existing tables
-- Run this FIRST in Supabase SQL Editor

-- ========================================
-- Convert existing tables to BIGINT
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
    ELSE
        RAISE NOTICE '✓ Players: Already BIGINT';
    END IF;
    
    -- Games table  
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'games' AND column_name = 'id' 
               AND data_type = 'integer') THEN
        ALTER TABLE games ALTER COLUMN id TYPE BIGINT;
        RAISE NOTICE '✅ Games: ID converted to BIGINT';
    ELSE
        RAISE NOTICE '✓ Games: Already BIGINT';
    END IF;
    
    -- News articles table
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'news_articles' AND column_name = 'id' 
               AND data_type = 'integer') THEN
        ALTER TABLE news_articles ALTER COLUMN id TYPE BIGINT;
        RAISE NOTICE '✅ News Articles: ID converted to BIGINT';
    ELSE
        RAISE NOTICE '✓ News Articles: Already BIGINT';
    END IF;
    
    -- Teams table
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'teams' AND column_name = 'id' 
               AND data_type = 'integer') THEN
        ALTER TABLE teams ALTER COLUMN id TYPE BIGINT;
        RAISE NOTICE '✅ Teams: ID converted to BIGINT';
    ELSE
        RAISE NOTICE '✓ Teams: Already BIGINT';
    END IF;
END $$;

-- ========================================
-- Create sequences for auto-increment
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
    
    -- Drop existing sequences if they exist
    DROP SEQUENCE IF EXISTS players_id_seq CASCADE;
    DROP SEQUENCE IF EXISTS games_id_seq CASCADE;
    DROP SEQUENCE IF EXISTS news_articles_id_seq CASCADE;
    
    -- Create new sequences starting after current max
    EXECUTE format('CREATE SEQUENCE players_id_seq START %s', max_player_id + 1);
    EXECUTE format('CREATE SEQUENCE games_id_seq START %s', max_game_id + 1);
    EXECUTE format('CREATE SEQUENCE news_articles_id_seq START %s', max_news_id + 1);
    
    -- Set defaults to use sequences
    ALTER TABLE players ALTER COLUMN id SET DEFAULT nextval('players_id_seq');
    ALTER TABLE games ALTER COLUMN id SET DEFAULT nextval('games_id_seq');
    ALTER TABLE news_articles ALTER COLUMN id SET DEFAULT nextval('news_articles_id_seq');
    
    RAISE NOTICE '✅ Auto-increment sequences created';
    RAISE NOTICE '  • players_id_seq starts at: %', max_player_id + 1;
    RAISE NOTICE '  • games_id_seq starts at: %', max_game_id + 1;
    RAISE NOTICE '  • news_articles_id_seq starts at: %', max_news_id + 1;
END $$;

-- ========================================
-- Show results
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
    RAISE NOTICE '✅ STEP 1 COMPLETE!';
    RAISE NOTICE '==================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Your data tables now support infinite growth:';
    RAISE NOTICE '  • Players: % records (BIGINT)', player_count;
    RAISE NOTICE '  • Games: % records (BIGINT)', game_count;
    RAISE NOTICE '  • News: % records (BIGINT)', news_count;
    RAISE NOTICE '';
    RAISE NOTICE '🚀 The infinite loader can now run forever!';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Run fix-id-overflow-step2.sql for user tables';
END $$;

-- Verify the changes
SELECT 
    table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name IN ('players', 'games', 'news_articles')
AND column_name = 'id'
ORDER BY table_name;