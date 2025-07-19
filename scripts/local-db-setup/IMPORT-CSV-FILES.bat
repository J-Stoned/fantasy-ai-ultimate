@echo off
echo =====================================================
echo     CSV Import to PostgreSQL
echo =====================================================
echo.
echo This will import your Supabase CSV exports
echo.

set /p CSV_FOLDER="Enter path to CSV folder (or press Enter for default): "
if "%CSV_FOLDER%"=="" set CSV_FOLDER=C:\Users\st0ne\Downloads\fantasy-ai-data

echo.
echo Looking for CSV files in: %CSV_FOLDER%
echo.

if not exist "%CSV_FOLDER%" (
    echo ERROR: Folder not found!
    echo Please create the folder and put your CSV files there.
    pause
    exit /b 1
)

dir "%CSV_FOLDER%\*.csv" /b
echo.

set /p PGPASSWORD="Enter your PostgreSQL password: "

echo.
echo Starting import...
echo.

npx tsx scripts/local-db-setup/import-csv-to-postgres.ts "%PGPASSWORD%"

echo.
echo =====================================================
echo Import process complete!
echo =====================================================
pause