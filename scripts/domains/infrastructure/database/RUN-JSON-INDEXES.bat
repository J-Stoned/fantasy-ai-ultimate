@echo off
echo.
echo ========================================
echo  CREATING JSON INDEXES FOR POSTGRESQL
echo ========================================
echo.
echo This will create high-performance indexes
echo for the stats JSON column.
echo.
echo This may take a few minutes...
echo.

cd /d "C:\Users\st0ne\Hey Fantasy\fantasy-ai-ultimate"

echo Running index creation script...
npx tsx scripts/database/create-json-indexes.ts

echo.
echo ========================================
echo  INDEXES CREATED SUCCESSFULLY!
echo ========================================
echo.
echo Your pattern queries will now be
echo lightning fast!
echo.
pause