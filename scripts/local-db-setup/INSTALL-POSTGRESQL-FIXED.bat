@echo off
REM One-click PostgreSQL installer for Fantasy AI
REM This will download and install PostgreSQL 16 automatically

echo =====================================================
echo     POSTGRESQL 16 AUTOMATED INSTALLER
echo     For Fantasy AI Local Development
echo =====================================================
echo.
echo This script will:
echo   1. Download PostgreSQL 16 (about 350MB)
echo   2. Install it with optimized settings
echo   3. Create fantasy_ai_local database
echo   4. Apply performance settings for 32GB RAM
echo.
echo IMPORTANT: This must run as Administrator!
echo.
pause

REM Check for admin rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Not running as Administrator!
    echo.
    echo Please right-click this file and select "Run as Administrator"
    echo.
    pause
    exit /b 1
)

REM Set default password (you can change this)
set POSTGRES_PASSWORD=postgres

echo.
set /p POSTGRES_PASSWORD="Enter password for postgres user (default: postgres): "
if "%POSTGRES_PASSWORD%"=="" set POSTGRES_PASSWORD=postgres

echo.
echo Starting installation with password: %POSTGRES_PASSWORD%
echo.

REM Run PowerShell script (using the fixed version)
powershell.exe -ExecutionPolicy Bypass -File "%~dp0install-postgresql-windows-fixed.ps1" -PostgresPassword "%POSTGRES_PASSWORD%"

echo.
echo =====================================================
echo Installation process completed!
echo =====================================================
pause