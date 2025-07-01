-- 🔥 CREATE REAL DATA TABLES (No city column needed)
-- The team names already include cities (e.g., "New York Giants")

-- Create weather_conditions table
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

-- Create betting_odds table
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

-- Create player_stats table
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

-- Create social_sentiment table
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

-- Create ai_insights table
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

-- Add missing columns to existing tables (NOT city!)
ALTER TABLE players ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS sport_id VARCHAR(20);
ALTER TABLE players ADD COLUMN IF NOT EXISTS birthdate DATE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS college VARCHAR(100);
ALTER TABLE players ADD COLUMN IF NOT EXISTS experience INTEGER;

ALTER TABLE games ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS sport_id VARCHAR(20);
ALTER TABLE games ADD COLUMN IF NOT EXISTS week INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS season INTEGER;

-- Add useful columns to teams (but NOT city)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS sport_id VARCHAR(20);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS conference VARCHAR(50);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS division VARCHAR(50);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_weather_city ON weather_conditions(city);
CREATE INDEX IF NOT EXISTS idx_weather_created ON weather_conditions(created_at);
CREATE INDEX IF NOT EXISTS idx_odds_sport ON betting_odds(sport_id);
CREATE INDEX IF NOT EXISTS idx_odds_time ON betting_odds(commence_time);
CREATE INDEX IF NOT EXISTS idx_stats_player ON player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_stats_game ON player_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_platform ON social_sentiment(platform);
CREATE INDEX IF NOT EXISTS idx_insights_type ON ai_insights(insight_type);

-- Show what we created
SELECT '✅ TABLES CREATED!' as status;

SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('weather_conditions', 'betting_odds', 'player_stats', 'social_sentiment', 'ai_insights')
        THEN '✨ New real data table'
        ELSE '📊 Existing table'
    END as type
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