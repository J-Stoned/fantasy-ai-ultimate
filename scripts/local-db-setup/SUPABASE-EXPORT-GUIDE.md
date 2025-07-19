# 🚀 Easy Supabase Data Export (No pg_dump needed!)

## Option 1: Use Supabase Table Editor (Easiest!)

1. **Go to your Supabase project**
2. Click **Table Editor** in the left sidebar
3. For each table:
   - Select the table (games, players, etc.)
   - Click **Export** button (top right)
   - Choose **Export as CSV**
   - Save the file

### Tables to Export (in order):
1. `sports` (small)
2. `teams` (2.9K rows)
3. `players` (85K rows)
4. `games` (45K rows)
5. `player_game_logs` (672K rows - might need to export in chunks)
6. `player_stats` (382K rows)
7. `betting_lines` (39K rows)
8. `weather_data` (10K rows)
9. `player_injuries` (3K rows)

## Option 2: Direct Database Connection

Since Supabase uses PostgreSQL, you can connect directly:

1. **Get your connection string**:
   - Go to Settings → Database
   - Copy the "Connection string" (URI format)
   - It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

2. **Use pgAdmin or DBeaver** (free tools):
   - Download pgAdmin: https://www.pgadmin.org/download/
   - Connect using your Supabase connection string
   - Right-click database → Backup
   - Save as .sql file

## Option 3: Use Our Existing Exports

We already started exporting some data to:
```
C:\Users\st0ne\Hey Fantasy\fantasy-ai-ultimate\scripts\local-db-setup\dumps\
```

Files already there:
- sports.sql ✅
- teams.sql ✅
- players.sql ✅
- games.sql ✅

## Which Option?

- **For quick start**: Use the CSV export (Option 1)
- **For complete backup**: Use pgAdmin (Option 2)
- **For partial data**: Use existing exports (Option 3)

Let me know which you prefer!