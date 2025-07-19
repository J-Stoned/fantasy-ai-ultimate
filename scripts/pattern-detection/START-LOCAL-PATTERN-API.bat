@echo off
echo.
echo ============================================
echo  STARTING LOCAL PATTERN DETECTION API
echo ============================================
echo.
echo Using local PostgreSQL for 72x faster queries!
echo.

cd /d "C:\Users\st0ne\Hey Fantasy\fantasy-ai-ultimate"

echo Starting API on port 3337...
npx tsx scripts/pattern-detection/production-pattern-api-v4-local.ts