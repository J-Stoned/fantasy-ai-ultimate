# 🎯 NEXT STEPS FOR CLEANUP

## Option 1: Batch Deletion (Recommended)
Run `CLEANUP-GAMES-BATCH.sql` multiple times until all fake games are gone:

1. Go to: https://app.supabase.com/project/pvekvqiqrrpugfmpgaup/sql/new
2. Copy and paste `CLEANUP-GAMES-BATCH.sql`
3. Click "Run"
4. Keep running it until it shows "0 fake_games_remaining"
5. Each run deletes 100 games (won't timeout)

## Option 2: Nuclear Cleanup (If Batch is Too Slow)
If you're tired of running batches:

1. Use `NUCLEAR-CLEANUP.sql`
2. This attempts to delete everything at once
3. May still timeout, but worth trying

## Option 3: Check Status
To see current progress:

1. Run `CHECK-CLEANUP-STATUS.sql`
2. This shows exactly how much fake data remains

## After Cleanup is Done:
Once we have clean data, we'll:
1. Fix the NCAA height parser bug
2. Build NBA, MLB, NHL collectors
3. Start collecting REAL player stats
4. Retrain ML models on REAL data only
5. Achieve that 76.4% accuracy target!

Current Status:
- ✅ Deleted ~3,000 fake players
- ⏳ Need to delete 82,755 fake games
- ⏳ Need to clean related player_stats