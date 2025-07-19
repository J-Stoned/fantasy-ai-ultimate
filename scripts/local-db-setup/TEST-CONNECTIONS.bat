@echo off
echo Testing database connections...
echo.

cd /d "C:\Users\st0ne\Hey Fantasy\fantasy-ai-ultimate"

node scripts\local-db-setup\test-connections-simple.js

echo.
pause