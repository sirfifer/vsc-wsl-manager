@echo off
setlocal enabledelayedexpansion

REM Chrome Wrapper - Filters out problematic flags for VS Code extension testing
REM This script is generated and used by chrome-interceptor.js

set "LOG_FILE=C:\data\rea\dev\vsc-wsl-manager\test\e2e-debug\logs\chrome-launch.log"
set "VSCODE_EXE=C:\data\rea\dev\vsc-wsl-manager\.wdio-vscode-service\vscode-win32-x64-archive-1.103.2\Code.exe"

echo [%date% %time%] Chrome Wrapper Started >> "%LOG_FILE%"
echo Current directory: %cd% >> "%LOG_FILE%"
echo Arguments count: %* >> "%LOG_FILE%"

set "FILTERED_ARGS="
set "REMOVED_FLAGS="
set "ARG_COUNT=0"

:parse_loop
if "%~1"=="" goto :execute
set /a ARG_COUNT+=1
set "CURRENT=%~1"

REM Debug: Log each argument
echo Arg %ARG_COUNT%: %CURRENT% >> "%LOG_FILE%"

REM Filter out disable-extensions flags
if /i "%CURRENT%"=="--disable-extensions" (
    echo REMOVED: --disable-extensions >> "%LOG_FILE%"
    set "REMOVED_FLAGS=!REMOVED_FLAGS! --disable-extensions"
    shift
    goto :parse_loop
)
if /i "%CURRENT%"=="--disableExtensions" (
    echo REMOVED: --disableExtensions >> "%LOG_FILE%"
    set "REMOVED_FLAGS=!REMOVED_FLAGS! --disableExtensions"
    shift
    goto :parse_loop
)

REM Keep extension development paths
echo "%CURRENT%" | findstr /i "extension.*development.*path" >nul
if %errorlevel%==0 (
    echo KEEPING EXTENSION PATH: %CURRENT% >> "%LOG_FILE%"
)

REM Add to filtered arguments
set "FILTERED_ARGS=!FILTERED_ARGS! %CURRENT%"
shift
goto :parse_loop

:execute
echo [%date% %time%] Filtered Arguments: !FILTERED_ARGS! >> "%LOG_FILE%"
echo [%date% %time%] Removed Flags: !REMOVED_FLAGS! >> "%LOG_FILE%"
echo [%date% %time%] Launching VS Code... >> "%LOG_FILE%"

REM Launch VS Code with filtered arguments
"%VSCODE_EXE%" !FILTERED_ARGS!
set "EXIT_CODE=%ERRORLEVEL%"

echo [%date% %time%] VS Code exited with code: %EXIT_CODE% >> "%LOG_FILE%"
exit /b %EXIT_CODE%