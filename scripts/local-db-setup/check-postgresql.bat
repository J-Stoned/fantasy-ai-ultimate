@echo off
echo Checking for PostgreSQL installation...
echo =====================================
echo.

REM Check common PostgreSQL locations
if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" (
    echo [FOUND] PostgreSQL 16 in Program Files
    "C:\Program Files\PostgreSQL\16\bin\psql.exe" --version
    echo.
    echo PostgreSQL is installed!
    echo.
    echo To add to PATH, run: add-to-path.bat
) else if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" (
    echo [FOUND] PostgreSQL 15 in Program Files
    "C:\Program Files\PostgreSQL\15\bin\psql.exe" --version
) else if exist "C:\Program Files\PostgreSQL\14\bin\psql.exe" (
    echo [FOUND] PostgreSQL 14 in Program Files
    "C:\Program Files\PostgreSQL\14\bin\psql.exe" --version
) else (
    echo [NOT FOUND] PostgreSQL is not installed in the standard location
    echo.
    echo Please run the PostgreSQL installer you downloaded.
    echo.
    echo Installation tips:
    echo - Use password: postgres
    echo - Use default port: 5432
    echo - Install to default location
)

echo.
pause