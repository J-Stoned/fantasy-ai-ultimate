-- Fix schema issues to make data collectors work
-- Add missing columns that collectors expect

-- Fix games table - add missing columns
ALTER TABLE games ADD COLUMN IF NOT EXISTS away_team VARCHAR(100);
ALTER TABLE games ADD COLUMN IF NOT EXISTS home_team VARCHAR(100);
ALTER TABLE games ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE games ADD COLUMN IF NOT EXISTS sport VARCHAR(50);
ALTER TABLE games ADD COLUMN IF NOT EXISTS venue VARCHAR(200);
ALTER TABLE games ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed';

-- Fix news_articles table - add external_id for upserts
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS source VARCHAR(100);

-- Fix players table - add missing columns collectors expect
ALTER TABLE players ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE players ADD COLUMN IF NOT EXISTS sport VARCHAR(50);
ALTER TABLE players ADD COLUMN IF NOT EXISTS team VARCHAR(100);
ALTER TABLE players ADD COLUMN IF NOT EXISTS college VARCHAR(100);

-- Create betting_odds table if it doesn't exist (for ML training)
CREATE TABLE IF NOT EXISTS betting_odds (
    id BIGSERIAL PRIMARY KEY,
    external_id VARCHAR(255) UNIQUE,
    sport VARCHAR(50),
    game_id BIGINT,
    home_team VARCHAR(100),
    away_team VARCHAR(100),
    home_odds DECIMAL(10,2),
    away_odds DECIMAL(10,2),
    over_under DECIMAL(6,2),
    spread DECIMAL(6,2),
    bookmaker VARCHAR(100),
    market VARCHAR(100),
    outcome VARCHAR(100),
    odds DECIMAL(10,2),
    commence_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create player_stats table for ML features
CREATE TABLE IF NOT EXISTS player_stats (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT,
    game_id BIGINT,
    external_id VARCHAR(255),
    points INTEGER,
    rebounds INTEGER,
    assists INTEGER,
    steals INTEGER,
    blocks INTEGER,
    turnovers INTEGER,
    field_goals_made INTEGER,
    field_goals_attempted INTEGER,
    three_pointers_made INTEGER,
    three_pointers_attempted INTEGER,
    free_throws_made INTEGER,
    free_throws_attempted INTEGER,
    minutes_played INTEGER,
    fantasy_points DECIMAL(8,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_games_external_id ON games(external_id);
CREATE INDEX IF NOT EXISTS idx_games_sport ON games(sport);
CREATE INDEX IF NOT EXISTS idx_games_date ON games(game_date);

CREATE INDEX IF NOT EXISTS idx_news_external_id ON news_articles(external_id);
CREATE INDEX IF NOT EXISTS idx_news_source ON news_articles(source);

CREATE INDEX IF NOT EXISTS idx_players_external_id ON players(external_id);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team);

CREATE INDEX IF NOT EXISTS idx_betting_odds_external_id ON betting_odds(external_id);
CREATE INDEX IF NOT EXISTS idx_betting_odds_game_id ON betting_odds(game_id);
CREATE INDEX IF NOT EXISTS idx_betting_odds_sport ON betting_odds(sport);

CREATE INDEX IF NOT EXISTS idx_player_stats_player_id ON player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_game_id ON player_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_external_id ON player_stats(external_id);

-- Update any NULL external_ids with generated values for existing records
UPDATE games SET external_id = 'game_' || id WHERE external_id IS NULL;
UPDATE news_articles SET external_id = 'news_' || id WHERE external_id IS NULL;
UPDATE players SET external_id = 'player_' || id WHERE external_id IS NULL;

-- Add unique constraints for external_ids
ALTER TABLE games ADD CONSTRAINT IF NOT EXISTS unique_games_external_id UNIQUE (external_id);
ALTER TABLE news_articles ADD CONSTRAINT IF NOT EXISTS unique_news_external_id UNIQUE (external_id);
ALTER TABLE players ADD CONSTRAINT IF NOT EXISTS unique_players_external_id UNIQUE (external_id);