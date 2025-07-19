@echo off
echo =====================================================
echo     TEST POSTGRESQL CONNECTION
echo =====================================================
echo.
echo PostgreSQL is running on ports: 5432, 5433, 5434
echo Let's find which one works with your password.
echo.

set /p PGPASSWORD="Enter YOUR PostgreSQL password (the one you set during install): "

echo.
echo Testing with your password...
echo.

cd /d "C:\Users\st0ne\Hey Fantasy\fantasy-ai-ultimate"
npx tsx scripts/local-db-setup/test-all-ports.ts "%PGPASSWORD%"

echo.
pause