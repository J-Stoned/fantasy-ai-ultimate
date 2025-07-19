@echo off
echo =====================================================
echo     DIRECT DATA COPY (NO NPM INSTALL)
echo =====================================================
echo.
echo Starting copy immediately...
echo.

cd /d "C:\Users\st0ne\Hey Fantasy\fantasy-ai-ultimate"

echo Running the copy script directly...
echo This should take 5-15 minutes for all data.
echo.

node scripts\local-db-setup\simple-copy-script.js

if %errorlevel% neq 0 (
    echo.
    echo Trying with tsx...
    npx tsx scripts\local-db-setup\simple-copy-script.ts
)

echo.
echo =====================================================
echo Process complete!
echo =====================================================
echo.
echo Checking what tables were created...
set PGPASSWORD=postgres
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -p 5432 -d fantasy_ai_local -c "\dt"

echo.
pause