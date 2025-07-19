@echo off
echo =====================================================
echo Setting up Fantasy AI Database on Port 5434
echo =====================================================
echo.

set PGPASSWORD=postgres
set PGPORT=5434
set PSQL="C:\Program Files\PostgreSQL\17\bin\psql.exe"

echo Creating database...
%PSQL% -U postgres -h localhost -p 5434 -c "CREATE DATABASE fantasy_ai_local;"
if %errorlevel% neq 0 (
    echo Database might already exist, continuing...
)

echo.
echo Creating extensions...
%PSQL% -U postgres -h localhost -p 5434 -d fantasy_ai_local -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
%PSQL% -U postgres -h localhost -p 5434 -d fantasy_ai_local -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

echo.
echo =====================================================
echo Database setup complete!
echo =====================================================
echo.
echo Your connection string:
echo DATABASE_URL=postgresql://postgres:postgres@localhost:5434/fantasy_ai_local
echo.
echo Next: Run update-env-local-5434.ts to update your config
echo.
pause