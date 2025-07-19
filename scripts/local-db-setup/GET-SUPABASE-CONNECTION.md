# 🚀 Get Your Supabase Connection String

## Step 1: Go to Supabase Dashboard
1. Open: https://app.supabase.com
2. Select your Fantasy AI project

## Step 2: Get Connection String
1. Click **Settings** (gear icon) in the left sidebar
2. Click **Database** 
3. Scroll down to **Connection string** section
4. You'll see something like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.abcdefghijklmnop.supabase.co:5432/postgres
   ```

## Step 3: Add to .env.local
Add this line to your `.env.local` file:
```
SUPABASE_DIRECT_URL=postgresql://postgres:[YOUR-PASSWORD]@db.abcdefghijklmnop.supabase.co:5432/postgres
```

**IMPORTANT**: Replace `[YOUR-PASSWORD]` with your actual Supabase database password!

## Step 4: Run Direct Copy
Once you have the connection string, run:
```bash
npx tsx scripts/local-db-setup/direct-copy-supabase.ts yourPostgresPassword
```

This will:
- Connect directly to both databases
- Copy all tables with their data
- No CSV exports needed!
- Handle large tables automatically
- Show progress as it copies

## 🎯 This is the BEST method because:
- ✅ No file exports/imports
- ✅ Direct PostgreSQL to PostgreSQL
- ✅ Preserves all data types correctly
- ✅ Handles large tables efficiently
- ✅ One command does everything!