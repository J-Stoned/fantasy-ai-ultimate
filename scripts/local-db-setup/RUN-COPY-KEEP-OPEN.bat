@echo off
echo =====================================================
echo     SUPABASE TO LOCAL DATABASE COPY
echo =====================================================
echo.
echo This will copy your Supabase data to local PostgreSQL
echo.
echo Your Supabase project: pvekvqiqrrpugfmpgaup
echo Local PostgreSQL: localhost:5434
echo.

set /p PGPASSWORD="Enter your LOCAL PostgreSQL password: "

echo.
echo Starting data copy...
echo This may take 5-10 minutes for large tables.
echo.

cd /d "C:\Users\st0ne\Hey Fantasy\fantasy-ai-ultimate"

echo Current directory: %CD%
echo.
echo Running: npx tsx scripts/local-db-setup/copy-with-supabase-api.ts %PGPASSWORD%
echo.

npx tsx scripts/local-db-setup/copy-with-supabase-api.ts %PGPASSWORD%

echo.
echo =====================================================
echo Exit code: %ERRORLEVEL%
echo.
echo If you see errors above, please take a screenshot!
echo =====================================================
echo.
echo Press any key to close this window...
pause >nul