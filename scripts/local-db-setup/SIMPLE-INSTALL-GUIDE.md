# 🚀 Simple PostgreSQL Installation Guide

Since the automated installer had issues, let's do it the simple way!

## Option 1: Direct Download (Easiest)

1. **Open this link in your browser**:
   https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

2. **Download PostgreSQL 16 for Windows**:
   - Look for: Windows x86-64
   - Version: 16.x (latest)
   - Click the download link

3. **Run the installer**:
   - Double-click the downloaded file
   - Click "Next" through the installer
   - **IMPORTANT**: When asked for password, use: `postgres`
   - Use default port: 5432
   - Let it install Stack Builder (click Next)

4. **After installation**:
   - The installer will add PostgreSQL to your PATH automatically
   - You might need to restart your computer

## Option 2: Using Chocolatey (If you have it)

Open PowerShell as Administrator:
```powershell
choco install postgresql16 --params '/Password:postgres'
```

## After Installation:

1. **Test it works**:
   ```cmd
   psql --version
   ```
   Should show: `psql (PostgreSQL) 16.x`

2. **Create your database**:
   Open Command Prompt as Administrator:
   ```cmd
   psql -U postgres
   ```
   
   Enter password: `postgres`
   
   Then type:
   ```sql
   CREATE DATABASE fantasy_ai_local;
   \c fantasy_ai_local
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   \q
   ```

## That's it! 

Once PostgreSQL is installed, we'll:
1. Export your Supabase data
2. Import it locally
3. Update your app configuration
4. Enjoy 10-50x faster queries!

Let me know when you've downloaded the installer!