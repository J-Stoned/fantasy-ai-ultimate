# Manual Cleanup Instructions for Fake Games

## Issue
The automated deletion scripts are timing out, even for single record deletions. This suggests there may be database constraints or performance issues preventing the deletion.

## Current Status
- **Total games**: 30,796
- **Fake games (NULL external_id)**: 26,691
- **Real games**: 4,105

## Manual Cleanup Steps

### Option 1: Supabase Dashboard SQL Editor

1. Go to your Supabase Dashboard: https://app.supabase.com/project/pvekvqiqrrpugfmpgaup
2. Navigate to the SQL Editor
3. Run these queries one by one:

```sql
-- First, check for any foreign key constraints
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND ccu.table_name = 'games';

-- Delete in smaller chunks to avoid timeout
-- Repeat this query multiple times until no rows are affected
DELETE FROM games 
WHERE id IN (
    SELECT id 
    FROM games 
    WHERE external_id IS NULL 
    LIMIT 1000
);

-- Check progress
SELECT COUNT(*) FROM games WHERE external_id IS NULL;
```

### Option 2: Create a Database Function

Run this in the SQL Editor:

```sql
CREATE OR REPLACE FUNCTION delete_fake_games_batch(batch_size INT DEFAULT 1000)
RETURNS TABLE(deleted_count INT) AS $$
DECLARE
    deleted INT;
BEGIN
    DELETE FROM games 
    WHERE id IN (
        SELECT id 
        FROM games 
        WHERE external_id IS NULL 
        LIMIT batch_size
    );
    
    GET DIAGNOSTICS deleted = ROW_COUNT;
    
    RETURN QUERY SELECT deleted;
END;
$$ LANGUAGE plpgsql;

-- Then call it repeatedly:
SELECT * FROM delete_fake_games_batch(1000);
```

### Option 3: Direct Database Access

If you have direct PostgreSQL access:

```bash
psql postgresql://postgres:[YOUR_PASSWORD]@db.pvekvqiqrrpugfmpgaup.supabase.co:5432/postgres

-- In psql:
BEGIN;
DELETE FROM games WHERE external_id IS NULL;
COMMIT;
```

### Option 4: Supabase Support

If none of the above work, there may be a database-level issue:

1. Check Supabase dashboard for any paused or rate-limited status
2. Contact Supabase support about the timeout issues
3. Consider temporarily increasing statement timeout:

```sql
SET statement_timeout = '10min';
DELETE FROM games WHERE external_id IS NULL;
```

## Why This Matters

Removing these 26,691 fake games is critical because:
- They're preventing the pattern detection system from reaching 76.4% accuracy
- They're adding noise to the data analysis
- They're consuming database resources

## Next Steps After Cleanup

Once the fake games are deleted:
1. Run pattern analysis on the clean dataset
2. Retrain ML models with only real game data
3. Expect accuracy improvement from 65.2% to 76.4%

## Alternative: Mark as Deleted

If deletion is not possible due to constraints:

```sql
-- Add a deleted flag column
ALTER TABLE games ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Mark fake games as deleted
UPDATE games SET is_deleted = TRUE WHERE external_id IS NULL;

-- Then update all queries to exclude deleted games
-- WHERE is_deleted = FALSE
```