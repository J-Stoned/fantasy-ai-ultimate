-- 🔍 CHECK TEAMS VS TEAMS_MASTER RELATIONSHIP

-- 1. Check if teams is a view of teams_master
SELECT 
    '=== IS TEAMS A VIEW? ===' as check;

SELECT 
    viewname,
    viewowner,
    definition
FROM pg_views
WHERE viewname = 'teams'
AND schemaname = 'public';

-- 2. Check if there's a foreign key relationship
SELECT 
    '=== FOREIGN KEYS INVOLVING TEAMS ===' as check;

SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE contype = 'f'
AND (conrelid::regclass::text LIKE '%teams%' 
     OR confrelid::regclass::text LIKE '%teams%');

-- 3. Check table inheritance
SELECT 
    '=== TABLE INHERITANCE ===' as check;

SELECT 
    inhrelid::regclass as child_table,
    inhparent::regclass as parent_table
FROM pg_inherits
WHERE inhrelid::regclass::text LIKE '%teams%'
OR inhparent::regclass::text LIKE '%teams%';

-- 4. List both tables' structures side by side
SELECT 
    '=== TEAMS TABLE ===' as table_info,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'teams'
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 
    '=== TEAMS_MASTER TABLE ===' as table_info,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'teams_master'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Check if teams might be referencing teams_master.city somehow
SELECT 
    '=== CHECK COLUMN REFERENCES ===' as check;

SELECT 
    table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND column_default LIKE '%teams%city%';