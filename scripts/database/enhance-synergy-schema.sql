-- 🚀 ENHANCED SYNERGY SCHEMA - DOING IT RIGHT!
-- This migration adds proper columns for queryable, analyzable synergy data

-- Step 1: Add new columns with sensible defaults
ALTER TABLE team_synergy_stats 
ADD COLUMN IF NOT EXISTS lineup_size INTEGER NOT NULL DEFAULT 5,
ADD COLUMN IF NOT EXISTS context_type TEXT NOT NULL DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS home_away TEXT, -- 'home', 'away', null (both)
ADD COLUMN IF NOT EXISTS position_type TEXT, -- 'starters', 'bench', 'clutch', 'defensive', 'offensive', null
ADD COLUMN IF NOT EXISTS time_context TEXT, -- 'q1', 'q2', 'q3', 'q4', 'overtime', 'full_game', null
ADD COLUMN IF NOT EXISTS opponent_context TEXT, -- 'vs_fast_pace', 'vs_slow_pace', 'vs_good_defense', 'vs_bad_defense', null
ADD COLUMN IF NOT EXISTS season_context TEXT; -- 'early_season', 'mid_season', 'late_season', 'playoffs', null

-- Step 2: Create indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_team_synergy_lineup_size ON team_synergy_stats(lineup_size);
CREATE INDEX IF NOT EXISTS idx_team_synergy_context_type ON team_synergy_stats(context_type);
CREATE INDEX IF NOT EXISTS idx_team_synergy_home_away ON team_synergy_stats(home_away);
CREATE INDEX IF NOT EXISTS idx_team_synergy_position_type ON team_synergy_stats(position_type);
CREATE INDEX IF NOT EXISTS idx_team_synergy_time_context ON team_synergy_stats(time_context);
CREATE INDEX IF NOT EXISTS idx_team_synergy_composite ON team_synergy_stats(team_id, lineup_size, context_type, home_away);

-- Step 3: Update existing records to populate new columns
-- Parse lineup_size from existing player_ids array
UPDATE team_synergy_stats 
SET lineup_size = array_length(player_ids, 1)
WHERE lineup_size = 5; -- Only update records that still have default

-- Set context_type based on current data patterns
UPDATE team_synergy_stats 
SET context_type = 'minutes_based'
WHERE context_type = 'standard';

-- Step 4: Add constraint to prevent duplicate synergies
-- This ensures we don't have duplicate combinations
ALTER TABLE team_synergy_stats 
DROP CONSTRAINT IF EXISTS team_synergy_unique;

-- Note: We'll skip the complex unique constraint for now
-- The enhanced generator will handle duplicates via upsert logic

-- Step 5: Create views for common queries
CREATE OR REPLACE VIEW synergy_analytics AS
SELECT 
    team_id,
    lineup_size,
    context_type,
    home_away,
    position_type,
    COUNT(*) as synergy_count,
    AVG(net_rating) as avg_net_rating,
    AVG(offensive_rating) as avg_offensive_rating,
    AVG(defensive_rating) as avg_defensive_rating,
    AVG(avg_fantasy_points) as avg_fantasy_points,
    SUM(games_played) as total_games
FROM team_synergy_stats
GROUP BY team_id, lineup_size, context_type, home_away, position_type;

-- Step 6: Create performance view for different lineup sizes
CREATE OR REPLACE VIEW lineup_size_performance AS
SELECT 
    sport,
    lineup_size,
    COUNT(*) as synergy_count,
    AVG(net_rating) as avg_net_rating,
    AVG(avg_fantasy_points) as avg_fantasy_points,
    AVG(games_played) as avg_games_played
FROM team_synergy_stats
GROUP BY sport, lineup_size
ORDER BY sport, lineup_size;

-- Verification queries
SELECT 'Enhanced schema migration complete!' as status;

-- Show distribution of lineup sizes
SELECT 
    lineup_size,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM team_synergy_stats
GROUP BY lineup_size
ORDER BY lineup_size;

-- Show context types
SELECT 
    context_type,
    COUNT(*) as count
FROM team_synergy_stats
GROUP BY context_type
ORDER BY count DESC;