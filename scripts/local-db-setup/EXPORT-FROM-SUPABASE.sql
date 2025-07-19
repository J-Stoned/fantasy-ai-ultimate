-- Run this in Supabase SQL Editor to export your schema and data
-- Copy the results and save as a .sql file

-- Step 1: Export Schema (structure only)
-- Run this query and copy the results:

SELECT 
    'CREATE TABLE IF NOT EXISTS ' || tablename || ' (' || 
    string_agg(
        column_name || ' ' || 
        data_type || 
        CASE 
            WHEN character_maximum_length IS NOT NULL 
            THEN '(' || character_maximum_length || ')'
            ELSE ''
        END ||
        CASE 
            WHEN is_nullable = 'NO' THEN ' NOT NULL'
            ELSE ''
        END,
        ', '
    ) || ');' as create_statement
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY tablename
ORDER BY tablename;

-- Step 2: For each table, generate INSERT statements
-- Replace 'your_table_name' with each table (games, players, etc.)

-- For smaller tables (< 10k rows), you can use:
SELECT 'INSERT INTO games VALUES ' || 
    string_agg(
        '(' || 
        quote_literal(id) || ',' ||
        quote_literal(sport_id) || ',' ||
        quote_literal(home_team_id) || ',' ||
        quote_literal(away_team_id) || ',' ||
        quote_literal(start_time) || ',' ||
        quote_literal(status) || ',' ||
        quote_literal(home_score) || ',' ||
        quote_literal(away_score) || ',' ||
        quote_literal(season) || ',' ||
        quote_literal(week) || ',' ||
        quote_literal(external_id) || ',' ||
        quote_literal(created_at) || ',' ||
        quote_literal(updated_at) ||
        ')',
        ','
    ) || ';'
FROM games
LIMIT 1000;