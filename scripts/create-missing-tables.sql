-- Create missing tables for Fantasy AI enhancements

-- Correlation insights table for storing analysis results
CREATE TABLE IF NOT EXISTS correlation_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factor1 TEXT NOT NULL,
  factor2 TEXT NOT NULL,
  correlation FLOAT NOT NULL,
  confidence FLOAT NOT NULL,
  sample_size INTEGER,
  insight TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ML predictions table for storing model predictions
CREATE TABLE IF NOT EXISTS ml_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  prediction_type TEXT NOT NULL,
  prediction TEXT NOT NULL,
  confidence FLOAT NOT NULL,
  features JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Injuries table for tracking player injuries
CREATE TABLE IF NOT EXISTS injuries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id INTEGER REFERENCES players(id),
  injury_type TEXT,
  severity TEXT,
  reported_date DATE,
  return_date DATE,
  status TEXT,
  team_id INTEGER REFERENCES teams(id),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add game_id to weather_data if it doesn't exist
ALTER TABLE weather_data 
ADD COLUMN IF NOT EXISTS game_id TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ml_predictions_game_id ON ml_predictions(game_id);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_created_at ON ml_predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_correlation_insights_factors ON correlation_insights(factor1, factor2);
CREATE INDEX IF NOT EXISTS idx_injuries_player_id ON injuries(player_id);
CREATE INDEX IF NOT EXISTS idx_injuries_status ON injuries(status);
CREATE INDEX IF NOT EXISTS idx_weather_game_id ON weather_data(game_id);