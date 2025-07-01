-- 🔧 ADD COLUMNS TO EXISTING TABLES (One at a time to isolate errors)

-- Test each column addition separately to see which one fails

-- 1. Players table columns
SELECT 'Adding columns to players table...' as status;

ALTER TABLE players ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE;
SELECT 'Added external_id to players' as result;

ALTER TABLE players ADD COLUMN IF NOT EXISTS sport_id VARCHAR(20);
SELECT 'Added sport_id to players' as result;

ALTER TABLE players ADD COLUMN IF NOT EXISTS birthdate DATE;
SELECT 'Added birthdate to players' as result;

ALTER TABLE players ADD COLUMN IF NOT EXISTS college VARCHAR(100);
SELECT 'Added college to players' as result;

ALTER TABLE players ADD COLUMN IF NOT EXISTS experience INTEGER;
SELECT 'Added experience to players' as result;

-- 2. Games table columns
SELECT 'Adding columns to games table...' as status;

ALTER TABLE games ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE;
SELECT 'Added external_id to games' as result;

ALTER TABLE games ADD COLUMN IF NOT EXISTS sport_id VARCHAR(20);
SELECT 'Added sport_id to games' as result;

ALTER TABLE games ADD COLUMN IF NOT EXISTS week INTEGER;
SELECT 'Added week to games' as result;

ALTER TABLE games ADD COLUMN IF NOT EXISTS season INTEGER;
SELECT 'Added season to games' as result;

-- 3. Teams table columns (skip city!)
SELECT 'Adding columns to teams table...' as status;

ALTER TABLE teams ADD COLUMN IF NOT EXISTS sport_id VARCHAR(20);
SELECT 'Added sport_id to teams' as result;

ALTER TABLE teams ADD COLUMN IF NOT EXISTS conference VARCHAR(50);
SELECT 'Added conference to teams' as result;

ALTER TABLE teams ADD COLUMN IF NOT EXISTS division VARCHAR(50);
SELECT 'Added division to teams' as result;

ALTER TABLE teams ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE;
SELECT 'Added external_id to teams' as result;

SELECT '✅ All columns added successfully!' as final_status;