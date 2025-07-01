-- Create collection_state table to track data collection progress
CREATE TABLE IF NOT EXISTS collection_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  collector_name VARCHAR(100) NOT NULL UNIQUE,
  last_run TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_id VARCHAR(255),
  last_timestamp TIMESTAMP WITH TIME ZONE,
  items_collected INTEGER DEFAULT 0,
  total_items_collected BIGINT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_collection_state_collector_name ON collection_state(collector_name);

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_collection_state_updated_at 
  BEFORE UPDATE ON collection_state 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default states for each collector
INSERT INTO collection_state (collector_name, metadata) VALUES
  ('espn_collector', '{"sport": "all", "fetch_limit": 100}'),
  ('sleeper_players', '{"last_full_sync": null, "sync_interval_hours": 24}'),
  ('sleeper_trending', '{"check_interval_minutes": 30}'),
  ('reddit_collector', '{"subreddits": ["fantasyfootball", "nfl", "nba"], "posts_per_sub": 25}'),
  ('weather_collector', '{"update_interval_hours": 1}'),
  ('nba_collector', '{"page": 1, "per_page": 100}'),
  ('odds_collector', '{"sports": ["nfl", "nba", "mlb", "nhl"]}'),
  ('nfl_official', '{"current_week": null}'),
  ('espn_fantasy', '{"last_player_id": null}'),
  ('twitter_collector', '{"last_tweet_id": null}'),
  ('sportsdata_io', '{"last_projection_week": null}')
ON CONFLICT (collector_name) DO NOTHING;