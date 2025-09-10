/**
 * Chrome Interceptor - Removes problematic flags from Chrome/VS Code launch
 * Integrates with existing debug logging infrastructure
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { DebugLogger } = require('../e2e-debug/debug-logger');

class ChromeInterceptor {
    constructor() {
        this.logger = new DebugLogger({
            prefix: 'chrome-interceptor',
            logLevel: process.env.DEBUG_LEVEL || 'DEBUG'
        });

        this.logger.info('Initializing Chrome Interceptor');
        
        // Determine paths based on platform
        this.isWSL = process.platform === 'linux' && fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop');
        this.isWindows = process.platform === 'win32' || this.isWSL;
        
        this.realVSCodePath = this.findRealVSCode();
        this.interceptorPath = this.isWindows 
            ? path.join(__dirname, 'chrome-wrapper.bat')
            : path.join(__dirname, 'chrome-wrapper.sh');
        
        this.logPath = path.join(__dirname, '..', '..', 'test', 'e2e-debug', 'logs', 'chrome-launch.log');
        
        this.logger.debug('Chrome Interceptor configuration', {
            isWSL: this.isWSL,
            isWindows: this.isWindows,
            realVSCodePath: this.realVSCodePath,
            interceptorPath: this.interceptorPath
        });
        
        this.setupInterceptor();
    }

    findRealVSCode() {
        const candidates = [];
        
        if (this.isWindows || this.isWSL) {
            // Windows VS Code locations
            candidates.push(
                'C:\\\\data\\\\rea\\\\dev\\\\vsc-wsl-manager\\\\.wdio-vscode-service\\\\vscode-win32-x64-archive-1.103.2\\\\Code.exe',
                'C:\\\\Program Files\\\\Microsoft VS Code\\\\Code.exe',
                'C:\\\\Program Files (x86)\\\\Microsoft VS Code\\\\Code.exe',
                process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'Code.exe') : null
            );
        } else {
            // Linux VS Code locations
            candidates.push(
                '/mnt/c/data/rea/dev/vsc-wsl-manager/.wdio-vscode-service/vscode-linux-x64-1.103.2/code',
                '/usr/share/code/code',
                '/usr/bin/code',
                '/snap/bin/code'
            );
        }
        
        // Find first existing path
        for (const candidate of candidates.filter(Boolean)) {
            const checkPath = this.isWSL ? candidate.replace(/\\\\/g, '\\') : candidate;
            if (fs.existsSync(checkPath)) {
                this.logger.info('Found VS Code executable', { path: checkPath });
                return checkPath;
            }
        }
        
        // Default to WebdriverIO's downloaded VS Code
        const defaultPath = this.isWindows
            ? 'C:\\\\data\\\\rea\\\\dev\\\\vsc-wsl-manager\\\\.wdio-vscode-service\\\\vscode-win32-x64-archive-1.103.2\\\\Code.exe'
            : '/mnt/c/data/rea/dev/vsc-wsl-manager/.wdio-vscode-service/vscode-linux-x64-1.103.2/code';
        
        this.logger.warn('VS Code not found in standard locations, using default', { defaultPath });
        return defaultPath;
    }

    setupInterceptor() {
        this.logger.info('Setting up interceptor script', { path: this.interceptorPath });
        
        // Create wrapper script based on platform
        const wrapperScript = this.isWindows ? this.createWindowsWrapper() : this.createLinuxWrapper();
        
        // Ensure log directory exists
        const logDir = path.dirname(this.logPath);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        try {
            fs.writeFileSync(this.interceptorPath, wrapperScript);
            
            if (!this.isWindows) {
                fs.chmodSync(this.interceptorPath, '755');
            }
            
            this.logger.info('Chrome interceptor created successfully', { 
                interceptorPath: this.interceptorPath 
            });
        } catch (error) {
            this.logger.error('Failed to create interceptor script', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
        
        return this.interceptorPath;
    }

    createWindowsWrapper() {
        const vscodePath = this.realVSCodePath.replace(/\\\\/g, '\\');
        const logPath = this.logPath.replace(/\//g, '\\');
        
        return `@echo off
setlocal enabledelayedexpansion

REM Chrome Interceptor - Filters problematic flags
echo [%date% %time%] Chrome Interceptor Started >> "${logPath}"
echo Arguments received: %* >> "${logPath}"

set "FILTERED_ARGS="
set "SKIP_NEXT=0"
set "REMOVED_FLAGS="

:parse_args
if "%~1"=="" goto :run

REM Check if we should skip this argument
if "!SKIP_NEXT!"=="1" (
    echo Skipping argument: %1 >> "${logPath}"
    set "SKIP_NEXT=0"
    shift
    goto :parse_args
)

REM Filter out problematic flags
set "CURRENT_ARG=%~1"

REM Remove --disable-extensions and its variations
if /i "!CURRENT_ARG!"=="--disable-extensions" (
    echo FILTERED OUT: --disable-extensions >> "${logPath}"
    set "REMOVED_FLAGS=!REMOVED_FLAGS! --disable-extensions"
    shift
    goto :parse_args
)
if /i "!CURRENT_ARG!"=="--disableExtensions" (
    echo FILTERED OUT: --disableExtensions >> "${logPath}"
    set "REMOVED_FLAGS=!REMOVED_FLAGS! --disableExtensions"
    shift
    goto :parse_args
)

REM Keep extension development path
if /i "!CURRENT_ARG:~0,26!"=="--extension-development-path" (
    echo KEEPING: !CURRENT_ARG! >> "${logPath}"
    set "FILTERED_ARGS=!FILTERED_ARGS! !CURRENT_ARG!"
    shift
    goto :parse_args
)
if /i "!CURRENT_ARG:~0,25!"=="--extensionDevelopmentPath" (
    echo KEEPING: !CURRENT_ARG! >> "${logPath}"
    set "FILTERED_ARGS=!FILTERED_ARGS! !CURRENT_ARG!"
    shift
    goto :parse_args
)

REM Keep all other arguments
set "FILTERED_ARGS=!FILTERED_ARGS! !CURRENT_ARG!"
shift
goto :parse_args

:run
echo [%date% %time%] Removed flags: !REMOVED_FLAGS! >> "${logPath}"
echo [%date% %time%] Launching VS Code with filtered args >> "${logPath}"
echo Filtered arguments: !FILTERED_ARGS! >> "${logPath}"

REM Launch VS Code with filtered arguments
"${vscodePath}" !FILTERED_ARGS!
set EXIT_CODE=%ERRORLEVEL%

echo [%date% %time%] VS Code exited with code: %EXIT_CODE% >> "${logPath}"
exit /b %EXIT_CODE%
`;
    }

    createLinuxWrapper() {
        return `#!/bin/bash

# Chrome Interceptor - Filters problematic flags
LOG_FILE="${this.logPath}"
VSCODE_PATH="${this.realVSCodePath}"

echo "[$(date)] Chrome Interceptor Started" >> "$LOG_FILE"
echo "Arguments received: $@" >> "$LOG_FILE"

FILTERED_ARGS=""
REMOVED_FLAGS=""
SKIP_NEXT=0

for arg in "$@"; do
    if [ "$SKIP_NEXT" = "1" ]; then
        echo "Skipping argument: $arg" >> "$LOG_FILE"
        SKIP_NEXT=0
        continue
    fi
    
    # Filter out problematic flags
    case "$arg" in
        --disable-extensions|--disableExtensions)
            echo "FILTERED OUT: $arg" >> "$LOG_FILE"
            REMOVED_FLAGS="$REMOVED_FLAGS $arg"
            continue
            ;;
        --extension-development-path*|--extensionDevelopmentPath*)
            echo "KEEPING: $arg" >> "$LOG_FILE"
            FILTERED_ARGS="$FILTERED_ARGS $arg"
            continue
            ;;
        *)
            # Keep all other arguments
            FILTERED_ARGS="$FILTERED_ARGS $arg"
            ;;
    esac
done

echo "[$(date)] Removed flags: $REMOVED_FLAGS" >> "$LOG_FILE"
echo "[$(date)] Launching VS Code with filtered args" >> "$LOG_FILE"
echo "Filtered arguments: $FILTERED_ARGS" >> "$LOG_FILE"

# Launch VS Code with filtered arguments
if [ -n "$DISPLAY" ]; then
    "$VSCODE_PATH" $FILTERED_ARGS
else
    # If no display, try with xvfb-run
    xvfb-run -a "$VSCODE_PATH" $FILTERED_ARGS
fi

EXIT_CODE=$?
echo "[$(date)] VS Code exited with code: $EXIT_CODE" >> "$LOG_FILE"
exit $EXIT_CODE
`;
    }

    getWrapperPath() {
        return this.interceptorPath;
    }

    getWindowsWrapperPath() {
        // Convert path for Windows if running from WSL
        if (this.isWSL) {
            return this.interceptorPath.replace('/mnt/c/', 'C:\\').replace(/\//g, '\\');
        }
        return this.interceptorPath;
    }

    cleanup() {
        this.logger.info('Cleaning up Chrome interceptor');
        
        try {
            if (fs.existsSync(this.interceptorPath)) {
                fs.unlinkSync(this.interceptorPath);
                this.logger.debug('Removed interceptor script');
            }
        } catch (error) {
            this.logger.warn('Failed to cleanup interceptor', { error: error.message });
        }
    }
}

module.exports = ChromeInterceptor;