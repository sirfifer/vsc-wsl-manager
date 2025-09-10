/**
 * Path utilities for WSL/Windows conversion
 * Handles path conversions between WSL and Windows environments
 */

const fs = require('fs');
const path = require('path');
const { DebugLogger } = require('../e2e-debug/debug-logger');

class PathUtils {
    constructor() {
        this.logger = new DebugLogger({
            prefix: 'path-utils',
            logLevel: process.env.DEBUG_LEVEL || 'DEBUG'
        });

        this.isWSL = process.platform === 'linux' && fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop');
        this.isWindows = process.platform === 'win32';
        
        this.logger.debug('PathUtils initialized', {
            isWSL: this.isWSL,
            isWindows: this.isWindows,
            platform: process.platform
        });
    }

    /**
     * Convert WSL path to Windows path
     * /mnt/c/path -> C:\path
     */
    wslToWindows(wslPath) {
        if (!wslPath) return wslPath;
        
        // Already a Windows path
        if (wslPath.match(/^[A-Z]:\\/i)) {
            return wslPath;
        }
        
        // Convert /mnt/c/... to C:\...
        if (wslPath.startsWith('/mnt/')) {
            const converted = wslPath
                .replace(/^\/mnt\/([a-z])/i, (match, drive) => `${drive.toUpperCase()}:`)
                .replace(/\//g, '\\');
            
            this.logger.debug('Converted WSL to Windows path', {
                from: wslPath,
                to: converted
            });
            
            return converted;
        }
        
        // Handle home directory paths
        if (wslPath.startsWith('/home/') || wslPath.startsWith('~/')) {
            this.logger.warn('Cannot convert WSL home path to Windows', { path: wslPath });
        }
        
        return wslPath;
    }

    /**
     * Convert Windows path to WSL path
     * C:\path -> /mnt/c/path
     */
    windowsToWSL(windowsPath) {
        if (!windowsPath) return windowsPath;
        
        // Already a WSL path
        if (windowsPath.startsWith('/')) {
            return windowsPath;
        }
        
        // Convert C:\... to /mnt/c/...
        if (windowsPath.match(/^[A-Z]:\\/i)) {
            const converted = windowsPath
                .replace(/^([A-Z]):\\/i, (match, drive) => `/mnt/${drive.toLowerCase()}/`)
                .replace(/\\/g, '/');
            
            this.logger.debug('Converted Windows to WSL path', {
                from: windowsPath,
                to: converted
            });
            
            return converted;
        }
        
        return windowsPath;
    }

    /**
     * Get the appropriate path based on current environment
     */
    getPath(inputPath, targetEnv = null) {
        if (!inputPath) return inputPath;
        
        // Determine target environment
        if (!targetEnv) {
            targetEnv = this.isWindows || this.isWSL ? 'windows' : 'wsl';
        }
        
        // Convert based on target
        if (targetEnv === 'windows') {
            if (this.isWSL) {
                return this.wslToWindows(inputPath);
            }
            return inputPath;
        } else {
            if (this.isWindows) {
                return this.windowsToWSL(inputPath);
            }
            return inputPath;
        }
    }

    /**
     * Get project root in appropriate format
     */
    getProjectRoot(targetEnv = null) {
        const root = process.cwd();
        return this.getPath(root, targetEnv);
    }

    /**
     * Join paths and convert to target environment
     */
    joinPath(targetEnv, ...parts) {
        const joined = path.join(...parts);
        return this.getPath(joined, targetEnv);
    }

    /**
     * Check if a path exists (handles both WSL and Windows)
     */
    pathExists(checkPath) {
        try {
            // Try direct check
            if (fs.existsSync(checkPath)) {
                return true;
            }
            
            // If in WSL, try Windows path
            if (this.isWSL) {
                const windowsPath = this.wslToWindows(checkPath);
                if (windowsPath !== checkPath && fs.existsSync(windowsPath)) {
                    return true;
                }
            }
            
            // If in Windows, try WSL path
            if (this.isWindows) {
                const wslPath = this.windowsToWSL(checkPath);
                if (wslPath !== checkPath && fs.existsSync(wslPath)) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            this.logger.debug('Error checking path existence', {
                path: checkPath,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Get VS Code executable path
     */
    getVSCodePath() {
        const candidates = [];
        
        if (this.isWindows || this.isWSL) {
            // Check WebdriverIO downloaded version first
            candidates.push(
                'C:\\data\\rea\\dev\\vsc-wsl-manager\\.wdio-vscode-service\\vscode-win32-x64-archive-1.103.2\\Code.exe',
                'C:\\Program Files\\Microsoft VS Code\\Code.exe',
                'C:\\Program Files (x86)\\Microsoft VS Code\\Code.exe'
            );
            
            if (process.env.LOCALAPPDATA) {
                candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'Code.exe'));
            }
        } else {
            candidates.push(
                '/mnt/c/data/rea/dev/vsc-wsl-manager/.wdio-vscode-service/vscode-linux-x64-1.103.2/code',
                '/usr/share/code/code',
                '/usr/bin/code'
            );
        }
        
        // Find first existing
        for (const candidate of candidates) {
            const checkPath = this.isWSL ? this.windowsToWSL(candidate) : candidate;
            if (this.pathExists(checkPath)) {
                this.logger.info('Found VS Code', { path: candidate });
                return candidate;
            }
        }
        
        this.logger.warn('VS Code not found in standard locations');
        return null;
    }

    /**
     * Escape path for shell execution
     */
    escapePath(inputPath) {
        if (this.isWindows) {
            // Windows: wrap in quotes if contains spaces
            return inputPath.includes(' ') ? `"${inputPath}"` : inputPath;
        } else {
            // Linux/WSL: escape spaces and special characters
            return inputPath.replace(/([' \\])/g, '\\$1');
        }
    }
}

// Export singleton instance
module.exports = new PathUtils();