@echo off
echo Testing PostgreSQL Connection...
echo ================================
echo.

set /p PGPASSWORD="Enter your PostgreSQL password: "

echo.
echo Testing connection to PostgreSQL on port 5434...
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -p 5434 -c "SELECT version();"

if %errorlevel% equ 0 (
    echo.
    echo SUCCESS! PostgreSQL is working!
    echo.
    echo Now creating database...
    "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -p 5434 -c "CREATE DATABASE fantasy_ai_local;"
    echo.
    echo Database created!
) else (
    echo.
    echo Connection failed. Please check:
    echo 1. Is the password correct?
    echo 2. Is PostgreSQL running on port 5434?
)

echo.
pause