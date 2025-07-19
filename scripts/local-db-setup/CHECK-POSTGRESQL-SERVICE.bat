@echo off
echo Checking PostgreSQL Service Status...
echo =====================================
echo.

echo Looking for PostgreSQL services:
sc query state= all | findstr "postgresql"
echo.

echo Checking if PostgreSQL is listening on port 5434:
netstat -an | findstr :5434
echo.

echo Starting PostgreSQL service if needed...
net start postgresql-x64-17
echo.

echo Checking again...
netstat -an | findstr :5434
echo.

pause