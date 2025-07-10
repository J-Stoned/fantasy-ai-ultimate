# 🚨 EXECUTE THIS IN SUPABASE SQL EDITOR

## Instructions:

1. Go to your Supabase Dashboard: https://app.supabase.com/project/pvekvqiqrrpugfmpgaup
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"
4. Copy and paste the SQL from `DELETE-FAKE-DATA-SQL.sql`
5. Click "Run" 

## What this will do:

- ❌ DELETE 82,755 fake games with NULL external_id
- ❌ DELETE all test players (patterns: 175133, test, demo, sample, null names)
- ❌ DELETE millions of fake stats records
- ❌ DELETE orphaned records
- ✅ KEEP all real data (NFL, NCAA, MLB, NHL, NBA players with valid external_ids)

## Expected result:

From:
- 86,845 games → ~4,000 real games
- 23,089 players → ~19,000 real players  
- 1.5M stats → only real stats

Your database will be 100% REAL DATA!

## Alternative: Run via script

If you prefer, here's a script that executes the SQL directly:

```bash
npx tsx scripts/execute-sql-cleanup.ts
```