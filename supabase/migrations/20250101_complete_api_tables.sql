-- Migration: Complete API tables setup
-- Created: 2025-01-01
-- Description: Creates all necessary tables for new API integrations

-- First, create social_sentiment table if it doesn't exist
CREATE TABLE IF NOT EXISTS social_sentiment (
  id BIGSERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL, -- 'reddit', 'twitter', 'youtube'
  content TEXT NOT NULL,
  author VARCHAR(255),
  score INTEGER DEFAULT 0,
  url VARCHAR(500),
  sport_id VARCHAR(20),
  mentions TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  external_id VARCHAR(255) UNIQUE NOT NULL,
  -- New columns for Twitter support
  engagement_score INTEGER DEFAULT 0,
  urgency VARCHAR(20),
  sentiment VARCHAR(20) -- 'positive', 'negative', 'neutral', 'mixed'
);

-- Fantasy Rankings table (ESPN Fantasy, Yahoo Fantasy, etc)
CREATE TABLE IF NOT EXISTS fantasy_rankings (
  id BIGSERIAL PRIMARY KEY,
  player_name VARCHAR(255) NOT NULL,
  player_id VARCHAR(100),
  position VARCHAR(10),
  team_id VARCHAR(50),
  ownership_pct DECIMAL(5,2),
  adp DECIMAL(5,2), -- Average Draft Position
  platform VARCHAR(50) NOT NULL, -- 'espn', 'yahoo', 'sleeper'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  external_id VARCHAR(255) UNIQUE NOT NULL
);

-- Trending Players table
CREATE TABLE IF NOT EXISTS trending_players (
  id BIGSERIAL PRIMARY KEY,
  player_name VARCHAR(255) NOT NULL,
  player_id VARCHAR(100),
  trend_type VARCHAR(50), -- 'most_added', 'most_dropped', 'breaking_news'
  platform VARCHAR(50) NOT NULL,
  ownership_change DECIMAL(5,2),
  mentions_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  external_id VARCHAR(255) UNIQUE NOT NULL
);

-- Player Projections table (SportsData.io, ESPN, etc)
CREATE TABLE IF NOT EXISTS player_projections (
  id BIGSERIAL PRIMARY KEY,
  player_name VARCHAR(255) NOT NULL,
  player_id VARCHAR(100),
  team VARCHAR(10),
  position VARCHAR(10),
  week INTEGER,
  season INTEGER DEFAULT 2024,
  projected_points DECIMAL(5,2),
  projected_points_ppr DECIMAL(5,2),
  projected_passing_yards DECIMAL(6,2),
  projected_passing_tds DECIMAL(3,1),
  projected_rushing_yards DECIMAL(6,2),
  projected_rushing_tds DECIMAL(3,1),
  projected_receiving_yards DECIMAL(6,2),
  projected_receiving_tds DECIMAL(3,1),
  projected_receptions DECIMAL(4,1),
  platform VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  external_id VARCHAR(255) UNIQUE NOT NULL
);

-- DFS Salaries table
CREATE TABLE IF NOT EXISTS dfs_salaries (
  id BIGSERIAL PRIMARY KEY,
  player_name VARCHAR(255) NOT NULL,
  player_id VARCHAR(100),
  team VARCHAR(10),
  position VARCHAR(10),
  draftkings_salary INTEGER,
  fanduel_salary INTEGER,
  yahoo_salary INTEGER,
  week INTEGER,
  season INTEGER DEFAULT 2024,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  external_id VARCHAR(255) UNIQUE NOT NULL
);

-- API Usage tracking table (for rate limiting)
CREATE TABLE IF NOT EXISTS api_usage (
  id BIGSERIAL PRIMARY KEY,
  api_name VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  calls INTEGER DEFAULT 0,
  daily_limit INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(api_name, date)
);

-- Breaking News table (Twitter, Google News, etc)
CREATE TABLE IF NOT EXISTS breaking_news (
  id BIGSERIAL PRIMARY KEY,
  headline VARCHAR(500) NOT NULL,
  content TEXT,
  url VARCHAR(500),
  source VARCHAR(100), -- 'twitter', 'google_news', 'youtube'
  author VARCHAR(255),
  published_at TIMESTAMPTZ,
  urgency VARCHAR(20), -- 'breaking', 'recent', 'normal'
  players_mentioned TEXT[], -- Array of player names
  teams_mentioned TEXT[], -- Array of team names
  sentiment VARCHAR(20), -- 'positive', 'negative', 'neutral'
  engagement_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  external_id VARCHAR(255) UNIQUE NOT NULL
);

-- Video Content table (YouTube)
CREATE TABLE IF NOT EXISTS video_content (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  channel_name VARCHAR(255),
  channel_id VARCHAR(100),
  video_id VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url VARCHAR(500),
  duration INTEGER, -- seconds
  view_count INTEGER,
  like_count INTEGER,
  comment_count INTEGER,
  published_at TIMESTAMPTZ,
  players_mentioned TEXT[],
  teams_mentioned TEXT[],
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weather data table if not exists
CREATE TABLE IF NOT EXISTS weather_data (
  id BIGSERIAL PRIMARY KEY,
  location VARCHAR(255) NOT NULL,
  temperature INTEGER,
  conditions VARCHAR(50),
  wind_speed INTEGER,
  humidity INTEGER,
  team_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Betting odds table if not exists
CREATE TABLE IF NOT EXISTS betting_odds (
  id BIGSERIAL PRIMARY KEY,
  sport_id VARCHAR(20),
  home_team VARCHAR(100),
  away_team VARCHAR(100),
  game_time TIMESTAMPTZ,
  bookmakers JSONB,
  external_id VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update existing tables to support new data

-- Add jersey_number to players table if not exists
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS jersey_number VARCHAR(10);

-- Add team_abbreviation to players table if not exists
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS team_abbreviation VARCHAR(5);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_sentiment_platform ON social_sentiment(platform);
CREATE INDEX IF NOT EXISTS idx_social_sentiment_created ON social_sentiment(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fantasy_rankings_player_platform ON fantasy_rankings(player_name, platform);
CREATE INDEX IF NOT EXISTS idx_fantasy_rankings_ownership ON fantasy_rankings(ownership_pct DESC);
CREATE INDEX IF NOT EXISTS idx_trending_players_created ON trending_players(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_projections_week ON player_projections(week, season);
CREATE INDEX IF NOT EXISTS idx_breaking_news_published ON breaking_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(api_name, date);

-- Create views for easy querying

-- Top trending players across all platforms
CREATE OR REPLACE VIEW vw_top_trending_players AS
SELECT 
  player_name,
  COUNT(DISTINCT platform) as platform_count,
  AVG(ownership_change) as avg_ownership_change,
  MAX(created_at) as last_trending
FROM trending_players
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY player_name
ORDER BY platform_count DESC, avg_ownership_change DESC;

-- Current week projections with rankings
CREATE OR REPLACE VIEW vw_current_week_projections AS
SELECT 
  p.*,
  RANK() OVER (PARTITION BY p.position ORDER BY p.projected_points_ppr DESC) as position_rank
FROM player_projections p
WHERE p.week = (
  SELECT MAX(week) FROM player_projections WHERE season = 2024
)
AND p.season = 2024;

-- Breaking injury news
CREATE OR REPLACE VIEW vw_breaking_injuries AS
SELECT 
  headline,
  content,
  source,
  published_at,
  players_mentioned,
  engagement_score
FROM breaking_news
WHERE urgency = 'breaking'
  AND (headline ILIKE '%injury%' OR headline ILIKE '%injured%' OR content ILIKE '%injury%')
  AND published_at > NOW() - INTERVAL '24 hours'
ORDER BY published_at DESC;

-- Combined social sentiment view
CREATE OR REPLACE VIEW vw_social_sentiment_summary AS
SELECT 
  platform,
  COUNT(*) as post_count,
  AVG(engagement_score) as avg_engagement,
  COUNT(DISTINCT sport_id) as sports_covered,
  MAX(created_at) as last_post
FROM social_sentiment
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY platform
ORDER BY post_count DESC;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Enable RLS on sensitive tables
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

-- RLS policy for api_usage (only service role can modify)
CREATE POLICY "Service role can manage API usage" ON api_usage
  FOR ALL USING (auth.role() = 'service_role');

-- Add helpful comments
COMMENT ON TABLE social_sentiment IS 'Social media sentiment from Reddit, Twitter, etc';
COMMENT ON TABLE fantasy_rankings IS 'Player rankings from various fantasy platforms';
COMMENT ON TABLE trending_players IS 'Players trending up/down in ownership or mentions';
COMMENT ON TABLE player_projections IS 'Weekly projections from various sources';
COMMENT ON TABLE breaking_news IS 'Real-time news from Twitter, Google, etc';
COMMENT ON TABLE api_usage IS 'Track API calls for rate limiting';
COMMENT ON TABLE weather_data IS 'Weather conditions for game venues';
COMMENT ON TABLE betting_odds IS 'Betting lines and odds from various bookmakers';