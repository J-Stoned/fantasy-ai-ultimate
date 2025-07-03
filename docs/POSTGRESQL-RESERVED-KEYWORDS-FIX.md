# PostgreSQL Reserved Keywords Fix

## Issue
When running the schema enhancement SQL, we encountered:
```
ERROR:  42601: syntax error at or near "position"
LINE 165:   position TEXT,
```

## Cause
`position` is a reserved keyword in PostgreSQL and cannot be used as a column name in function return types without quoting.

## Solution
Created `enhance-schema-for-complex-features-v2.sql` with the following fixes:

1. **Function Return Types**: Changed column names to avoid reserved keywords
   ```sql
   -- Before (causes error):
   RETURNS TABLE(
     position TEXT,
   )
   
   -- After (fixed):
   RETURNS TABLE(
     player_position TEXT,
   )
   ```

2. **Column Aliases**: Added explicit aliases in SELECT statements
   ```sql
   SELECT 
     p.position AS player_position,
   ```

3. **Trigger Existence Checks**: Added checks to prevent duplicate trigger creation
   ```sql
   DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_name') THEN
       CREATE TRIGGER trigger_name...
     END IF;
   END $$;
   ```

## Other PostgreSQL Reserved Keywords to Avoid
- position
- user
- order
- group
- table
- column
- check
- default
- time
- timestamp
- date
- desc
- asc
- select
- from
- where

## Best Practices
1. Always use prefixes for function return columns (e.g., `player_position` instead of `position`)
2. Use double quotes for identifiers if you must use reserved words: `"position"`
3. Check trigger existence before creating to allow re-running scripts
4. Test SQL in smaller chunks to identify syntax errors quickly

## Files Updated
- Created: `scripts/enhance-schema-for-complex-features-v2.sql`
- Updated: `scripts/apply-schema-enhancements.ts` to reference v2