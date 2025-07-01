-- 🚀 COMPLETE REAL DATA SETUP
-- Run this entire script in Supabase SQL Editor

-- STEP 1: Fix the teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS sport_id VARCHAR(20);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS conference VARCHAR(50);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS division VARCHAR(50);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE;

-- STEP 2: Create all real data tables
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

-- STEP 3: Add missing columns to existing tables
ALTER TABLE players ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS sport_id VARCHAR(20);
ALTER TABLE players ADD COLUMN IF NOT EXISTS birthdate DATE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS college VARCHAR(100);
ALTER TABLE players ADD COLUMN IF NOT EXISTS experience INTEGER;

ALTER TABLE games ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS sport_id VARCHAR(20);
ALTER TABLE games ADD COLUMN IF NOT EXISTS week INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS season INTEGER;

-- STEP 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_weather_city ON weather_conditions(city);
CREATE INDEX IF NOT EXISTS idx_weather_created ON weather_conditions(created_at);
CREATE INDEX IF NOT EXISTS idx_odds_sport ON betting_odds(sport_id);
CREATE INDEX IF NOT EXISTS idx_odds_time ON betting_odds(commence_time);
CREATE INDEX IF NOT EXISTS idx_stats_player ON player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_stats_game ON player_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_platform ON social_sentiment(platform);
CREATE INDEX IF NOT EXISTS idx_insights_type ON ai_insights(insight_type);

-- STEP 5: Add some sample teams with cities (if teams table is empty)
INSERT INTO teams (name, city, abbreviation, sport_id)
SELECT * FROM (VALUES
    ('Giants', 'New York', 'NYG', 'nfl'),
    ('Jets', 'New York', 'NYJ', 'nfl'),
    ('Cowboys', 'Dallas', 'DAL', 'nfl'),
    ('Eagles', 'Philadelphia', 'PHI', 'nfl'),
    ('Patriots', 'Boston', 'NE', 'nfl'),
    ('Dolphins', 'Miami', 'MIA', 'nfl'),
    ('Bills', 'Buffalo', 'BUF', 'nfl'),
    ('Packers', 'Green Bay', 'GB', 'nfl'),
    ('Bears', 'Chicago', 'CHI', 'nfl'),
    ('Lions', 'Detroit', 'DET', 'nfl'),
    ('Vikings', 'Minneapolis', 'MIN', 'nfl'),
    ('49ers', 'San Francisco', 'SF', 'nfl'),
    ('Seahawks', 'Seattle', 'SEA', 'nfl'),
    ('Rams', 'Los Angeles', 'LAR', 'nfl'),
    ('Chargers', 'Los Angeles', 'LAC', 'nfl'),
    ('Broncos', 'Denver', 'DEN', 'nfl')
) AS t(name, city, abbreviation, sport_id)
WHERE NOT EXISTS (SELECT 1 FROM teams WHERE name = t.name);

-- STEP 6: Show results
SELECT '✅ SETUP COMPLETE!' as status;

-- Show teams with cities
SELECT 
    'Teams with cities:' as info,
    COUNT(*) as count,
    string_agg(city || ' (' || name || ')', ', ' ORDER BY city) as cities
FROM teams
WHERE city IS NOT NULL;

-- Show all tables
SELECT 
    table_name,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    n_live_tup as rows
FROM pg_stat_user_tables
WHERE schemaname = 'public'
AND tablename IN (
    'teams', 'players', 'games', 'news_articles',
    'weather_conditions', 'betting_odds', 'player_stats',
    'social_sentiment', 'ai_insights'
)
ORDER BY 
    CASE 
        WHEN tablename IN ('weather_conditions', 'betting_odds', 'player_stats', 'social_sentiment', 'ai_insights')
        THEN 0 
        ELSE 1 
    END,
    tablename;