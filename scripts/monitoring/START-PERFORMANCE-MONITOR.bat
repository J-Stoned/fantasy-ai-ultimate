@echo off
echo.
echo ============================================
echo  POSTGRESQL PERFORMANCE MONITOR
echo ============================================
echo.
echo Real-time monitoring of query performance
echo and connection pool statistics
echo.
echo Press ESC or Q to exit
echo.

cd /d "C:\Users\st0ne\Hey Fantasy\fantasy-ai-ultimate"

npm install blessed blessed-contrib

echo.
echo Starting performance monitor...
echo.
npx tsx scripts/monitoring/query-performance-monitor.ts