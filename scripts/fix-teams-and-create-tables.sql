-- 🔧 FIX TEAMS TABLE AND CREATE REAL DATA TABLES
-- This script carefully handles the teams table issue

-- Step 1: Check what columns the teams table has
DO $$
DECLARE
    has_teams_table BOOLEAN;
    has_city_column BOOLEAN;
BEGIN
    -- Check if teams table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'teams' AND table_schema = 'public'
    ) INTO has_teams_table;
    
    IF has_teams_table THEN
        RAISE NOTICE 'Teams table exists';
        
        -- Check if city column exists
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'teams' 
            AND column_name = 'city' 
            AND table_schema = 'public'
        ) INTO has_city_column;
        
        IF NOT has_city_column THEN
            RAISE NOTICE 'Adding city column to teams table';
            EXECUTE 'ALTER TABLE teams ADD COLUMN city VARCHAR(100)';
        ELSE
            RAISE NOTICE 'City column already exists';
        END IF;
    ELSE
        RAISE NOTICE 'Creating teams table';
        EXECUTE '
        CREATE TABLE teams (
            id BIGSERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            city VARCHAR(100),
            abbreviation VARCHAR(10),
            sport_id VARCHAR(20),
            conference VARCHAR(50),
            division VARCHAR(50),
            external_id VARCHAR(255) UNIQUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )';
    END IF;
END $$;

-- Step 2: Now create the other tables (city column should exist now)

-- Weather conditions table
CREATE TABLE IF NOT EXISTS weather_conditions (
    id BIGSERIAL PRIMARY KEY,
    city VARCHAR(100) NOT NULL,
    temperature DECIMAL(5,2),
    feels_like DECIMAL(5,2),
    conditions VARCHAR(50),
    description VARCHAR(255),
    wind_speed DECIMAL(5,2),
    humidity INTEGER,
    visibility INTEGER,
    external_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Betting odds table
CREATE TABLE IF NOT EXISTS betting_odds (
    id BIGSERIAL PRIMARY KEY,
    sport_id VARCHAR(20),
    home_team VARCHAR(100),
    away_team VARCHAR(100),
    commence_time TIMESTAMPTZ,
    bookmakers JSONB,
    external_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Player stats table
CREATE TABLE IF NOT EXISTS player_stats (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT,
    game_id BIGINT,
    season INTEGER,
    week INTEGER,
    points INTEGER,
    assists INTEGER,
    rebounds INTEGER,
    steals INTEGER,
    blocks INTEGER,
    turnovers INTEGER,
    field_goals_made INTEGER,
    field_goals_attempted INTEGER,
    three_pointers_made INTEGER,
    three_pointers_attempted INTEGER,
    free_throws_made INTEGER,
    free_throws_attempted INTEGER,
    minutes VARCHAR(10),
    fantasy_points DECIMAL(6,2),
    external_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Social sentiment table
CREATE TABLE IF NOT EXISTS social_sentiment (
    id BIGSERIAL PRIMARY KEY,
    platform VARCHAR(50),
    content TEXT,
    author VARCHAR(100),
    score INTEGER,
    url VARCHAR(500),
    sport_id VARCHAR(20),
    mentions TEXT[],
    sentiment_score DECIMAL(3,2),
    external_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI insights table
CREATE TABLE IF NOT EXISTS ai_insights (
    id BIGSERIAL PRIMARY KEY,
    insight_type VARCHAR(50),
    subject VARCHAR(255),
    analysis TEXT,
    confidence_score DECIMAL(3,2),
    data_sources TEXT[],
    recommendations JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Add other missing columns safely
DO $$
BEGIN
    -- Add missing columns to teams
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'sport_id') THEN
        ALTER TABLE teams ADD COLUMN sport_id VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'conference') THEN
        ALTER TABLE teams ADD COLUMN conference VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'division') THEN
        ALTER TABLE teams ADD COLUMN division VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'external_id') THEN
        ALTER TABLE teams ADD COLUMN external_id VARCHAR(255) UNIQUE;
    END IF;
    
    -- Add missing columns to players if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'players') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'external_id') THEN
            ALTER TABLE players ADD COLUMN external_id VARCHAR(255) UNIQUE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'sport_id') THEN
            ALTER TABLE players ADD COLUMN sport_id VARCHAR(20);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'birthdate') THEN
            ALTER TABLE players ADD COLUMN birthdate DATE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'college') THEN
            ALTER TABLE players ADD COLUMN college VARCHAR(100);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'players' AND column_name = 'experience') THEN
            ALTER TABLE players ADD COLUMN experience INTEGER;
        END IF;
    END IF;
    
    -- Add missing columns to games if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'games') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'external_id') THEN
            ALTER TABLE games ADD COLUMN external_id VARCHAR(255) UNIQUE;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'sport_id') THEN
            ALTER TABLE games ADD COLUMN sport_id VARCHAR(20);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'week') THEN
            ALTER TABLE games ADD COLUMN week INTEGER;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'season') THEN
            ALTER TABLE games ADD COLUMN season INTEGER;
        END IF;
    END IF;
END $$;

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_weather_city ON weather_conditions(city);
CREATE INDEX IF NOT EXISTS idx_odds_sport ON betting_odds(sport_id);
CREATE INDEX IF NOT EXISTS idx_stats_player ON player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_platform ON social_sentiment(platform);
CREATE INDEX IF NOT EXISTS idx_insights_type ON ai_insights(insight_type);

-- Step 5: Verify everything
SELECT 'SETUP COMPLETE!' as status;

-- Show teams table structure
SELECT 
    'Teams table columns:' as info,
    string_agg(column_name || ' (' || data_type || ')', ', ') as columns
FROM information_schema.columns
WHERE table_name = 'teams'
GROUP BY table_name;

-- Show all tables
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('weather_conditions', 'betting_odds', 'player_stats', 'social_sentiment', 'ai_insights')
        THEN '✅ New real data table'
        ELSE '📊 Existing table'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'teams', 'players', 'games', 'news_articles',
    'weather_conditions', 'betting_odds', 'player_stats', 
    'social_sentiment', 'ai_insights'
)
ORDER BY 
    CASE 
        WHEN table_name IN ('weather_conditions', 'betting_odds', 'player_stats', 'social_sentiment', 'ai_insights')
        THEN 0 
        ELSE 1 
    END,
    table_name;