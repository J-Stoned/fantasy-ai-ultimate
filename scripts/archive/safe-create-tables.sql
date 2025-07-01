-- 🔥 SAFE SQL SCRIPT - HANDLES EXISTING TABLES
-- This script checks what exists before creating/altering

-- Step 1: Check if teams table exists and add city column if missing
DO $$
BEGIN
    -- If teams table doesn't exist, create it
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
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
        );
        RAISE NOTICE 'Created teams table';
    ELSE
        -- Table exists, add city column if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'teams' AND column_name = 'city') THEN
            ALTER TABLE teams ADD COLUMN city VARCHAR(100);
            RAISE NOTICE 'Added city column to teams table';
        END IF;
    END IF;
END $$;

-- Step 2: Create weather_conditions table
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

-- Step 3: Create betting_odds table
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

-- Step 4: Create player_stats table
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

-- Step 5: Create social_sentiment table
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

-- Step 6: Create ai_insights table
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

-- Step 7: Create indexes (IF NOT EXISTS prevents errors)
CREATE INDEX IF NOT EXISTS idx_weather_city ON weather_conditions(city);
CREATE INDEX IF NOT EXISTS idx_weather_created ON weather_conditions(created_at);
CREATE INDEX IF NOT EXISTS idx_odds_sport ON betting_odds(sport_id);
CREATE INDEX IF NOT EXISTS idx_odds_time ON betting_odds(commence_time);
CREATE INDEX IF NOT EXISTS idx_stats_player ON player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_stats_game ON player_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_platform ON social_sentiment(platform);
CREATE INDEX IF NOT EXISTS idx_insights_type ON ai_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_created ON ai_insights(created_at);

-- Step 8: Safely add columns to existing tables
DO $$
BEGIN
    -- Check and add columns to players table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'players') THEN
        -- Add external_id
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'players' AND column_name = 'external_id') THEN
            ALTER TABLE players ADD COLUMN external_id VARCHAR(255) UNIQUE;
        END IF;
        
        -- Add sport_id
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'players' AND column_name = 'sport_id') THEN
            ALTER TABLE players ADD COLUMN sport_id VARCHAR(20);
        END IF;
        
        -- Add birthdate
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'players' AND column_name = 'birthdate') THEN
            ALTER TABLE players ADD COLUMN birthdate DATE;
        END IF;
        
        -- Add college
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'players' AND column_name = 'college') THEN
            ALTER TABLE players ADD COLUMN college VARCHAR(100);
        END IF;
        
        -- Add experience
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'players' AND column_name = 'experience') THEN
            ALTER TABLE players ADD COLUMN experience INTEGER;
        END IF;
    END IF;

    -- Check and add columns to games table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'games') THEN
        -- Add external_id
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'games' AND column_name = 'external_id') THEN
            ALTER TABLE games ADD COLUMN external_id VARCHAR(255) UNIQUE;
        END IF;
        
        -- Add sport_id
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'games' AND column_name = 'sport_id') THEN
            ALTER TABLE games ADD COLUMN sport_id VARCHAR(20);
        END IF;
        
        -- Add week
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'games' AND column_name = 'week') THEN
            ALTER TABLE games ADD COLUMN week INTEGER;
        END IF;
        
        -- Add season
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'games' AND column_name = 'season') THEN
            ALTER TABLE games ADD COLUMN season INTEGER;
        END IF;
    END IF;
END $$;

-- Step 9: Show what tables we have
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('weather_conditions', 'betting_odds', 'player_stats', 'social_sentiment', 'ai_insights')
        THEN '✅ Ready for real data'
        ELSE '📊 Existing table'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
AND table_name IN (
    'teams',
    'players',
    'games',
    'news_articles',
    'weather_conditions', 
    'betting_odds', 
    'player_stats', 
    'social_sentiment', 
    'ai_insights'
)
ORDER BY 
    CASE 
        WHEN table_name IN ('weather_conditions', 'betting_odds', 'player_stats', 'social_sentiment', 'ai_insights')
        THEN 0 
        ELSE 1 
    END,
    table_name;

-- Show if teams table has city column
SELECT 
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'teams'
ORDER BY ordinal_position;