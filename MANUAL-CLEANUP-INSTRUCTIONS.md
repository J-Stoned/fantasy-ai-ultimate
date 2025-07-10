# 🚨 MANUAL CLEANUP REQUIRED

The automated cleanup is hitting timeouts. Here's how to finish manually:

## Current Status:
- **Total games**: 29,077
- **Fake games remaining**: 24,971
- **Real games**: 4,105

## Option 1: Supabase Dashboard (RECOMMENDED)

1. Go to your Supabase SQL Editor:
   https://app.supabase.com/project/pvekvqiqrrpugfmpgaup/sql/new

2. Run this to increase timeout first:
   ```sql
   SET statement_timeout = '10min';
   ```

3. Then run the cleanup:
   ```sql
   -- Delete in smaller chunks to avoid timeout
   DO $$
   DECLARE
       deleted_count INT := 0;
   BEGIN
       LOOP
           -- Delete related player_stats first
           DELETE FROM player_stats 
           WHERE game_id IN (
               SELECT id FROM games 
               WHERE external_id IS NULL 
               LIMIT 1000
           );
           
           -- Delete games
           WITH deleted AS (
               DELETE FROM games 
               WHERE external_id IS NULL
               AND id IN (
                   SELECT id FROM games 
                   WHERE external_id IS NULL 
                   LIMIT 1000
               )
               RETURNING *
           )
           SELECT COUNT(*) INTO deleted_count FROM deleted;
           
           EXIT WHEN deleted_count = 0;
           
           RAISE NOTICE 'Deleted % games...', deleted_count;
       END LOOP;
   END $$;
   ```

## Option 2: Check Database Status

Your database might be:
1. **Paused** - Check at https://app.supabase.com/project/pvekvqiqrrpugfmpgaup
2. **Rate limited** - Free tier has limits
3. **Out of compute credits** - Check your usage

## Option 3: Contact Support

If nothing works, contact Supabase support about the timeout issues.

## What's Next:

Once cleanup is complete, we'll have:
- Only 4,105 real games
- Clean database ready for real data collection
- Can run all our collectors (NFL, NBA, MLB, NHL, NCAA)
- Start collecting player stats for pattern detection
- Achieve 76.4% accuracy target!