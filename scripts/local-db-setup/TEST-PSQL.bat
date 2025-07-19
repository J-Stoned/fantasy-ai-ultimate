@echo off
echo Testing PostgreSQL with a simple SQL file...
echo.

set PGPASSWORD=postgres

"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -p 5432 -d fantasy_ai_local -f scripts\local-db-setup\manual-copy-test.sql

echo.
echo If you see "Test 1, Test 2, Test 3" above, PostgreSQL is working!
echo.
pause