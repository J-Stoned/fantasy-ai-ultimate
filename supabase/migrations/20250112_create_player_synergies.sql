-- Create player_synergies table if it doesn't exist
CREATE TABLE IF NOT EXISTS player_synergies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player1_id INTEGER NOT NULL,
  player2_id INTEGER NOT NULL,
  synergy_type TEXT NOT NULL,
  synergy_score FLOAT NOT NULL,
  sample_size INTEGER,
  games_together INTEGER DEFAULT 0,
  wins_together INTEGER DEFAULT 0,
  total_fantasy_points FLOAT DEFAULT 0,
  avg_fantasy_points FLOAT DEFAULT 0,
  point_differential FLOAT DEFAULT 0,
  best_game_together FLOAT DEFAULT 0,
  worst_game_together FLOAT DEFAULT 999,
  confidence FLOAT DEFAULT 0,
  season INTEGER,
  last_calculated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_player_pair UNIQUE(player1_id, player2_id, synergy_type, season)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_synergies_player1 ON player_synergies(player1_id);
CREATE INDEX IF NOT EXISTS idx_synergies_player2 ON player_synergies(player2_id);
CREATE INDEX IF NOT EXISTS idx_synergies_score ON player_synergies(synergy_score DESC);
CREATE INDEX IF NOT EXISTS idx_synergies_confidence ON player_synergies(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_synergies_season ON player_synergies(season);

-- Enable Row Level Security
ALTER TABLE player_synergies ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Public read access" ON player_synergies;
CREATE POLICY "Public read access" ON player_synergies 
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role write" ON player_synergies;
CREATE POLICY "Service role write" ON player_synergies 
  FOR ALL TO service_role USING (true);

-- Grant permissions
GRANT SELECT ON player_synergies TO authenticated;
GRANT ALL ON player_synergies TO service_role;

-- Add comments
COMMENT ON TABLE player_synergies IS 'Stores calculated synergies between player pairs based on historical performance';
COMMENT ON COLUMN player_synergies.player1_id IS 'First player ID (always lower than player2_id)';
COMMENT ON COLUMN player_synergies.player2_id IS 'Second player ID (always higher than player1_id)';
COMMENT ON COLUMN player_synergies.synergy_type IS 'Type of synergy: offensive, defensive, or balanced';
COMMENT ON COLUMN player_synergies.synergy_score IS 'Calculated synergy score (0-100)';
COMMENT ON COLUMN player_synergies.point_differential IS 'Difference between expected and actual combined performance';
COMMENT ON COLUMN player_synergies.confidence IS 'Confidence level based on sample size (0-1)';