@echo off
echo =====================================================
echo     COMPLETE POSTGRESQL SETUP AND DATA COPY
echo =====================================================
echo.
echo This will:
echo   1. Create your database
echo   2. Copy all data from Supabase
echo   3. Update your connection settings
echo.
pause

set PGPASSWORD=postgres

echo.
echo Checking PostgreSQL service...
sc query postgresql-x64-16 | findstr "RUNNING"
if %errorlevel% neq 0 (
    echo Starting PostgreSQL service...
    net start postgresql-x64-16
    timeout /t 5
)

echo.
echo Creating database...
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -p 5432 -c "CREATE DATABASE fantasy_ai_local;" 2>nul

echo Creating extensions...
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -p 5432 -d fantasy_ai_local -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>nul
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -p 5432 -d fantasy_ai_local -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" 2>nul

echo.
echo Database ready! Now copying data from Supabase...
echo This will take 5-10 minutes for 700K+ rows...
echo.

cd /d "C:\Users\st0ne\Hey Fantasy\fantasy-ai-ultimate"
call npx tsx scripts/local-db-setup/simple-copy-script.ts

echo.
echo =====================================================
echo ALL DONE! Your local database is ready!
echo =====================================================
echo.
echo Test it with: npx tsx scripts/local-db-setup/test-local-connection.ts
echo.
pause