-- 🔍 FIRST, LET'S SEE WHAT COLUMNS WE HAVE
-- Run this in Supabase SQL Editor

-- Show current columns in each table
SELECT 
    t.table_name,
    array_agg(c.column_name ORDER BY c.ordinal_position) as columns
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public' 
AND t.table_name IN ('players', 'games', 'player_stats', 'news_articles', 'teams')
GROUP BY t.table_name
ORDER BY t.table_name;

-- Now let's safely add columns one by one
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔧 ADDING FANTASY COLUMNS SAFELY...';
    RAISE NOTICE '===================================';
END $$;

-- ========================================
-- PLAYERS TABLE - Add Fantasy Columns
-- ========================================
DO $$ 
BEGIN
    RAISE NOTICE 'Working on PLAYERS table...';
    
    -- Check each column and add if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='adp') THEN
        ALTER TABLE players ADD COLUMN adp DECIMAL(5,2) DEFAULT 999;
        RAISE NOTICE '  ✅ Added adp column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='fantasy_ownership') THEN
        ALTER TABLE players ADD COLUMN fantasy_ownership DECIMAL(5,2) DEFAULT 0;
        RAISE NOTICE '  ✅ Added fantasy_ownership column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='bye_week') THEN
        ALTER TABLE players ADD COLUMN bye_week INTEGER;
        RAISE NOTICE '  ✅ Added bye_week column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='injury_status') THEN
        ALTER TABLE players ADD COLUMN injury_status VARCHAR(50);
        RAISE NOTICE '  ✅ Added injury_status column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='projected_points_week') THEN
        ALTER TABLE players ADD COLUMN projected_points_week DECIMAL(6,2);
        RAISE NOTICE '  ✅ Added projected_points_week column';
    END IF;
END $$;

-- ========================================
-- PLAYER_STATS TABLE - Check what exists first
-- ========================================
DO $$ 
DECLARE
    col_exists boolean;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Working on PLAYER_STATS table...';
    
    -- First check if the table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='player_stats') THEN
        -- Check if season column exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='player_stats' AND column_name='season'
        ) INTO col_exists;
        
        IF NOT col_exists THEN
            ALTER TABLE player_stats ADD COLUMN season INTEGER;
            RAISE NOTICE '  ✅ Added season column';
        END IF;
        
        -- Check if week column exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='player_stats' AND column_name='week'
        ) INTO col_exists;
        
        IF NOT col_exists THEN
            ALTER TABLE player_stats ADD COLUMN week INTEGER;
            RAISE NOTICE '  ✅ Added week column';
        END IF;
        
        -- Add fantasy points columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='fantasy_points') THEN
            ALTER TABLE player_stats ADD COLUMN fantasy_points DECIMAL(6,2);
            RAISE NOTICE '  ✅ Added fantasy_points column';
        END IF;
        
        -- Add basic stat columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='passing_yards') THEN
            ALTER TABLE player_stats ADD COLUMN passing_yards INTEGER;
            RAISE NOTICE '  ✅ Added passing_yards column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='rushing_yards') THEN
            ALTER TABLE player_stats ADD COLUMN rushing_yards INTEGER;
            RAISE NOTICE '  ✅ Added rushing_yards column';
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='receiving_yards') THEN
            ALTER TABLE player_stats ADD COLUMN receiving_yards INTEGER;
            RAISE NOTICE '  ✅ Added receiving_yards column';
        END IF;
        
    ELSE
        RAISE NOTICE '  ⚠️ player_stats table does not exist!';
    END IF;
END $$;

-- ========================================
-- GAMES TABLE - Add Missing Columns
-- ========================================
DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Working on GAMES table...';
    
    -- Check what the actual column names are
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='home_team_id') THEN
        RAISE NOTICE '  ✓ Found home_team_id column';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='home_team') THEN
        RAISE NOTICE '  ⚠️ Column is named home_team (not home_team_id)';
    END IF;
    
    -- Add season column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='season') THEN
        ALTER TABLE games ADD COLUMN season INTEGER;
        RAISE NOTICE '  ✅ Added season column';
    END IF;
    
    -- Add week column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='week') THEN
        ALTER TABLE games ADD COLUMN week INTEGER;
        RAISE NOTICE '  ✅ Added week column';
    END IF;
    
    -- Add weather column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='weather') THEN
        ALTER TABLE games ADD COLUMN weather VARCHAR(50);
        RAISE NOTICE '  ✅ Added weather column';
    END IF;
END $$;

-- ========================================
-- Create Simple Fantasy Tables
-- ========================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Creating new fantasy tables...';
    
    -- Fantasy Projections (simplified)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='fantasy_projections') THEN
        CREATE TABLE fantasy_projections (
            id SERIAL PRIMARY KEY,
            player_id INTEGER REFERENCES players(id),
            week INTEGER,
            projected_points DECIMAL(6,2),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE '  ✅ Created fantasy_projections table';
    END IF;
    
    -- Player Rankings (simplified)
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='player_rankings') THEN
        CREATE TABLE player_rankings (
            id SERIAL PRIMARY KEY,
            player_id INTEGER REFERENCES players(id),
            week INTEGER,
            rank INTEGER,
            position_rank INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
        RAISE NOTICE '  ✅ Created player_rankings table';
    END IF;
END $$;

-- ========================================
-- Show Final Status
-- ========================================
DO $$
DECLARE
    player_cols INTEGER;
    game_cols INTEGER;
    stat_cols INTEGER;
BEGIN
    -- Count columns in each table
    SELECT COUNT(*) INTO player_cols 
    FROM information_schema.columns 
    WHERE table_name = 'players';
    
    SELECT COUNT(*) INTO game_cols 
    FROM information_schema.columns 
    WHERE table_name = 'games';
    
    SELECT COUNT(*) INTO stat_cols 
    FROM information_schema.columns 
    WHERE table_name = 'player_stats';
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ FANTASY COLUMNS ADDED!';
    RAISE NOTICE '========================';
    RAISE NOTICE 'Table column counts:';
    RAISE NOTICE '  players: % columns', player_cols;
    RAISE NOTICE '  games: % columns', game_cols;
    RAISE NOTICE '  player_stats: % columns', COALESCE(stat_cols, 0);
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Ready for data loading!';
END $$;

-- Show the updated schema
SELECT 
    t.table_name,
    COUNT(c.column_name) as column_count,
    string_agg(c.column_name, ', ' ORDER BY c.ordinal_position) as columns
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public' 
AND t.table_name IN ('players', 'games', 'player_stats', 'news_articles')
GROUP BY t.table_name
ORDER BY t.table_name;