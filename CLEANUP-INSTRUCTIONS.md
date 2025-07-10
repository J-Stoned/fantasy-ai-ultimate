# 🧹 FAKE DATA CLEANUP INSTRUCTIONS

The full cleanup is too large for one query. Run these **THREE STEPS IN ORDER**:

## STEP 1: Delete Fake Games
**File**: `CLEANUP-STEP-1.sql`

1. Go to: https://app.supabase.com/project/pvekvqiqrrpugfmpgaup/sql/new
2. Copy and paste the contents of `CLEANUP-STEP-1.sql`
3. Click "Run"
4. This will delete games 1,000 at a time
5. **If it times out**, just run it again! It will continue where it left off
6. Keep running until it shows "0 null_games"

## STEP 2: Delete Fake Players  
**File**: `CLEANUP-STEP-2.sql`

1. Same SQL editor
2. Copy and paste the contents of `CLEANUP-STEP-2.sql`
3. Click "Run"
4. This deletes 5,000 fake players at a time
5. **If needed**, run multiple times until "players_without_names" shows 0

## STEP 3: Final Verification
Run this query to see your clean database:

```sql
SELECT 
    'FINAL STATUS' as status,
    (SELECT COUNT(*) FROM players) as total_players,
    (SELECT COUNT(*) FROM games) as total_games,
    (SELECT COUNT(*) FROM games WHERE external_id IS NOT NULL) as real_games,
    (SELECT COUNT(*) FROM player_stats) as total_stats;
```

## Expected Results After Cleanup:
- ~19,000 real players (down from 23,089)
- ~4,000 real games (down from 86,845)
- Much smaller player_stats table

## If Timeouts Continue:
You can also run smaller batches by changing the LIMIT values in the SQL files from 1000 to 500 or even 100.

The key is: **Keep running until the fake data is gone!**