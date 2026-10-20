@echo off
REM scripts/restore.bat - Database Restore Script for PostgreSQL
REM Restores the SaaS database from a specified backup file.

setlocal enabledelayedexpansion

if "%1"=="" (
    echo Usage: scripts\restore.bat [path_to_backup_file.sql]
    exit /b 1
)

set BACKUP_FILE=%1
if not exist "%BACKUP_FILE%" (
    echo [ERROR] Backup file not found: %BACKUP_FILE%
    exit /b 1
)

if "%DB_HOST%"=="" set DB_HOST=127.0.0.1
if "%DB_PORT%"=="" set DB_PORT=5432
if "%DB_USER%"=="" set DB_USER=postgres
if "%DB_NAME%"=="" set DB_NAME=institute

echo ========================================================
echo [RESTORE] Restoring database %DB_NAME% from %BACKUP_FILE%
echo ========================================================

psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%BACKUP_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Database restoration completed successfully.
) else (
    echo [ERROR] Restoration failed with error code %ERRORLEVEL%
)

endlocal
