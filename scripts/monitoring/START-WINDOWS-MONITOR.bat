@echo off
echo.
echo ============================================
echo  STARTING WINDOWS PERFORMANCE MONITOR
echo ============================================
echo.
echo This monitor shows real-time PostgreSQL
echo query performance in your console.
echo.
echo Press Ctrl+C to exit
echo.

cd /d "C:\Users\st0ne\Hey Fantasy\fantasy-ai-ultimate"

npx tsx scripts/monitoring/windows-performance-monitor.ts