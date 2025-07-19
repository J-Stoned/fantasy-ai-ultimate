@echo off
echo =====================================================
echo Setting up PostgreSQL on Port 5434
echo =====================================================
echo.

REM Set the port and password
set PGPORT=5434
set PGPASSWORD=postgres

REM Check if PostgreSQL is installed
if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" (
    echo PostgreSQL 16 found!
    set PSQL="C:\Program Files\PostgreSQL\16\bin\psql.exe"
) else if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" (
    echo PostgreSQL 15 found!
    set PSQL="C:\Program Files\PostgreSQL\15\bin\psql.exe"
) else (
    echo ERROR: PostgreSQL not found!
    echo Please complete the installation first.
    pause
    exit /b 1
)

echo.
echo Creating fantasy_ai_local database on port 5434...
echo.

REM Create database
%PSQL% -U postgres -p 5434 -c "CREATE DATABASE fantasy_ai_local;"

REM Create extensions
echo Creating extensions...
%PSQL% -U postgres -p 5434 -d fantasy_ai_local -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
%PSQL% -U postgres -p 5434 -d fantasy_ai_local -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

echo.
echo =====================================================
echo Database setup complete!
echo =====================================================
echo.
echo Connection Details:
echo Host: localhost
echo Port: 5434
echo Database: fantasy_ai_local
echo Username: postgres
echo Password: postgres
echo.
echo Connection string:
echo DATABASE_URL=postgresql://postgres:postgres@localhost:5434/fantasy_ai_local
echo.
pause