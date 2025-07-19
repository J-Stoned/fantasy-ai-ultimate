# 🚀 Export Supabase Data Using pg_dump

Since the data is large (672K+ rows in player_game_logs), the most reliable way is to use Supabase's built-in export feature.

## Option 1: Supabase Dashboard Export (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to your project: https://app.supabase.com
   
2. **Export Full Database**
   - Go to: Settings → Database → Backups
   - Click "Download backup"
   - Choose "Data only" or "Schema and data"
   - This will give you a complete SQL dump file

3. **Import to Local PostgreSQL**
   ```bash
   # Create database
   createdb fantasy_ai_local
   
   # Import the dump
   psql -U postgres fantasy_ai_local < supabase_dump.sql
   ```

## Option 2: Direct pg_dump Connection

If you have direct database access:

```bash
# Get connection string from Supabase
# Format: postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Export schema and data
pg_dump "postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  --no-owner \
  --no-privileges \
  --verbose \
  --file=fantasy_ai_dump.sql

# Or export specific tables
pg_dump "postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" \
  --no-owner \
  --no-privileges \
  --table=games \
  --table=players \
  --table=player_game_logs \
  --table=player_stats \
  --table=betting_lines \
  --table=weather_data \
  --data-only \
  --file=fantasy_ai_data.sql
```

## Option 3: Use Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref [YOUR-PROJECT-REF]

# Dump database
supabase db dump --data-only > fantasy_ai_data.sql
```

## Why This Is Better

1. **Handles Large Data**: pg_dump is designed for large databases
2. **Preserves Relationships**: Maintains foreign keys and constraints
3. **Faster**: Direct database-to-database transfer
4. **Reliable**: Built-in retry and error handling
5. **Complete**: Gets all data without API limits

## After Export

Once you have the SQL dump file:

1. Create local database:
   ```bash
   createdb fantasy_ai_local
   ```

2. Import the data:
   ```bash
   psql -U postgres fantasy_ai_local < fantasy_ai_dump.sql
   ```

3. Apply performance optimizations from `postgresql-performance.conf`

4. Update `.env.local`:
   ```env
   DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/fantasy_ai_local
   ```

Your local database will be 10-50x faster than Supabase cloud!