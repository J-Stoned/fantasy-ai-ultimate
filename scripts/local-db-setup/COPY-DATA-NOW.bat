@echo off
echo =====================================================
echo     COPYING SUPABASE DATA TO LOCAL POSTGRESQL
echo =====================================================
echo.
echo Your database is ready but empty.
echo Let's copy all your data now!
echo.
pause

cd /d "C:\Users\st0ne\Hey Fantasy\fantasy-ai-ultimate"

echo.
echo Starting data copy...
echo This will take 5-10 minutes for 700K+ rows
echo.

npx tsx scripts/local-db-setup/simple-copy-script.ts

echo.
echo =====================================================
echo Copy process finished!
echo =====================================================
echo.
echo Let's check if tables were created:
echo.

set PGPASSWORD=postgres
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -p 5432 -d fantasy_ai_local -c "\dt"

echo.
pause