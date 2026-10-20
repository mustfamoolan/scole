@echo off
REM scripts/backup.bat - Database Backup Script for PostgreSQL
REM Creates a timestamped compressed dump of the multi-tenant SaaS database.

setlocal enabledelayedexpansion

if "%DB_HOST%"=="" set DB_HOST=127.0.0.1
if "%DB_PORT%"=="" set DB_PORT=5432
if "%DB_USER%"=="" set DB_USER=postgres
if "%DB_NAME%"=="" set DB_NAME=institute

set BACKUP_DIR=storage\backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set dt=%%I
set TIMESTAMP=%dt:~0,8%_%dt:~8,6%
set BACKUP_FILE=%BACKUP_DIR%\backup_%DB_NAME%_%TIMESTAMP%.sql

echo ========================================================
echo [BACKUP] Starting SaaS database backup...
echo [BACKUP] Target: %BACKUP_FILE%
echo ========================================================

pg_dump -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -F p -b -v -f "%BACKUP_FILE%" %DB_NAME%

if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Backup completed successfully: %BACKUP_FILE%
) else (
    echo [ERROR] pg_dump failed with error code %ERRORLEVEL%
)

endlocal
