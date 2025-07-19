@echo off
echo Creating PostgreSQL Extensions...
echo ================================
echo.

set /p PGPASSWORD="Enter your PostgreSQL password: "

echo.
echo Creating extensions in fantasy_ai_local database...
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -p 5434 -d fantasy_ai_local -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -p 5434 -d fantasy_ai_local -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

echo.
echo Extensions created!
echo.
echo ================================
echo Your local database is ready!
echo ================================
echo.
echo Connection details:
echo Host: localhost
echo Port: 5434
echo Database: fantasy_ai_local
echo Username: postgres
echo Password: [what you just entered]
echo.
pause