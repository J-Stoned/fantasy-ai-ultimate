@echo off
echo.
echo Checking what's running on port 3337...
echo ========================================
echo.

netstat -ano | findstr :3337

echo.
echo ========================================
echo.
echo If you see multiple LISTENING entries above,
echo you have multiple instances running.
echo.
echo To kill all processes on port 3337:
echo Run this command as Administrator:
echo.
echo for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3337 ^| findstr LISTENING') do taskkill /PID %%a /F
echo.
pause