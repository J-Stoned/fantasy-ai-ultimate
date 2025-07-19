-- STEP 1: Fix NBA teams that are actually colleges
-- Quick fix - just update the sport field

BEGIN;

-- Show what we're fixing
SELECT 'College teams incorrectly marked as NBA:' as info;
SELECT id, name, external_id 
FROM teams 
WHERE sport = 'NBA' 
  AND name IN ('Arizona Wildcats', 'Kentucky Wildcats', 'Northwestern Wildcats', 'Villanova Wildcats');

-- Fix the sport
UPDATE teams 
SET sport = 'NCAA_BB' 
WHERE sport = 'NBA' 
  AND name IN ('Arizona Wildcats', 'Kentucky Wildcats', 'Northwestern Wildcats', 'Villanova Wildcats');

-- Verify
SELECT 'Fixed teams:' as status, COUNT(*) as count
FROM teams 
WHERE sport = 'NCAA_BB' 
  AND name IN ('Arizona Wildcats', 'Kentucky Wildcats', 'Northwestern Wildcats', 'Villanova Wildcats');

COMMIT;