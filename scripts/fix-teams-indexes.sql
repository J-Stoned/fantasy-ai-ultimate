-- 🔧 FIX TEAMS TABLE INDEXES
-- Remove any indexes that reference non-existent city column

-- Step 1: Show existing indexes on teams table
SELECT 
    'Current indexes on teams table:' as info;
    
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'teams'
AND schemaname = 'public';

-- Step 2: Drop any indexes that might reference city column
DO $$
BEGIN
    -- Drop index if it exists
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_teams_name' AND tablename = 'teams') THEN
        DROP INDEX idx_teams_name;
        RAISE NOTICE 'Dropped idx_teams_name index';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_teams_city' AND tablename = 'teams') THEN
        DROP INDEX idx_teams_city;
        RAISE NOTICE 'Dropped idx_teams_city index';
    END IF;
END $$;

-- Step 3: Also check teams_master table
SELECT 
    'Current indexes on teams_master table:' as info;
    
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'teams_master'
AND schemaname = 'public';

-- Step 4: Drop problematic indexes on teams_master if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_teams_name' AND tablename = 'teams_master') THEN
        DROP INDEX idx_teams_name;
        RAISE NOTICE 'Dropped idx_teams_name index on teams_master';
    END IF;
END $$;

-- Step 5: Show what columns teams table actually has
SELECT 
    'Columns in teams table:' as info;
    
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'teams'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Step 6: Create a proper index on teams table (without city)
CREATE INDEX IF NOT EXISTS idx_teams_name_only ON teams(LOWER(name));
CREATE INDEX IF NOT EXISTS idx_teams_sport ON teams(sport_id);

SELECT '✅ Indexes fixed! Now you can run the create-tables-no-city.sql script' as status;