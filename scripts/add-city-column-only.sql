-- 🚀 QUICK FIX - Add city column to teams table
-- Run this FIRST in Supabase SQL Editor

ALTER TABLE teams ADD COLUMN city VARCHAR(100);

-- Verify it worked
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'teams' 
ORDER BY ordinal_position;