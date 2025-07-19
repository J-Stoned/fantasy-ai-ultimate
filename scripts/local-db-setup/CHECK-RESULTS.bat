@echo off
echo =====================================================
echo     CHECKING POSTGRESQL STATUS
echo =====================================================
echo.

echo 1. Checking if PostgreSQL service is running...
sc query postgresql-x64-16 | findstr "STATE"
echo.

echo 2. Checking what ports are listening...
netstat -an | findstr :5432
echo.

echo 3. Testing connection...
set PGPASSWORD=postgres
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -p 5432 -c "SELECT version();"
echo.

echo 4. Checking databases...
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -p 5432 -c "\l"
echo.

echo 5. If fantasy_ai_local exists, checking tables...
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -p 5432 -d fantasy_ai_local -c "\dt"
echo.

echo =====================================================
echo If you see tables listed above, the copy worked!
echo =====================================================
pause