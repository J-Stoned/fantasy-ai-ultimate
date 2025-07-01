-- 🔥 SAFE VERSION - Checks for existing columns first! 🔥
-- Run this in Supabase SQL Editor

-- First, let's see what columns already exist
DO $$
BEGIN
    RAISE NOTICE 'Starting fantasy column additions...';
END $$;

-- ========================================
-- 1. ENHANCE PLAYERS TABLE
-- ========================================
-- Check and add each column individually
DO $$ 
BEGIN
    -- Add fantasy points columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='fantasy_points_2023') THEN
        ALTER TABLE players ADD COLUMN fantasy_points_2023 DECIMAL(8,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='fantasy_points_2024') THEN
        ALTER TABLE players ADD COLUMN fantasy_points_2024 DECIMAL(8,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='adp') THEN
        ALTER TABLE players ADD COLUMN adp DECIMAL(5,2) DEFAULT 999;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='fantasy_ownership') THEN
        ALTER TABLE players ADD COLUMN fantasy_ownership DECIMAL(5,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='bye_week') THEN
        ALTER TABLE players ADD COLUMN bye_week INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='injury_status') THEN
        ALTER TABLE players ADD COLUMN injury_status VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='projected_points_week') THEN
        ALTER TABLE players ADD COLUMN projected_points_week DECIMAL(6,2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='salary_dk') THEN
        ALTER TABLE players ADD COLUMN salary_dk INTEGER;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='players' AND column_name='salary_fd') THEN
        ALTER TABLE players ADD COLUMN salary_fd INTEGER;
    END IF;
    
    RAISE NOTICE 'Players table columns added successfully';
END $$;

-- ========================================
-- 2. ENHANCE GAMES TABLE
-- ========================================
DO $$ 
BEGIN
    -- Check what columns exist first
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='home_team_id') THEN
        RAISE NOTICE 'Warning: games table might have different column names';
    END IF;
    
    -- Add season if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='season') THEN
        ALTER TABLE games ADD COLUMN season INTEGER;
        RAISE NOTICE 'Added season column to games table';
    END IF;
    
    -- Add week if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='week') THEN
        ALTER TABLE games ADD COLUMN week INTEGER;
        RAISE NOTICE 'Added week column to games table';
    END IF;
    
    -- Add other columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='weather_conditions') THEN
        ALTER TABLE games ADD COLUMN weather_conditions VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='betting_total') THEN
        ALTER TABLE games ADD COLUMN betting_total DECIMAL(5,1);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='betting_line') THEN
        ALTER TABLE games ADD COLUMN betting_line DECIMAL(4,1);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='games' AND column_name='primetime') THEN
        ALTER TABLE games ADD COLUMN primetime BOOLEAN DEFAULT FALSE;
    END IF;
    
    RAISE NOTICE 'Games table columns added successfully';
END $$;

-- ========================================
-- 3. ENHANCE PLAYER_STATS TABLE
-- ========================================
DO $$ 
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='player_stats') THEN
        -- Add fantasy points columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='fantasy_points') THEN
            ALTER TABLE player_stats ADD COLUMN fantasy_points DECIMAL(6,2);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='fantasy_points_ppr') THEN
            ALTER TABLE player_stats ADD COLUMN fantasy_points_ppr DECIMAL(6,2);
        END IF;
        
        -- Add stat columns
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='passing_yards') THEN
            ALTER TABLE player_stats ADD COLUMN passing_yards INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='passing_tds') THEN
            ALTER TABLE player_stats ADD COLUMN passing_tds INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='rushing_yards') THEN
            ALTER TABLE player_stats ADD COLUMN rushing_yards INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='rushing_tds') THEN
            ALTER TABLE player_stats ADD COLUMN rushing_tds INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='receiving_yards') THEN
            ALTER TABLE player_stats ADD COLUMN receiving_yards INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='receiving_tds') THEN
            ALTER TABLE player_stats ADD COLUMN receiving_tds INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_stats' AND column_name='receptions') THEN
            ALTER TABLE player_stats ADD COLUMN receptions INTEGER;
        END IF;
        
        RAISE NOTICE 'Player_stats table columns added successfully';
    ELSE
        RAISE NOTICE 'Player_stats table does not exist - creating it';
        CREATE TABLE player_stats (
            id SERIAL PRIMARY KEY,
            player_id INTEGER REFERENCES players(id),
            game_id INTEGER,
            season INTEGER,
            week INTEGER,
            fantasy_points DECIMAL(6,2),
            fantasy_points_ppr DECIMAL(6,2),
            passing_yards INTEGER,
            passing_tds INTEGER,
            interceptions INTEGER,
            rushing_yards INTEGER,
            rushing_tds INTEGER,
            receiving_yards INTEGER,
            receiving_tds INTEGER,
            receptions INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- ========================================
-- 4. ENHANCE NEWS_ARTICLES TABLE
-- ========================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='news_articles' AND column_name='fantasy_relevance') THEN
        ALTER TABLE news_articles ADD COLUMN fantasy_relevance DECIMAL(3,2) DEFAULT 0.5;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='news_articles' AND column_name='player_ids') THEN
        ALTER TABLE news_articles ADD COLUMN player_ids INTEGER[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='news_articles' AND column_name='team_ids') THEN
        ALTER TABLE news_articles ADD COLUMN team_ids INTEGER[];
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='news_articles' AND column_name='injury_report') THEN
        ALTER TABLE news_articles ADD COLUMN injury_report BOOLEAN DEFAULT FALSE;
    END IF;
    
    RAISE NOTICE 'News_articles table columns added successfully';
END $$;

-- ========================================
-- 5. CREATE NEW TABLES (ONLY IF THEY DON'T EXIST)
-- ========================================

-- Fantasy Projections
CREATE TABLE IF NOT EXISTS fantasy_projections (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    season INTEGER NOT NULL,
    week INTEGER NOT NULL,
    projection_source VARCHAR(50) DEFAULT 'system',
    projected_points DECIMAL(6,2),
    floor DECIMAL(6,2),
    ceiling DECIMAL(6,2),
    confidence_score DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player Rankings
CREATE TABLE IF NOT EXISTS player_rankings (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    season INTEGER NOT NULL,
    week INTEGER NOT NULL,
    ranking_type VARCHAR(50) DEFAULT 'overall',
    rank INTEGER,
    position_rank INTEGER,
    tier INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DFS Salaries
CREATE TABLE IF NOT EXISTS dfs_salaries (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    game_id INTEGER,
    platform VARCHAR(20),
    salary INTEGER,
    projected_ownership DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- CREATE INDEXES FOR PERFORMANCE
-- ========================================
DO $$
BEGIN
    -- Players indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_players_fantasy') THEN
        CREATE INDEX idx_players_fantasy ON players(fantasy_ownership, adp, status);
    END IF;
    
    -- Games indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_games_season_week') THEN
        CREATE INDEX idx_games_season_week ON games(season, week, sport_id);
    END IF;
    
    -- Stats indexes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='player_stats') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_stats_fantasy_points') THEN
            CREATE INDEX idx_stats_fantasy_points ON player_stats(player_id, season, week);
        END IF;
    END IF;
    
    RAISE NOTICE 'Indexes created successfully';
END $$;

-- ========================================
-- SHOW WHAT WE HAVE
-- ========================================
DO $$
DECLARE
    player_count INTEGER;
    game_count INTEGER;
    news_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO player_count FROM players;
    SELECT COUNT(*) INTO game_count FROM games;
    SELECT COUNT(*) INTO news_count FROM news_articles;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔥 FANTASY COLUMNS ADDED SUCCESSFULLY! 🔥';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'Current database status:';
    RAISE NOTICE '  Players: %', player_count;
    RAISE NOTICE '  Games: %', game_count;
    RAISE NOTICE '  News: %', news_count;
    RAISE NOTICE '';
    RAISE NOTICE 'New fantasy tables created:';
    RAISE NOTICE '  ✅ fantasy_projections';
    RAISE NOTICE '  ✅ player_rankings';
    RAISE NOTICE '  ✅ dfs_salaries';
    RAISE NOTICE '';
    RAISE NOTICE 'Ready for turbo loading!';
END $$;

-- List all columns in key tables for verification
SELECT 
    table_name,
    COUNT(*) as column_count,
    STRING_AGG(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name IN ('players', 'games', 'player_stats', 'news_articles')
GROUP BY table_name
ORDER BY table_name;