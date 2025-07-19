@echo off
REM Import large tables with progress monitoring

echo Importing large tables...
echo.

echo [1/3] Importing player_game_logs...
psql -U postgres -d fantasy_ai_local -f player_game_logs.sql
echo.

echo [2/3] Importing player_stats...
psql -U postgres -d fantasy_ai_local -f player_stats.sql
echo.

echo [3/3] Importing players...
psql -U postgres -d fantasy_ai_local -f players.sql
echo.

echo Large tables imported! Run import-all.sql for remaining tables.
pause
