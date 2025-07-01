-- 🔍 DIAGNOSE WHY CITY COLUMN ERROR KEEPS HAPPENING

-- 1. Check if teams table exists and what columns it has
SELECT 
    '=== TEAMS TABLE STRUCTURE ===' as diagnosis;

SELECT 
    table_name,
    column_name,
    data_type,
    ordinal_position
FROM information_schema.columns
WHERE table_name = 'teams'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check if teams_master exists
SELECT 
    '=== TEAMS_MASTER TABLE STRUCTURE ===' as diagnosis;

SELECT 
    table_name,
    column_name,
    data_type,
    ordinal_position
FROM information_schema.columns
WHERE table_name = 'teams_master'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check ALL indexes in the database that might reference teams
SELECT 
    '=== ALL INDEXES CONTAINING "teams" ===' as diagnosis;

SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexdef LIKE '%teams%'
OR tablename LIKE '%teams%'
ORDER BY tablename, indexname;

-- 4. Check for views that might reference teams.city
SELECT 
    '=== VIEWS REFERENCING TEAMS ===' as diagnosis;

SELECT 
    viewname,
    definition
FROM pg_views
WHERE definition LIKE '%teams%'
AND schemaname = 'public';

-- 5. Check for functions/procedures
SELECT 
    '=== FUNCTIONS REFERENCING TEAMS ===' as diagnosis;

SELECT 
    proname as function_name,
    prosrc as source_code
FROM pg_proc
WHERE prosrc LIKE '%teams%city%'
OR prosrc LIKE '%teams%.city%';

-- 6. Check for triggers
SELECT 
    '=== TRIGGERS ON TEAMS TABLES ===' as diagnosis;

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('teams', 'teams_master');

-- 7. Check RLS policies
SELECT 
    '=== RLS POLICIES ON TEAMS ===' as diagnosis;

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename IN ('teams', 'teams_master');

-- 8. Check constraints
SELECT 
    '=== CONSTRAINTS ON TEAMS ===' as diagnosis;

SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid IN (
    'public.teams'::regclass,
    'public.teams_master'::regclass
);