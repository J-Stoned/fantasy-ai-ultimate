-- 🚀 10X DEVELOPER FIX: Just add the missing columns!
-- Instead of changing all our code, add the columns to match what we're trying to insert

ALTER TABLE betting_lines 
ADD COLUMN IF NOT EXISTS away_moneyline INTEGER,
ADD COLUMN IF NOT EXISTS home_spread_odds INTEGER DEFAULT -110,
ADD COLUMN IF NOT EXISTS away_spread_odds INTEGER DEFAULT -110,
ADD COLUMN IF NOT EXISTS over_odds INTEGER DEFAULT -110,
ADD COLUMN IF NOT EXISTS under_odds INTEGER DEFAULT -110;

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'betting_lines' 
ORDER BY ordinal_position;