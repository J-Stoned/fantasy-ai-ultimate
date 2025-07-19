# 🚀 COMPLETE LOCAL POSTGRESQL SETUP GUIDE

## Your System Specs
- **CPU**: Ryzen 5 7600X (12 threads)
- **RAM**: 32GB
- **Expected Performance**: 10-50x faster than Supabase cloud

## Step 1: Install PostgreSQL 16 on Windows

### Download and Install
1. Go to: https://www.postgresql.org/download/windows/
2. Download PostgreSQL 16 installer
3. Run installer as Administrator
4. **IMPORTANT**: Remember the password you set for `postgres` user!
5. Use default port: 5432
6. Install Stack Builder: Yes (for additional tools)

### Verify Installation
Open Command Prompt:
```cmd
psql --version
```
Should show: `psql (PostgreSQL) 16.x`

## Step 2: Create Local Database

Open Command Prompt as Administrator:
```cmd
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE fantasy_ai_local;

# Connect to new database
\c fantasy_ai_local

# Create required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

# Exit
\q
```

## Step 3: Export Data from Supabase

### Option A: Supabase Dashboard (Easiest)
1. Go to your Supabase project
2. Navigate to: Settings → Database → Backups
3. Click "Download backup"
4. Choose: "Schema and data"
5. Save as: `fantasy_ai_backup.sql`

### Option B: Using Provided Scripts
We've already started exporting some tables:
- ✅ sports (5 records)
- ✅ teams (2,908 records)  
- ✅ players (85,131 records)
- ✅ games (45,263 records)
- ⏳ player_game_logs (672,567 records) - partial
- ⏳ player_stats (381,972 records) - partial

For large tables, use Supabase Dashboard export instead.

## Step 4: Import to Local PostgreSQL

### Import Full Backup (if using Option A)
```cmd
psql -U postgres fantasy_ai_local < fantasy_ai_backup.sql
```

### Import Individual Tables (if using Option B)
```cmd
cd scripts\local-db-setup\dumps
psql -U postgres fantasy_ai_local < import-all.sql
```

## Step 5: Apply Performance Optimizations

1. **Find postgresql.conf**:
   - Usually in: `C:\Program Files\PostgreSQL\16\data\postgresql.conf`

2. **Add these settings** (optimized for your 32GB RAM):
```conf
# Memory (for 32GB system)
shared_buffers = 8GB
effective_cache_size = 24GB
work_mem = 256MB
maintenance_work_mem = 2GB

# CPU (for Ryzen 5 7600X - 12 threads)
max_worker_processes = 12
max_parallel_workers = 12
max_parallel_workers_per_gather = 6

# SSD Optimizations
random_page_cost = 1.1
effective_io_concurrency = 200

# Disable synchronous commit for dev
synchronous_commit = off
```

3. **Restart PostgreSQL**:
   - Open Services (Win+R, type: services.msc)
   - Find "postgresql-x64-16"
   - Right-click → Restart

## Step 6: Update Application Configuration

Run the configuration updater:
```bash
npx tsx scripts/local-db-setup/update-env-local.ts
```

This will:
- Backup your current .env.local
- Update DATABASE_URL to use local PostgreSQL
- Add commands to switch between local/cloud

## Step 7: Verify Everything Works

Test the local database performance:
```bash
npx tsx scripts/local-db-setup/test-local-performance.ts
```

You should see:
- Simple queries: 5-10x faster
- Complex joins: 10-20x faster  
- Pattern detection: 20-50x faster

## Quick Commands

```bash
# Switch to local database
npm run db:local

# Switch back to cloud
npm run db:cloud

# Test performance
npx tsx scripts/local-db-setup/test-local-performance.ts
```

## Troubleshooting

### "psql: command not found"
- Add PostgreSQL to PATH: `C:\Program Files\PostgreSQL\16\bin`

### "FATAL: password authentication failed"
- Make sure you're using the correct password
- Update LOCAL_DB_PASSWORD in .env.local

### "database does not exist"
- Create it: `createdb fantasy_ai_local`

### Import is slow
- This is normal for 1M+ records
- Use pg_dump method for faster imports

## Expected Performance Gains

With your Ryzen 5 7600X + 32GB RAM:
- **Network latency**: 0ms (vs 20-50ms cloud)
- **Query execution**: 10-50x faster
- **Bulk operations**: 20-100x faster
- **All data in RAM**: Instant access to hot data
- **Full CPU usage**: All 12 threads available

## 🎉 Success Checklist

- [ ] PostgreSQL 16 installed
- [ ] Local database created
- [ ] Data imported from Supabase
- [ ] Performance settings applied
- [ ] .env.local updated
- [ ] Performance test shows improvements

Once complete, your pattern detection will FLY! 🚀