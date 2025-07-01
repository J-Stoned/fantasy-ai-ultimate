-- 🔥 NUCLEAR OPTION - COMPLETELY FIX TEAMS TABLE

-- 1. First, let's see what's in the teams table
SELECT COUNT(*) as team_count FROM teams;

-- 2. Backup data if there's anything important
CREATE TEMP TABLE teams_backup AS 
SELECT * FROM teams;

-- 3. Drop ALL constraints, indexes, and dependencies on teams
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all foreign keys referencing teams
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE confrelid = 'public.teams'::regclass
    ) LOOP
        EXECUTE 'ALTER TABLE teams DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE';
    END LOOP;
    
    -- Drop all indexes on teams
    FOR r IN (
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'teams' 
        AND schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(r.indexname) || ' CASCADE';
    END LOOP;
    
    -- Drop all triggers on teams
    FOR r IN (
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'teams'
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON teams CASCADE';
    END LOOP;
END $$;

-- 4. Drop and recreate the teams table with a clean structure
DROP TABLE IF EXISTS teams CASCADE;

CREATE TABLE teams (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(10),
    sport_id VARCHAR(20),
    conference VARCHAR(50),
    division VARCHAR(50),
    external_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Restore data if there was any
INSERT INTO teams (id, name, abbreviation, sport_id, conference, division, external_id, created_at)
SELECT 
    id, 
    name, 
    abbreviation,
    sport_id,
    conference,
    division,
    external_id,
    created_at
FROM teams_backup
WHERE EXISTS (SELECT 1 FROM teams_backup LIMIT 1);

-- 6. Create clean indexes
CREATE INDEX idx_teams_name ON teams(LOWER(name));
CREATE INDEX idx_teams_sport ON teams(sport_id);
CREATE INDEX idx_teams_external ON teams(external_id);

-- 7. Show the result
SELECT 
    '✅ TEAMS TABLE REBUILT!' as status,
    COUNT(*) as records_restored
FROM teams;

-- 8. Show new structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'teams'
ORDER BY ordinal_position;