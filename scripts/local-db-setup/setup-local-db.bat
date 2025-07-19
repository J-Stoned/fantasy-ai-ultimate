@echo off
REM Setup Local PostgreSQL for Fantasy AI
REM Run this as Administrator

echo ===============================================
echo Fantasy AI Local Database Setup
echo ===============================================
echo.

REM Check if PostgreSQL is installed
where psql >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: PostgreSQL is not installed or not in PATH
    echo.
    echo Please install PostgreSQL from:
    echo https://www.postgresql.org/download/windows/
    echo.
    echo After installation, add PostgreSQL bin to PATH:
    echo Usually: C:\Program Files\PostgreSQL\16\bin
    echo.
    pause
    exit /b 1
)

echo PostgreSQL found!
echo.

REM Get PostgreSQL password
set /p PGPASSWORD="Enter PostgreSQL postgres user password: "

REM Create database
echo Creating fantasy_ai_local database...
psql -U postgres -c "CREATE DATABASE fantasy_ai_local;"
if %errorlevel% neq 0 (
    echo Database might already exist, continuing...
)

REM Create extensions
echo Creating required extensions...
psql -U postgres -d fantasy_ai_local -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
psql -U postgres -d fantasy_ai_local -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

echo.
echo ===============================================
echo Local database created successfully!
echo ===============================================
echo.
echo Next steps:
echo 1. Run: npm run export-supabase-data
echo 2. Import the schema from Supabase
echo 3. Run: npm run import-local-data
echo 4. Update postgresql.conf with performance settings
echo 5. Restart PostgreSQL service
echo.
pause