-- 🔥 FIX AND CREATE TABLES FOR REAL DATA COLLECTION
-- Run this in Supabase SQL Editor

-- First, ensure we have a teams table (alias for teams_master or create if needed)
DO $$
BEGIN
    -- Check if teams table exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
        -- Check if teams_master exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams_master') THEN
            -- Create teams as a view of teams_master
            CREATE VIEW teams AS SELECT * FROM teams_master;
        ELSE
            -- Create teams table from scratch
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
        END IF;
    END IF;
END $$;

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

-- Player stats table (compatible with BIGSERIAL IDs)
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_weather_city ON weather_conditions(city);
CREATE INDEX IF NOT EXISTS idx_weather_created ON weather_conditions(created_at);
CREATE INDEX IF NOT EXISTS idx_odds_sport ON betting_odds(sport_id);
CREATE INDEX IF NOT EXISTS idx_odds_time ON betting_odds(commence_time);
CREATE INDEX IF NOT EXISTS idx_stats_player ON player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_stats_game ON player_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_platform ON social_sentiment(platform);
CREATE INDEX IF NOT EXISTS idx_insights_type ON ai_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_created ON ai_insights(created_at);

-- Add missing columns to existing tables
DO $$
BEGIN
    -- Add external_id to players if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='players' AND column_name='external_id') THEN
        ALTER TABLE players ADD COLUMN external_id VARCHAR(255) UNIQUE;
    END IF;
    
    -- Add external_id to games if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='games' AND column_name='external_id') THEN
        ALTER TABLE games ADD COLUMN external_id VARCHAR(255) UNIQUE;
    END IF;
    
    -- Add sport_id to players if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='players' AND column_name='sport_id') THEN
        ALTER TABLE players ADD COLUMN sport_id VARCHAR(20);
    END IF;
    
    -- Add sport_id to games if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='games' AND column_name='sport_id') THEN
        ALTER TABLE games ADD COLUMN sport_id VARCHAR(20);
    END IF;
    
    -- Add week to games if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='games' AND column_name='week') THEN
        ALTER TABLE games ADD COLUMN week INTEGER;
    END IF;
    
    -- Add season to games if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='games' AND column_name='season') THEN
        ALTER TABLE games ADD COLUMN season INTEGER;
    END IF;
    
    -- Add college to players if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='players' AND column_name='college') THEN
        ALTER TABLE players ADD COLUMN college VARCHAR(100);
    END IF;
    
    -- Add experience to players if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='players' AND column_name='experience') THEN
        ALTER TABLE players ADD COLUMN experience INTEGER;
    END IF;
END $$;

-- Show summary
SELECT 
    'Tables Created' as status,
    COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('weather_conditions', 'betting_odds', 'player_stats', 'social_sentiment', 'ai_insights', 'teams');