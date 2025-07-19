@echo off
echo Checking what's using port 5432...
echo ==================================
echo.

netstat -an | findstr :5432
echo.
echo Checking for PostgreSQL processes...
echo.
tasklist | findstr postgres

echo.
echo Checking services...
echo.
sc query | findstr "postgresql"

echo.
echo ==================================
echo.
echo If you see PostgreSQL above, it's already installed!
echo.
echo OPTIONS:
echo 1. Use the existing PostgreSQL installation
echo 2. Uninstall the old version first
echo 3. Use a different port (like 5433)
echo.
pause