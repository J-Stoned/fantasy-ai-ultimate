-- 🚀 QUICK FIX - Just add city column to teams table

-- Add city column to teams table if it doesn't exist
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS city VARCHAR(100);

-- Verify it worked
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'teams' 
AND table_schema = 'public'
ORDER BY ordinal_position;