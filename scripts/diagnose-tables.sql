-- 🔍 DIAGNOSTIC SCRIPT - RUN THIS FIRST
-- This will show us exactly what tables and columns exist

-- 1. Show all tables
SELECT 
    '=== ALL TABLES ===' as info;
    
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Show columns in teams table (if it exists)
SELECT 
    '=== TEAMS TABLE COLUMNS ===' as info;
    
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'teams'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Show columns in players table
SELECT 
    '=== PLAYERS TABLE COLUMNS ===' as info;
    
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'players'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Show columns in games table
SELECT 
    '=== GAMES TABLE COLUMNS ===' as info;
    
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'games'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Check if we have teams_master table
SELECT 
    '=== TEAMS_MASTER CHECK ===' as info;
    
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'teams_master'
AND table_schema = 'public'
AND column_name IN ('id', 'name', 'city', 'abbreviation')
ORDER BY ordinal_position;