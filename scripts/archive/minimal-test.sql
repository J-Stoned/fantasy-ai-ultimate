-- 🔍 MINIMAL TEST - Find what's causing the city error

-- Test 1: Create a completely unrelated table
CREATE TABLE IF NOT EXISTS test_table_123 (
    id INTEGER PRIMARY KEY,
    name VARCHAR(50)
);

SELECT 'If you see this, basic CREATE TABLE works' as test1_result;

-- Test 2: Create a table with "city" column
CREATE TABLE IF NOT EXISTS test_city_table (
    id INTEGER PRIMARY KEY,
    city VARCHAR(50)
);

SELECT 'If you see this, tables with city columns work' as test2_result;

-- Test 3: Check for database event triggers
SELECT 
    evtname as trigger_name,
    evtevent as event,
    evtowner::regrole as owner,
    evtfoid::regproc as function_name,
    evtenabled as enabled
FROM pg_event_trigger
WHERE evtenabled != 'D';

-- Test 4: Check for any rules on tables
SELECT 
    schemaname,
    tablename,
    rulename,
    definition
FROM pg_rules
WHERE schemaname = 'public';

-- Test 5: Check session settings
SHOW ALL;

-- Clean up test tables
DROP TABLE IF EXISTS test_table_123;
DROP TABLE IF EXISTS test_city_table;