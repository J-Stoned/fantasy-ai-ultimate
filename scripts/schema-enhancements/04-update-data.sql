-- Part 4: Update existing data
-- Run this after part 3

-- Update player name column if it exists and is empty
UPDATE players 
SET name = CONCAT(firstname, ' ', lastname)
WHERE (name IS NULL OR name = '')
  AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' 
    AND column_name = 'name'
  );

-- Update team column with team names
UPDATE players p
SET team = t.name
FROM teams t
WHERE p.team_id = t.id
  AND (p.team IS NULL OR p.team = '');

-- Update sport column based on sport_id
UPDATE players
SET sport = CASE 
  WHEN sport_id = 'nfl' THEN 'football'
  WHEN sport_id = 'nba' THEN 'basketball'
  WHEN sport_id = 'mlb' THEN 'baseball'
  WHEN sport_id = 'nhl' THEN 'hockey'
  ELSE sport_id
END
WHERE sport IS NULL OR sport = '';

-- Add some sample external IDs for testing (optional)
-- UPDATE players 
-- SET external_id = 'player_' || id::TEXT 
-- WHERE external_id IS NULL 
-- LIMIT 100;