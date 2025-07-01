-- 🔥 CREATE TABLES FOR REAL DATA COLLECTION
-- Run this in Supabase SQL Editor

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

-- Player stats table (if not exists)
CREATE TABLE IF NOT EXISTS player_stats (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT REFERENCES players(id),
    game_id BIGINT REFERENCES games(id),
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

-- Social sentiment table (for Reddit/Twitter data)
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

-- AI insights table (for OpenAI analysis)
CREATE TABLE IF NOT EXISTS ai_insights (
    id BIGSERIAL PRIMARY KEY,
    insight_type VARCHAR(50), -- 'player_analysis', 'game_prediction', 'injury_impact', etc.
    subject VARCHAR(255),
    analysis TEXT,
    confidence_score DECIMAL(3,2),
    data_sources TEXT[],
    recommendations JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
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
    
    -- Add birthdate to players if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='players' AND column_name='birthdate') THEN
        ALTER TABLE players ADD COLUMN birthdate DATE;
    END IF;
END $$;

-- Show summary
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('weather_conditions', 'betting_odds', 'player_stats', 'social_sentiment', 'ai_insights');
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ REAL DATA TABLES READY!';
    RAISE NOTICE '=========================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Created % tables for real data:', table_count;
    RAISE NOTICE '  • weather_conditions - Live weather data';
    RAISE NOTICE '  • betting_odds - Real-time odds from sportsbooks';
    RAISE NOTICE '  • player_stats - Actual game statistics';
    RAISE NOTICE '  • social_sentiment - Reddit/Twitter analysis';
    RAISE NOTICE '  • ai_insights - OpenAI-powered insights';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Ready for real data collection!';
END $$;