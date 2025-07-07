-- Add pattern_results column to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS pattern_results JSONB DEFAULT '{}';

-- Add index for pattern queries
CREATE INDEX IF NOT EXISTS idx_games_pattern_results ON games USING GIN (pattern_results);

-- Create pattern_results summary table
CREATE TABLE IF NOT EXISTS pattern_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT REFERENCES games(id),
  pattern_name TEXT NOT NULL,
  detected BOOLEAN NOT NULL,
  confidence DECIMAL(3,2),
  expected_roi DECIMAL(5,3),
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(game_id, pattern_name)
);

-- Add indexes for pattern_results
CREATE INDEX IF NOT EXISTS idx_pattern_results_game_id ON pattern_results(game_id);
CREATE INDEX IF NOT EXISTS idx_pattern_results_pattern_name ON pattern_results(pattern_name);
CREATE INDEX IF NOT EXISTS idx_pattern_results_detected ON pattern_results(detected);

-- Add pattern tracking columns
ALTER TABLE games
ADD COLUMN IF NOT EXISTS patterns_analyzed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pattern_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_pattern_roi DECIMAL(5,3) DEFAULT 0;

-- Create view for pattern statistics
CREATE OR REPLACE VIEW pattern_statistics AS
SELECT 
  pr.pattern_name,
  COUNT(*) as total_occurrences,
  COUNT(*) FILTER (WHERE pr.detected) as detected_count,
  AVG(pr.confidence) FILTER (WHERE pr.detected) as avg_confidence,
  AVG(pr.expected_roi) FILTER (WHERE pr.detected) as avg_roi,
  COUNT(DISTINCT pr.game_id) as games_analyzed
FROM pattern_results pr
GROUP BY pr.pattern_name;