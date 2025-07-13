-- DISABLE RLS FOR TESTING ONLY
-- Run this in Supabase SQL Editor to allow data collection
-- WARNING: Only use this for development/testing!

-- Disable RLS on main tables for testing
ALTER TABLE players DISABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE games DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_injuries DISABLE ROW LEVEL SECURITY;
ALTER TABLE weather_data DISABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated and anon users
GRANT ALL ON players TO authenticated, anon;
GRANT ALL ON news_articles TO authenticated, anon;
GRANT ALL ON teams TO authenticated, anon;
GRANT ALL ON games TO authenticated, anon;
GRANT ALL ON player_stats TO authenticated, anon;
GRANT ALL ON player_injuries TO authenticated, anon;
GRANT ALL ON weather_data TO authenticated, anon;

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS news_articles (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    url TEXT UNIQUE,
    source TEXT,
    sport_id TEXT,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    firstName TEXT,
    lastName TEXT,
    position TEXT[],
    heightInches INTEGER,
    weightLbs INTEGER,
    status TEXT,
    sport_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(firstName, lastName)
);

-- Test query to verify access
SELECT COUNT(*) FROM players;