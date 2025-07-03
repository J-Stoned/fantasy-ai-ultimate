# Schema Enhancement Scripts

These scripts add complex schema features to your existing database while maintaining compatibility with the integer-based schema.

## Why Split Into Parts?

The original SQL file was too large and caused timeouts in Supabase. These smaller scripts can be run individually without timeout issues.

## Installation Order

Run these scripts in order through your Supabase SQL Editor:

1. **01-add-columns.sql** - Adds new columns to existing tables (external_id, metadata, etc.)
2. **02-create-tables.sql** - Creates new tables (player_platform_mapping, player_game_logs, etc.)
3. **03-create-indexes.sql** - Adds performance indexes
4. **04-update-data.sql** - Populates new columns with data
5. **05-create-functions.sql** - Creates helper functions and triggers
6. **06-create-views.sql** - Creates views (optional, may skip if causing issues)

## Verification

After running all scripts, run:
- **00-verify.sql** - Checks if all enhancements were applied successfully

## What This Adds

- **External ID tracking** - For ESPN, BallDontLie, and other API integrations
- **Player platform mapping** - Maps external player IDs to your database IDs
- **Game logs table** - Stores detailed per-game stats in JSONB format
- **Season stats table** - Aggregated season statistics
- **Helper functions** - Unified interface for accessing stats
- **Update triggers** - Automatic timestamp updates

## Troubleshooting

If you get errors:

1. **Timeout errors** - Run scripts one at a time
2. **Type mismatch errors** - Make sure to run 02-create-tables.sql which drops tables with wrong types
3. **View creation errors** - Skip 06-create-views.sql if it causes issues
4. **Permission errors** - Make sure you're using the service role key

## Next Steps

After applying these enhancements:

1. Run the enhanced ESPN collector: `npx tsx scripts/espn-collector-enhanced.ts`
2. Verify data is being collected properly
3. Update ML training to use the new schema features