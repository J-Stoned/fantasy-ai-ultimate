-- CREATE ESSENTIAL TABLES FOR DATA COLLECTION
-- Run this in Supabase SQL Editor first!

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS news_articles CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS player_stats CASCADE;
DROP TABLE IF EXISTS player_injuries CASCADE;
DROP TABLE IF EXISTS weather_data CASCADE;

-- Create teams table
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    city TEXT,
    abbreviation TEXT,
    sport_id TEXT,
    league_id TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create players table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    firstName TEXT,
    lastName TEXT,
    position TEXT[],
    team_id INTEGER REFERENCES teams(id),
    jersey_number INTEGER,
    heightInches INTEGER,
    weightLbs INTEGER,
    birthDate DATE,
    status TEXT,
    sport_id TEXT,
    external_id TEXT,
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(firstName, lastName, sport_id)
);

-- Create news_articles table
CREATE TABLE news_articles (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    summary TEXT,
    url TEXT UNIQUE,
    source TEXT,
    author TEXT,
    sport_id TEXT,
    team_ids INTEGER[],
    player_ids INTEGER[],
    tags TEXT[],
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create games table
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    home_team_id INTEGER REFERENCES teams(id),
    away_team_id INTEGER REFERENCES teams(id),
    sport_id TEXT,
    start_time TIMESTAMPTZ,
    venue TEXT,
    home_score INTEGER,
    away_score INTEGER,
    status TEXT,
    external_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create player_stats table
CREATE TABLE player_stats (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    game_id INTEGER REFERENCES games(id),
    stat_type TEXT,
    stat_value JSONB,
    fantasy_points DECIMAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create player_injuries table
CREATE TABLE player_injuries (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id),
    injury_type TEXT,
    body_part TEXT,
    status TEXT,
    return_date DATE,
    notes TEXT,
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create weather_data table
CREATE TABLE weather_data (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id),
    temperature INTEGER,
    wind_speed INTEGER,
    wind_direction TEXT,
    precipitation DECIMAL,
    humidity INTEGER,
    conditions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_players_sport ON players(sport_id);
CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_news_published ON news_articles(published_at DESC);
CREATE INDEX idx_games_start_time ON games(start_time);
CREATE INDEX idx_player_stats_player ON player_stats(player_id);

-- Disable RLS for testing (REMOVE IN PRODUCTION!)
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE games DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_injuries DISABLE ROW LEVEL SECURITY;
ALTER TABLE weather_data DISABLE ROW LEVEL SECURITY;

-- Grant permissions for testing
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;

-- Success message
SELECT 'Tables created successfully! You can now run the data collector.' as message;