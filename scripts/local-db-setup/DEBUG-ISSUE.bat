@echo off
echo =====================================================
echo     DEBUGGING DATABASE COPY ISSUE
echo =====================================================
echo.

cd /d "C:\Users\st0ne\Hey Fantasy\fantasy-ai-ultimate"

echo Current directory:
cd
echo.

echo Node version:
node --version 2>&1
echo.

echo NPM version:
npm --version 2>&1
echo.

echo Testing PostgreSQL connection with psql:
set PGPASSWORD=postgres
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -p 5432 -d fantasy_ai_local -c "SELECT 'PostgreSQL is working!' as status;" 2>&1
echo.

echo Checking if .env.local exists:
if exist .env.local (
    echo .env.local found
) else (
    echo .env.local NOT FOUND!
)
echo.

echo Running simple Node test:
node -e "console.log('Node.js is working!');" 2>&1
echo.

echo.
echo =====================================================
echo Press any key to try the connection test...
echo =====================================================
pause

echo.
echo Running connection test:
node scripts\local-db-setup\test-connections-simple.js 2>&1

echo.
echo =====================================================
echo Debugging complete. Press any key to exit...
echo =====================================================
pause >nul