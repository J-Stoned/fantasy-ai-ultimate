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

npx tsx scripts/local-db-setup/copy-with-supabase-api.ts %PGPASSWORD%

echo.
echo =====================================================
echo Process complete! Check the output above.
echo =====================================================
pause