# 🗄️ Database Setup Instructions

## Quick Setup (Recommended)

1. **Update your `.env.local` file** with your Supabase credentials

2. **Go to Supabase SQL Editor** (in your project dashboard)

3. **Run migrations in order**:
   - First, run the contents of `supabase/migrations/001_initial_schema.sql`
   - Then, run the contents of `supabase/migrations/002_additional_data_tables.sql`
   - Finally, run the contents of `supabase/seed.sql`

4. **Verify tables were created**:
   ```sql
   -- Run this to check
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public'
   ORDER BY table_name;
   ```

## Alternative: Using Prisma (Advanced)

If you prefer using Prisma CLI:

```bash
# Make sure your DATABASE_URL is set in .env.local
npx prisma db push
```

This will create all tables based on the Prisma schema.

## Verify Your Connection

Test your connection by running:

```bash
npx prisma db pull
```

This should show "Introspected X tables" if successful.

## Enable Realtime

In Supabase dashboard:
1. Go to Database → Replication
2. Enable replication for these tables:
   - `players`
   - `fantasy_leagues`
   - `fantasy_teams`
   - `player_stats`

## Set Up Row Level Security

For production, enable RLS:
1. Go to Authentication → Policies
2. The migration already includes basic policies
3. Test with different user roles

## Troubleshooting

**Connection refused?**
- Check your DATABASE_URL format
- Ensure your IP is allowed (Settings → Database → Connection Pooling)

**Tables not created?**
- Check for errors in SQL editor
- Ensure you ran migrations in order

**Prisma errors?**
- Run `npx prisma generate` after schema changes
- Check that all enum types match between Prisma and SQL

## Next Steps

Once connected:
1. Run the app: `npx nx dev web`
2. Create a test account
3. Try importing a league
4. Check the player database

Your database is now ready to store EVERY player from EVERY league! 🎉