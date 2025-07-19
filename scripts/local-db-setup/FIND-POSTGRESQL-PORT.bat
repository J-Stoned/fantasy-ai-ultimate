@echo off
echo Finding PostgreSQL Port...
echo =========================
echo.

echo Checking what's listening on common PostgreSQL ports:
echo.

echo Port 5432 (default):
netstat -an | findstr :5432
echo.

echo Port 5433:
netstat -an | findstr :5433
echo.

echo Port 5434 (what we tried to use):
netstat -an | findstr :5434
echo.

echo Port 5435:
netstat -an | findstr :5435
echo.

echo.
echo Checking PostgreSQL service configuration:
sc qc postgresql-x64-17 | findstr "BINARY_PATH_NAME"

echo.
echo =========================
echo If you see a port LISTENING above, that's where PostgreSQL is running!
echo Update your connection to use that port.
echo.
pause