-- Create game_external_ids table for mapping universal IDs to external sources
CREATE TABLE IF NOT EXISTS game_external_ids (
  id SERIAL PRIMARY KEY,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  source VARCHAR(50) NOT NULL,  -- 'espn', 'draftkings', 'fanduel', 'sportradar', etc.
  external_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure each game has only one ID per source
  CONSTRAINT unique_game_source UNIQUE(game_id, source)
);

-- Create indexes for fast lookups
CREATE INDEX idx_game_external_ids_lookup ON game_external_ids(source, external_id);
CREATE INDEX idx_game_external_ids_game ON game_external_ids(game_id);

-- Add universal_id column to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS universal_id VARCHAR(255);

-- Create unique index on universal_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_games_universal_id ON games(universal_id);

-- Create updated_at trigger for game_external_ids
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_game_external_ids_updated_at 
BEFORE UPDATE ON game_external_ids 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE game_external_ids IS 'Maps games to their IDs in external systems (ESPN, DraftKings, etc)';
COMMENT ON COLUMN game_external_ids.source IS 'External data source name (espn, draftkings, fanduel, etc)';
COMMENT ON COLUMN game_external_ids.external_id IS 'The ID used by the external system';
COMMENT ON COLUMN games.universal_id IS 'Our universal game ID format: {sport}_{YYYYMMDD}_{HHMM}_{home}_{away}';