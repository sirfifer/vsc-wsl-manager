# Cross-Platform VSCode Extension Development Guide

## Overview
This document provides comprehensive guidelines for developing the VSC WSL Manager + Container extension to ensure full cross-platform compatibility across Windows, macOS, and Linux systems.

## Table of Contents
1. [Development Principles](#development-principles)
2. [Platform Detection](#platform-detection)
3. [File System Operations](#file-system-operations)
4. [Command Execution](#command-execution)
5. [Container Runtime Integration](#container-runtime-integration)
6. [Terminal Integration](#terminal-integration)
7. [Environment Variables](#environment-variables)
8. [Testing Requirements](#testing-requirements)
9. [Code Review Checklist](#code-review-checklist)
10. [Validation Scripts](#validation-scripts)

---

## Development Principles

### Core Rules
1. **NEVER hardcode file paths** - Always use `path.join()` and `os.homedir()`
2. **NEVER assume shell type** - Detect and adapt to the platform's default shell
3. **NEVER use platform-specific commands directly** - Abstract behind platform-aware functions
4. **ALWAYS test on all three platforms** during development
5. **ALWAYS handle missing dependencies gracefully**

### Required Platform Support Matrix
| Feature | Windows | macOS | Linux | WSL |
|---------|---------|--------|-------|-----|
| WSL Management | ✅ | ❌ | ❌ | ✅ |
| Docker Containers | ✅ | ✅ | ✅ | ✅ |
| Terminal Integration | ✅ | ✅ | ✅ | ✅ |
| File Operations | ✅ | ✅ | ✅ | ✅ |

---

## Platform Detection

### Required Platform Detection Module
Create `src/utils/platform.ts`:

```typescript
export interface PlatformInfo {
    isWindows: boolean;
    isMac: boolean;
    isLinux: boolean;
    isWSL: boolean;
    arch: string;
    shell: string;
    pathSeparator: string;
}

export function getPlatformInfo(): PlatformInfo {
    const platform = process.platform;
    const isWSL = platform === 'linux' && (
        process.env.WSL_DISTRO_NAME !== undefined ||
        process.env.WSLENV !== undefined ||
        process.env.WSL_INTEROP !== undefined
    );
    
    return {
        isWindows: platform === 'win32',
        isMac: platform === 'darwin',
        isLinux: platform === 'linux' && !isWSL,
        isWSL,
        arch: process.arch,
        shell: getDefaultShell(),
        pathSeparator: platform === 'win32' ? '\\' : '/'
    };
}

function getDefaultShell(): string {
    const platform = process.platform;
    
    if (platform === 'win32') {
        return process.env.ComSpec || 'cmd.exe';
    } else {
        return process.env.SHELL || '/bin/bash';
    }
}

// Export singleton instance
export const PLATFORM = getPlatformInfo();
```

### Usage Requirements
- Import `PLATFORM` in every module that needs platform-specific logic
- Use `PLATFORM.isWindows`, `PLATFORM.isMac`, etc. instead of direct `process.platform` checks
- Always handle the WSL case separately from Linux

---

## File System Operations

### Required Patterns

#### Path Construction
```typescript
// ✅ REQUIRED - Always use path.join()
import * as path from 'path';
import * as os from 'os';

const configPath = path.join(os.homedir(), '.vscode', 'extensions', 'config.json');

// ❌ FORBIDDEN - Never hardcode paths
const configPath = `${process.env.HOME}/.vscode/extensions/config.json`;
```

#### Cross-Platform File Access
```typescript
import { promises as fs } from 'fs';
import * as path from 'path';

export class CrossPlatformFileManager {
    /**
     * Find file ignoring case sensitivity differences
     */
    async findFileIgnoreCase(dir: string, filename: string): Promise<string | null> {
        try {
            const files = await fs.readdir(dir);
            const found = files.find(f => f.toLowerCase() === filename.toLowerCase());
            return found ? path.join(dir, found) : null;
        } catch {
            return null;
        }
    }

    /**
     * Get user configuration directory
     */
    getUserConfigDir(): string {
        const { isWindows, isMac } = PLATFORM;
        
        if (isWindows) {
            return path.join(os.homedir(), 'AppData', 'Roaming');
        } else if (isMac) {
            return path.join(os.homedir(), 'Library', 'Application Support');
        } else {
            return path.join(os.homedir(), '.config');
        }
    }

    /**
     * Make file executable (Unix-only operation)
     */
    async makeExecutable(filePath: string): Promise<void> {
        if (!PLATFORM.isWindows) {
            await fs.chmod(filePath, 0o755);
        }
        // Windows handles executables via file extension
    }
}
```

---

## Command Execution

### Required Command Execution Module
Create `src/utils/commandExecutor.ts`:

```typescript
import { spawn, SpawnOptions } from 'child_process';
import { PLATFORM } from './platform';

export interface CommandResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export class CrossPlatformCommandExecutor {
    /**
     * Execute command with platform-aware executable resolution
     */
    async executeCommand(
        command: string, 
        args: string[] = [], 
        options: SpawnOptions = {}
    ): Promise<CommandResult> {
        const executable = this.resolveExecutable(command);
        
        return new Promise((resolve, reject) => {
            const process = spawn(executable, args, {
                ...options,
                shell: PLATFORM.isWindows // Use shell on Windows for .cmd/.bat files
            });

            let stdout = '';
            let stderr = '';

            process.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (exitCode) => {
                resolve({
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    exitCode: exitCode || 0
                });
            });

            process.on('error', (error) => {
                reject(new Error(`Command execution failed: ${error.message}`));
            });
        });
    }

    /**
     * Resolve executable name for current platform
     */
    private resolveExecutable(command: string): string {
        if (PLATFORM.isWindows) {
            // Add .exe if not present and command doesn't have extension
            if (!command.includes('.') && !command.endsWith('.exe')) {
                return `${command}.exe`;
            }
        }
        return command;
    }

    /**
     * Check if command is available on the system
     */
    async isCommandAvailable(command: string): Promise<boolean> {
        try {
            const executable = this.resolveExecutable(command);
            const testCommand = PLATFORM.isWindows ? 'where' : 'which';
            const result = await this.executeCommand(testCommand, [executable]);
            return result.exitCode === 0;
        } catch {
            return false;
        }
    }
}
```

### Command Execution Rules
1. **ALWAYS use spawn() instead of exec()** for security
2. **ALWAYS resolve executable names** through `resolveExecutable()`
3. **ALWAYS check command availability** before execution
4. **NEVER use shell operators** like `&&`, `||`, `|` in commands

---

## Container Runtime Integration

### Required Container Runtime Manager
Create `src/container/runtimeManager.ts`:

```typescript
import { CrossPlatformCommandExecutor } from '../utils/commandExecutor';
import { PLATFORM } from '../utils/platform';

export type ContainerRuntime = 'docker' | 'podman' | 'orbstack' | 'colima';

export interface RuntimeInfo {
    type: ContainerRuntime;
    version: string;
    available: boolean;
    socketPath?: string;
}

export class ContainerRuntimeManager {
    private executor = new CrossPlatformCommandExecutor();

    /**
     * Detect available container runtimes
     */
    async detectRuntimes(): Promise<RuntimeInfo[]> {
        const runtimes: ContainerRuntime[] = ['docker', 'podman', 'orbstack', 'colima'];
        const results: RuntimeInfo[] = [];

        for (const runtime of runtimes) {
            const available = await this.executor.isCommandAvailable(runtime);
            let version = '';
            let socketPath: string | undefined;

            if (available) {
                try {
                    const result = await this.executor.executeCommand(runtime, ['--version']);
                    version = this.parseVersion(result.stdout);
                    socketPath = this.getSocketPath(runtime);
                } catch {
                    // Version detection failed, but command exists
                    version = 'unknown';
                }
            }

            results.push({
                type: runtime,
                version,
                available,
                socketPath
            });
        }

        return results;
    }

    /**
     * Get platform-specific socket path for runtime
     */
    private getSocketPath(runtime: ContainerRuntime): string | undefined {
        if (PLATFORM.isWindows) {
            switch (runtime) {
                case 'docker':
                    return '\\\\.\\pipe\\docker_engine';
                case 'podman':
                    return '\\\\.\\pipe\\podman-machine-default';
                default:
                    return undefined;
            }
        } else {
            // Unix socket paths for macOS/Linux
            switch (runtime) {
                case 'docker':
                    return '/var/run/docker.sock';
                case 'podman':
                    return `/run/user/${process.getuid()}/podman/podman.sock`;
                case 'orbstack':
                    return '/var/run/docker.sock'; // OrbStack uses Docker socket
                default:
                    return '/var/run/docker.sock';
            }
        }
    }

    /**
     * Execute container command with proper runtime
     */
    async executeContainerCommand(
        runtime: ContainerRuntime, 
        command: string, 
        args: string[]
    ): Promise<any> {
        const fullCommand = [command, ...args];
        return await this.executor.executeCommand(runtime, fullCommand);
    }

    private parseVersion(versionOutput: string): string {
        // Extract version from various formats
        const match = versionOutput.match(/version\s+(\d+\.\d+\.\d+)/i);
        return match ? match[1] : 'unknown';
    }
}
```

### Container Runtime Requirements
1. **MUST support Docker Desktop** on all platforms
2. **MUST detect OrbStack** on macOS
3. **MUST support Podman** on Linux
4. **MUST handle missing runtimes gracefully**
5. **MUST use appropriate socket paths** per platform

---

## Terminal Integration

### Required Terminal Manager
Create `src/terminal/terminalManager.ts`:

```typescript
import * as vscode from 'vscode';
import { PLATFORM } from '../utils/platform';

export interface TerminalConfig {
    name: string;
    executable: string;
    args: string[];
    env?: Record<string, string>;
}

export class CrossPlatformTerminalManager {
    /**
     * Create terminal configuration for container access
     */
    createContainerTerminalConfig(
        containerName: string, 
        runtime: string = 'docker'
    ): TerminalConfig {
        const executable = PLATFORM.isWindows ? `${runtime}.exe` : runtime;
        
        return {
            name: `Container: ${containerName}`,
            executable,
            args: ['exec', '-it', containerName, this.getContainerShell()],
            env: this.getTerminalEnvironment()
        };
    }

    /**
     * Create terminal configuration for WSL distribution
     */
    createWSLTerminalConfig(distroName: string): TerminalConfig {
        if (!PLATFORM.isWindows) {
            throw new Error('WSL terminals only supported on Windows');
        }

        return {
            name: `WSL: ${distroName}`,
            executable: 'wsl.exe',
            args: ['-d', distroName],
            env: this.getTerminalEnvironment()
        };
    }

    /**
     * Get appropriate shell for container
     */
    private getContainerShell(): string {
        // Try bash first, fallback to sh
        return '/bin/bash';
    }

    /**
     * Get terminal environment variables
     */
    private getTerminalEnvironment(): Record<string, string> {
        const env: Record<string, string> = {};
        
        // Preserve essential environment variables
        if (process.env.TERM) {
            env.TERM = process.env.TERM;
        }
        
        if (process.env.LANG) {
            env.LANG = process.env.LANG;
        }

        return env;
    }

    /**
     * Open terminal with configuration
     */
    async openTerminal(config: TerminalConfig): Promise<vscode.Terminal> {
        const terminal = vscode.window.createTerminal({
            name: config.name,
            shellPath: config.executable,
            shellArgs: config.args,
            env: config.env
        });

        terminal.show();
        return terminal;
    }

    /**
     * Register terminal profiles in VS Code
     */
    registerTerminalProfiles(configs: TerminalConfig[]): void {
        const profileObject: Record<string, any> = {};
        
        configs.forEach(config => {
            const profileKey = PLATFORM.isWindows ? 'windows' : 
                              PLATFORM.isMac ? 'osx' : 'linux';
            
            if (!profileObject[profileKey]) {
                profileObject[profileKey] = {};
            }
            
            profileObject[profileKey][config.name] = {
                path: config.executable,
                args: config.args,
                env: config.env
            };
        });

        // Update VS Code configuration
        const config = vscode.workspace.getConfiguration();
        config.update('terminal.integrated.profiles', profileObject, true);
    }
}
```

---

## Environment Variables

### Required Environment Handler
Create `src/utils/environment.ts`:

```typescript
import { PLATFORM } from './platform';

export class CrossPlatformEnvironment {
    /**
     * Get PATH environment variable (handles Windows case variations)
     */
    getPath(): string {
        return process.env.PATH || process.env.Path || process.env.path || '';
    }

    /**
     * Get user home directory
     */
    getHome(): string {
        return process.env.HOME || process.env.USERPROFILE || require('os').homedir();
    }

    /**
     * Check if running in WSL
     */
    isWSL(): boolean {
        return PLATFORM.isWSL;
    }

    /**
     * Get WSL distribution name (Windows only)
     */
    getWSLDistroName(): string | null {
        return process.env.WSL_DISTRO_NAME || null;
    }

    /**
     * Get container runtime environment variables
     */
    getContainerEnv(): Record<string, string | undefined> {
        return {
            DOCKER_HOST: process.env.DOCKER_HOST,
            DOCKER_TLS_VERIFY: process.env.DOCKER_TLS_VERIFY,
            DOCKER_CERT_PATH: process.env.DOCKER_CERT_PATH,
            PODMAN_CONNECTION_URI: process.env.PODMAN_CONNECTION_URI
        };
    }

    /**
     * Set environment variable with proper escaping
     */
    setEnvVar(key: string, value: string): void {
        process.env[key] = value;
    }

    /**
     * Get temporary directory
     */
    getTempDir(): string {
        return process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
    }
}
```

---

## Testing Requirements

### Platform Testing Matrix
Create `tests/platform/platform.test.ts`:

```typescript
import { describe, it, expect } from '@jest/globals';
import { getPlatformInfo } from '../../src/utils/platform';
import { CrossPlatformCommandExecutor } from '../../src/utils/commandExecutor';

describe('Cross-Platform Compatibility', () => {
    const platform = getPlatformInfo();
    const executor = new CrossPlatformCommandExecutor();

    describe('Platform Detection', () => {
        it('should correctly identify current platform', () => {
            expect(platform).toBeDefined();
            expect(typeof platform.isWindows).toBe('boolean');
            expect(typeof platform.isMac).toBe('boolean');
            expect(typeof platform.isLinux).toBe('boolean');
            expect(typeof platform.isWSL).toBe('boolean');
        });

        it('should have exactly one platform flag true', () => {
            const flags = [platform.isWindows, platform.isMac, platform.isLinux, platform.isWSL];
            const trueCount = flags.filter(Boolean).length;
            expect(trueCount).toBe(1);
        });
    });

    describe('Command Execution', () => {
        it('should handle basic commands on all platforms', async () => {
            const command = platform.isWindows ? 'echo' : 'echo';
            const result = await executor.executeCommand(command, ['test']);
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('test');
        });

        it('should properly resolve executable names', async () => {
            // Test with a command that should exist on all platforms
            const available = await executor.isCommandAvailable('node');
            expect(typeof available).toBe('boolean');
        });
    });

    describe('File System Operations', () => {
        it('should handle path operations correctly', async () => {
            const { CrossPlatformFileManager } = await import('../../src/utils/fileManager');
            const fileManager = new CrossPlatformFileManager();
            
            const configDir = fileManager.getUserConfigDir();
            expect(configDir).toBeTruthy();
            expect(typeof configDir).toBe('string');
        });
    });
});
```

### Required Test Scripts
Add to `package.json`:

```json
{
  "scripts": {
    "test:platform": "jest tests/platform/",
    "test:windows": "cross-env PLATFORM_TEST=windows jest",
    "test:macos": "cross-env PLATFORM_TEST=macos jest", 
    "test:linux": "cross-env PLATFORM_TEST=linux jest",
    "test:cross-platform": "npm run test:platform"
  }
}
```

---

## Code Review Checklist

### Before Each Commit - Verify:

#### ✅ File Operations
- [ ] All file paths use `path.join()`
- [ ] No hardcoded path separators (`/` or `\`)
- [ ] User directories accessed via `os.homedir()`
- [ ] Case-insensitive file searches where needed

#### ✅ Command Execution  
- [ ] All commands use `spawn()` not `exec()`
- [ ] Executable names resolved via `resolveExecutable()`
- [ ] Command availability checked before execution
- [ ] No shell operators in command strings

#### ✅ Platform Logic
- [ ] Platform detection uses `PLATFORM` constant
- [ ] WSL handled separately from Linux
- [ ] Windows-specific logic properly isolated
- [ ] macOS-specific features properly detected

#### ✅ Container Integration
- [ ] Multiple runtime support (Docker, Podman, OrbStack)
- [ ] Platform-specific socket paths
- [ ] Graceful handling of missing runtimes
- [ ] Proper executable resolution

#### ✅ Terminal Integration
- [ ] Platform-appropriate shell detection
- [ ] Proper terminal profile registration
- [ ] Environment variable preservation
- [ ] Error handling for unsupported platforms

#### ✅ Error Handling
- [ ] Graceful degradation when features unavailable
- [ ] Platform-specific error messages
- [ ] No assumptions about installed software
- [ ] Proper logging for debugging

---

## Validation Scripts

### Create `scripts/validate-cross-platform.js`:

```javascript
const fs = require('fs');
const path = require('path');

/**
 * Validate cross-platform compliance
 */
function validateCrossPlatform() {
    const errors = [];
    const srcDir = path.join(__dirname, '..', 'src');
    
    // Check all TypeScript files
    const tsFiles = getAllTsFiles(srcDir);
    
    tsFiles.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        
        // Check for hardcoded paths
        if (content.includes('\\\\') || content.match(/['"]/.*[/\\].*['"]/)) {
            errors.push(`${file}: Possible hardcoded path detected`);
        }
        
        // Check for direct process.platform usage
        if (content.includes('process.platform') && !content.includes('getPlatformInfo')) {
            errors.push(`${file}: Direct process.platform usage - use PLATFORM constant`);
        }
        
        // Check for exec() usage
        if (content.includes('.exec(') && !content.includes('// @cross-platform-safe')) {
            errors.push(`${file}: exec() usage detected - use spawn() instead`);
        }
        
        // Check for shell operators
        if (content.match(/['"].*[&|;].*['"]/)) {
            errors.push(`${file}: Shell operators detected in strings`);
        }
    });
    
    return errors;
}

function getAllTsFiles(dir) {
    let files = [];
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            files = files.concat(getAllTsFiles(fullPath));
        } else if (item.endsWith('.ts')) {
            files.push(fullPath);
        }
    });
    
    return files;
}

// Run validation
const errors = validateCrossPlatform();
if (errors.length > 0) {
    console.error('Cross-platform validation failed:');
    errors.forEach(error => console.error(`  ❌ ${error}`));
    process.exit(1);
} else {
    console.log('✅ Cross-platform validation passed');
}
```

### Add to `package.json`:
```json
{
  "scripts": {
    "validate:cross-platform": "node scripts/validate-cross-platform.js",
    "precommit": "npm run validate:cross-platform && npm run test:cross-platform"
  }
}
```

---

## Critical Rules Summary

### 🚨 NEVER DO:
1. Hardcode file paths with `/` or `\`
2. Use `exec()` for command execution
3. Assume specific shells are available
4. Use `process.platform` directly
5. Include shell operators in command strings
6. Assume case-sensitive file systems
7. Hardcode executable names without platform detection

### ✅ ALWAYS DO:
1. Use `path.join()` for all path operations
2. Use `spawn()` for command execution
3. Import and use `PLATFORM` constant
4. Check command availability before use
5. Handle missing dependencies gracefully
6. Test on all target platforms
7. Abstract platform differences behind interfaces
8. Use proper TypeScript types for platform detection

---

## Implementation Order

1. **Setup Core Platform Detection** (`src/utils/platform.ts`)
2. **Implement Command Executor** (`src/utils/commandExecutor.ts`)
3. **Create File Manager** (`src/utils/fileManager.ts`)
4. **Build Environment Handler** (`src/utils/environment.ts`)
5. **Develop Container Runtime Manager** (`src/container/runtimeManager.ts`)
6. **Implement Terminal Manager** (`src/terminal/terminalManager.ts`)
7. **Create Platform Tests** (`tests/platform/`)
8. **Add Validation Scripts** (`scripts/validate-cross-platform.js`)

This guide ensures your VSCode extension will work reliably across Windows, macOS, and Linux while properly handling WSL environments and various container runtimes.