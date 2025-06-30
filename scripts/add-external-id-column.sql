-- Add external_id columns to tables
ALTER TABLE teams ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE players ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE games ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Add unique constraints
ALTER TABLE teams ADD CONSTRAINT teams_external_id_unique UNIQUE (external_id);
ALTER TABLE players ADD CONSTRAINT players_external_id_unique UNIQUE (external_id);
ALTER TABLE games ADD CONSTRAINT games_external_id_unique UNIQUE (external_id);

-- Remove old unique constraint on teams
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_name_sport_id_key;

-- Add new constraint for teams
ALTER TABLE teams ADD CONSTRAINT teams_name_sport_unique UNIQUE (name, sport_id);

-- Success
SELECT 'External ID columns added!' as message;